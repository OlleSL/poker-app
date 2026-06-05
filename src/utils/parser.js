export function parseRedDragonHands(rawText) {
  const text = rawText.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').trim();

  const handBlocks = text
    .split(/(?:^|\n)(?=[^\n]*\bHand #\d+)/g)
    .map(b => b.trim())
    .filter(Boolean);

  return handBlocks.map(parseSingleHand).reverse();
}

function parseSingleHand(rawText) {
  const lines = rawText.split("\n").map((line) => line.trim());
  const hand = {
    players: {},
    hero: null,
    heroCards: [],
    board: [],
    actions: {
      preflop: [],
      flop: [],
      turn: [],
      river: [],
    },
    antes: [],
    winner: null,
    totalPot: null,
    anteTotal: 0,
    raw: rawText, // Store raw text for winner extraction
    summaryLines: [], // Store summary section lines
    winners: [], // Structured winner data
    playerInvestments: {}, // Track how much each player invested
  };

  // Extract button seat
  const btnLine = lines.find(line => line.includes("Seat #") && line.includes("is the button"));
  let buttonSeatNumber = null;
  if (btnLine) {
    const match = btnLine.match(/Seat #(\d+)/);
    if (match) {
      buttonSeatNumber = parseInt(match[1], 10);
    }
  }

  const headerLine = lines.find(
    (line) => line.includes("Hold'em") && line.includes("(")
  );

  if (headerLine) {
    const match = headerLine.match(/\((\d+)\/(\d+)\)/);
    if (match) {
      hand.bigBlind = parseInt(match[2], 10);
    }
  }

  let street = "preflop";

  for (let line of lines) {
    if (line.startsWith("Dealt to")) {
      const match = line.match(/Dealt to (\w+) \[(.*)\]/);
      if (match) {
        hand.hero = match[1];
        hand.heroCards = match[2].split(" ");
      }
    }

    if (line.startsWith("*** FLOP ***")) {
      street = "flop";
      const match = line.match(/\[\s*(.*?)\s*\]/);
      if (match) hand.board = match[1].split(" ");
    }

    if (line.startsWith("*** TURN ***")) {
      street = "turn";
      const match = line.match(/\[.*\] \[(.*)\]/);
      if (match) hand.board.push(match[1]);
    }

    if (line.startsWith("*** RIVER ***")) {
      street = "river";
      const match = line.match(/\[.*\] \[(.*)\]/);
      if (match) hand.board.push(match[1]);
    }

    if (/^\w+:\s(bets|raises|calls|checks|folds|posts)/.test(line)) {
      const match = line.match(/^(\w+):\s(\w+)(.*)/);
      if (match) {
        let [, player, action, detail] = match;
        detail = detail.trim();

        let amount = null;
        if (action === "raises") {
          const raiseMatch = detail.match(/to (\d+)/);
          if (raiseMatch) amount = parseInt(raiseMatch[1]);
        } else {
          const amountMatch = detail.match(/(\d+)/);
          if (amountMatch) amount = parseInt(amountMatch[1]);
        }

        hand.actions[street].push({ player, action, amount, raw: line });
        
        // Track player investments for net profit calculation
        if (amount && (action === "bets" || action === "calls" || action === "raises")) {
          if (!hand.playerInvestments[player]) {
            hand.playerInvestments[player] = 0;
          }
          if (action === "raises") {
            // For raises, amount is the total amount to call, so we need to track the increment
            const currentInvestment = hand.playerInvestments[player];
            const increment = amount - currentInvestment;
            hand.playerInvestments[player] = amount;
          } else {
            hand.playerInvestments[player] += amount;
          }
        }
      }
    }

    if (line.includes("posts the ante")) {
      const match = line.match(/^(\w+): posts the ante (\d+)/);
      if (match) {
        const [, player, amount] = match;
        hand.actions[street].push({
          player,
          action: "posts",
          amount: parseInt(amount),
          raw: line,
        });
        hand.anteTotal += parseInt(amount);
        hand.antes.push({ player, amount: parseInt(amount) });
        
        // Track ante investments
        if (!hand.playerInvestments[player]) {
          hand.playerInvestments[player] = 0;
        }
        hand.playerInvestments[player] += parseInt(amount);
      }
    }

    // Handle uncalled bet returns
    if (line.includes("Uncalled bet")) {
      const match = line.match(/Uncalled bet \((\d+)\) returned to (\w+)/);
      if (match) {
        const [, amount, player] = match;
        const uncalledAmount = parseInt(amount);
        // Reduce the player's investment by the uncalled amount
        if (hand.playerInvestments[player]) {
          hand.playerInvestments[player] -= uncalledAmount;
        }
      }
    }

    // Parse winner information - handle both "collected X from pot" and "collected (X)"
    if (line.includes("collected")) {
      // Match "bajkee collected 283986 from pot"
      let match = line.match(/(\w+)\s+collected\s+([\d,]+)\s+from pot/);
      if (match) {
        hand.winner = match[1];
        hand.totalPot = parseInt(match[2].replace(/,/g, ''));
        // Calculate net profit: collected amount - what they invested
        const collectedAmount = parseInt(match[2].replace(/,/g, ''));
        const playerName = match[1];
        const investedAmount = hand.playerInvestments[playerName] || 0;
        const netProfit = collectedAmount - investedAmount;
        hand.winners.push({ player: playerName, amount: netProfit });
      } else {
        // Match "bajkee collected (27000)"
        match = line.match(/(\w+)\s+collected\s*\(([\d,]+)\)/);
        if (match) {
          hand.winner = match[1];
          hand.totalPot = parseInt(match[2].replace(/,/g, ''));
          // Calculate net profit: collected amount - what they invested
          const collectedAmount = parseInt(match[2].replace(/,/g, ''));
          const playerName = match[1];
          const investedAmount = hand.playerInvestments[playerName] || 0;
          const netProfit = collectedAmount - investedAmount;
          hand.winners.push({ player: playerName, amount: netProfit });
        }
      }
    }

    // Store summary section lines for winner extraction
    if (line.includes("*** SUMMARY ***") || hand.summaryLines.length > 0) {
      hand.summaryLines.push(line);
    }

    if (line.startsWith("Seat")) {
      const match = line.match(/Seat (\d+): (\w+).*?\((\d+)\s+in chips\)/);
      if (match) {
        const [, seat, name, stackStr] = match;
        const stack = parseInt(stackStr, 10);
        hand.players[name] = {
          id: name,
          name,
          cards: [],
          seat: parseInt(seat, 10),
          stack,
          position: "",
        };
      }

      const showMatch = line.match(/Seat \d+: (\w+).*?\[(.*?)\]/);
      if (showMatch) {
        const [, name, cardsStr] = showMatch;
        const cards = cardsStr.split(" ");
        if (hand.players[name]) {
          hand.players[name].cards = cards;
        }
      }
    }

    if (line.startsWith("*** SUMMARY ***")) {
      street = "summary";
    }
  }

  // Assign hero cards
  if (hand.hero && hand.players[hand.hero]) {
    hand.players[hand.hero].cards = hand.heroCards;
  }

  // Sort players by seat
  // Step 1: Sort by seat number
  let sortedPlayers = Object.values(hand.players).sort((a, b) => a.seat - b.seat);

  // Step 2: Find the seat number of BB
  const bbPlayer = hand.actions.preflop.find(a => a.action === "posts" && a.amount === hand.bigBlind);
  const bbName = bbPlayer?.player;
  const bbSeat = hand.players[bbName]?.seat;

  // Step 3: Rotate so UTG (left of BB) is first
  if (bbSeat != null) {
    const bbIdx = sortedPlayers.findIndex(p => p.seat === bbSeat);
    const utgIdx = (bbIdx + 1) % sortedPlayers.length;
    sortedPlayers = [
      ...sortedPlayers.slice(utgIdx),
      ...sortedPlayers.slice(0, utgIdx)
    ];
  }

  // Step 4: Assign real positions based on number of players
  // Map positions relative to button (BTN) working backwards: BB, SB, BTN, CO, HJ, LJ, UTG
  const posMap = {
    2: ["SB", "BB"],
    3: ["BTN", "SB", "BB"],
    4: ["CO", "BTN", "SB", "BB"],
    5: ["HJ", "CO", "BTN", "SB", "BB"],           // 5-handed: HJ, CO, BTN, SB, BB
    6: ["LJ", "HJ", "CO", "BTN", "SB", "BB"],     // 6-handed: LJ, HJ, CO, BTN, SB, BB  
    7: ["UTG", "LJ", "HJ", "CO", "BTN", "SB", "BB"], // 7-handed: UTG, LJ, HJ, CO, BTN, SB, BB
    8: ["UTG", "LJ", "HJ", "CO", "BTN", "SB", "BB"], // 8-handed: same as 7-handed
  };

  const positions = posMap[sortedPlayers.length] || [];

  sortedPlayers.forEach((p, i) => {
    p.position = positions[i] || "";
  });

  // Step 5: Rotate again to make hero bottom (visual seat 4)
  const heroIndex = sortedPlayers.findIndex(p => p.name === hand.hero);
  if (heroIndex !== -1) {
    const offset = 4;
    const rotated = [
      ...sortedPlayers.slice(heroIndex),
      ...sortedPlayers.slice(0, heroIndex)
    ];
    const finalOrder = rotated.map((p, i) => ({
      ...p,
      visualSeat: (i + offset) % rotated.length
    }));

    const playerMap = {};
    finalOrder.forEach(p => {
      playerMap[p.name] = p;
    });

    hand.players = playerMap;
  }

  return hand;
}

