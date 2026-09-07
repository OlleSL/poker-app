/** Parse chip amounts like 250, 530.00, 1,234.56 */
function parseAmount(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

const AMOUNT = String.raw`([\d,]+(?:\.\d+)?)`;
const PLAYER = String.raw`([^\s:]+)`;

/**
 * Parse Red Dragon / PokerStars-style tournament hand histories.
 * CoinPoker exports via Asian Hand Converter typically arrive as "RedDragon Hand #…".
 * Classic PokerStars-style integer chip amounts are also supported.
 */
export function parseRedDragonHands(rawText) {
  const text = rawText.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "").trim();

  const handBlocks = text
    .split(/(?:^|\n)(?=[^\n]*\bHand #\d+)/g)
    .map((b) => b.trim())
    .filter((b) => /\bHand #\d+/.test(b));

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
    raw: rawText,
    summaryLines: [],
    winners: [],
    playerInvestments: {},
    site: detectSite(rawText),
    isBounty: false,
    bountyFormat: null, // "pko" | "ko" | null
    buyIn: null,
    bounties: [], // { hunter, eliminated, cashAmount, bountyIncrease, hunterBountyAfter }
    eliminations: [], // { player, place }
  };

  const btnLine = lines.find(
    (line) => line.includes("Seat #") && line.includes("is the button")
  );
  let buttonSeatNumber = null;
  if (btnLine) {
    const match = btnLine.match(/Seat #(\d+)/);
    if (match) buttonSeatNumber = parseInt(match[1], 10);
  }
  hand.buttonSeat = buttonSeatNumber;

  const headerLine = lines.find(
    (line) => line.includes("Hold'em") && line.includes("(")
  );

  if (headerLine) {
    const blindMatch = headerLine.match(
      /\(([\d,]+(?:\.\d+)?)\/([\d,]+(?:\.\d+)?)\)/
    );
    if (blindMatch) {
      hand.smallBlind = parseAmount(blindMatch[1]);
      hand.bigBlind = parseAmount(blindMatch[2]);
    }

    // PKO buy-in is often three parts: prize+bounty+fee → $2.00+$2.00+$0.40
    const tripleBuyIn = headerLine.match(
      /\$?([\d.]+)\s*\+\s*\$?([\d.]+)\s*\+\s*\$?([\d.]+)/
    );
    const doubleBuyIn = headerLine.match(/\$?([\d.]+)\s*\+\s*\$?([\d.]+)(?!\s*\+)/);
    if (tripleBuyIn) {
      hand.buyIn = {
        prizePool: parseAmount(tripleBuyIn[1]),
        bounty: parseAmount(tripleBuyIn[2]),
        fee: parseAmount(tripleBuyIn[3]),
      };
      hand.isBounty = true;
      hand.bountyFormat = "pko";
    } else if (doubleBuyIn) {
      hand.buyIn = {
        prizePool: parseAmount(doubleBuyIn[1]),
        fee: parseAmount(doubleBuyIn[2]),
        bounty: null,
      };
    }

    if (/progressive\s+knockout|\bPKO\b/i.test(headerLine)) {
      hand.isBounty = true;
      hand.bountyFormat = "pko";
    } else if (/\bknockout\b|\bKO\b|\bbounty\b/i.test(headerLine)) {
      hand.isBounty = true;
      hand.bountyFormat = hand.bountyFormat || "ko";
    }
  }

  let street = "preflop";

  for (let line of lines) {
    if (line.startsWith("Dealt to")) {
      const match = line.match(new RegExp(String.raw`Dealt to ${PLAYER} \[(.*)\]`));
      if (match) {
        hand.hero = match[1];
        hand.heroCards = match[2].split(" ").filter(Boolean);
      }
    }

    if (line.startsWith("*** FLOP ***")) {
      street = "flop";
      const match = line.match(/\[\s*(.*?)\s*\]/);
      if (match) hand.board = match[1].split(" ").filter(Boolean);
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

    if (line.includes("posts the ante")) {
      const match = line.match(
        new RegExp(String.raw`^${PLAYER}: posts the ante ${AMOUNT}`)
      );
      if (match) {
        const player = match[1];
        const amount = parseAmount(match[2]);
        hand.actions[street].push({
          player,
          action: "posts",
          amount,
          raw: line,
        });
        hand.anteTotal += amount;
        hand.antes.push({ player, amount });
        hand.playerInvestments[player] =
          (hand.playerInvestments[player] || 0) + amount;
      }
      continue;
    }

    if (
      new RegExp(
        String.raw`^${PLAYER}:\s(bets|raises|calls|checks|folds|posts)\b`
      ).test(line)
    ) {
      const match = line.match(
        new RegExp(
          String.raw`^${PLAYER}:\s(bets|raises|calls|checks|folds|posts)(.*)$`
        )
      );
      if (match) {
        let [, player, action, detail] = match;
        detail = detail.trim();

        let amount = null;
        if (action === "raises") {
          const raiseMatch = detail.match(
            new RegExp(String.raw`to ${AMOUNT}`)
          );
          if (raiseMatch) amount = parseAmount(raiseMatch[1]);
        } else if (action !== "checks" && action !== "folds") {
          const amountMatch = detail.match(new RegExp(AMOUNT));
          if (amountMatch) amount = parseAmount(amountMatch[1]);
        }

        hand.actions[street].push({ player, action, amount, raw: line });

        if (
          amount != null &&
          (action === "bets" || action === "calls" || action === "raises")
        ) {
          if (!hand.playerInvestments[player]) {
            hand.playerInvestments[player] = 0;
          }
          if (action === "raises") {
            hand.playerInvestments[player] = amount;
          } else {
            hand.playerInvestments[player] += amount;
          }
        }
      }
    }

    if (line.includes("Uncalled bet")) {
      const match = line.match(
        new RegExp(
          String.raw`Uncalled bet \(${AMOUNT}\) returned to ${PLAYER}`
        )
      );
      if (match) {
        const uncalledAmount = parseAmount(match[1]);
        const player = match[2];
        if (hand.playerInvestments[player]) {
          hand.playerInvestments[player] -= uncalledAmount;
        }
      }
    }

    if (line.includes("collected")) {
      let match = line.match(
        new RegExp(
          String.raw`${PLAYER}\s+collected\s+${AMOUNT}\s+from pot`
        )
      );
      if (match) {
        pushWinner(hand, match[1], parseAmount(match[2]));
      } else {
        match = line.match(
          new RegExp(String.raw`${PLAYER}\s+collected\s*\(${AMOUNT}\)`)
        );
        if (match) {
          pushWinner(hand, match[1], parseAmount(match[2]));
        }
      }
    }

    // PokerStars PKO/KO bounty award, e.g.:
    // "nossoff wins $1 for eliminating Hero and their own bounty increases by $1 to $6"
    if (/\bwins\b.+\bfor eliminating\b/i.test(line)) {
      const bountyMatch = line.match(
        /^(.+?)\s+wins\s+\$?([\d,]+(?:\.\d+)?)\s+for eliminating\s+(.+?)(?:\s+and their own bounty increases by\s+\$?([\d,]+(?:\.\d+)?)\s+to\s+\$?([\d,]+(?:\.\d+)?))?$/i
      );
      if (bountyMatch) {
        hand.isBounty = true;
        const cashAmount = parseAmount(bountyMatch[2]);
        const bountyIncrease = bountyMatch[4]
          ? parseAmount(bountyMatch[4])
          : null;
        if (bountyIncrease != null) hand.bountyFormat = "pko";
        else hand.bountyFormat = hand.bountyFormat || "ko";

        hand.bounties.push({
          hunter: bountyMatch[1].trim(),
          eliminated: bountyMatch[3].trim(),
          cashAmount,
          bountyIncrease,
          hunterBountyAfter: bountyMatch[5]
            ? parseAmount(bountyMatch[5])
            : null,
        });
      }
    }

    if (/\bfinished the tournament in\b/i.test(line)) {
      const finishMatch = line.match(
        /^(.+?)\s+finished the tournament in\s+(\d+)/i
      );
      if (finishMatch) {
        hand.eliminations.push({
          player: finishMatch[1].trim(),
          place: parseInt(finishMatch[2], 10),
        });
      }
    }

    if (line.includes("*** SUMMARY ***") || hand.summaryLines.length > 0) {
      hand.summaryLines.push(line);
    }

    if (line.startsWith("Seat")) {
      const match = line.match(
        new RegExp(
          String.raw`Seat (\d+): ${PLAYER}.*?\(${AMOUNT}\s+in chips\)`
        )
      );
      if (match) {
        const [, seat, name, stackStr] = match;
        const stack = parseAmount(stackStr);
        hand.players[name] = {
          id: name,
          name,
          cards: [],
          seat: parseInt(seat, 10),
          stack,
          position: "",
        };
      }

      const showMatch = line.match(
        new RegExp(String.raw`Seat \d+: ${PLAYER}.*?\[(.*?)\]`)
      );
      if (showMatch) {
        const [, name, cardsStr] = showMatch;
        const cards = cardsStr.split(" ").filter(Boolean);
        if (hand.players[name]) {
          hand.players[name].cards = cards;
        }
      }
    }

    if (line.startsWith("*** SUMMARY ***")) {
      street = "summary";
    }
  }

  if (hand.hero && hand.players[hand.hero]) {
    hand.players[hand.hero].cards = hand.heroCards;
  }

  let sortedPlayers = Object.values(hand.players).sort(
    (a, b) => a.seat - b.seat
  );

  const bbPlayer = hand.actions.preflop.find(
    (a) =>
      a.action === "posts" &&
      hand.bigBlind != null &&
      almostEqual(a.amount, hand.bigBlind)
  );
  const bbName = bbPlayer?.player;
  const bbSeat = hand.players[bbName]?.seat;

  if (bbSeat != null) {
    const bbIdx = sortedPlayers.findIndex((p) => p.seat === bbSeat);
    const utgIdx = (bbIdx + 1) % sortedPlayers.length;
    sortedPlayers = [
      ...sortedPlayers.slice(utgIdx),
      ...sortedPlayers.slice(0, utgIdx),
    ];
  }

  const posMap = {
    2: ["SB", "BB"],
    3: ["BTN", "SB", "BB"],
    4: ["CO", "BTN", "SB", "BB"],
    5: ["HJ", "CO", "BTN", "SB", "BB"],
    6: ["LJ", "HJ", "CO", "BTN", "SB", "BB"],
    7: ["UTG", "LJ", "HJ", "CO", "BTN", "SB", "BB"],
    8: ["UTG", "LJ", "HJ", "CO", "BTN", "SB", "BB"],
    9: ["UTG", "UTG+1", "LJ", "HJ", "CO", "BTN", "SB", "BB"],
  };

  const positions = posMap[sortedPlayers.length] || [];

  sortedPlayers.forEach((p, i) => {
    p.position = positions[i] || "";
  });

  const heroIndex = sortedPlayers.findIndex((p) => p.name === hand.hero);
  if (heroIndex !== -1) {
    const offset = 4;
    const rotated = [
      ...sortedPlayers.slice(heroIndex),
      ...sortedPlayers.slice(0, heroIndex),
    ];
    const finalOrder = rotated.map((p, i) => ({
      ...p,
      visualSeat: (i + offset) % rotated.length,
    }));

    const playerMap = {};
    finalOrder.forEach((p) => {
      playerMap[p.name] = p;
    });

    hand.players = playerMap;
  }

  return hand;
}

function detectSite(rawText) {
  if (/^RedDragon Hand #/m.test(rawText)) return "reddragon";
  if (/^PokerStars Hand #/m.test(rawText)) return "pokerstars";
  if (/\bHand #\d+/m.test(rawText)) return "pokerstars-like";
  return "unknown";
}

function almostEqual(a, b, eps = 0.001) {
  if (a == null || b == null) return false;
  return Math.abs(a - b) < eps;
}

function pushWinner(hand, playerName, collectedAmount) {
  hand.winner = playerName;
  hand.totalPot = collectedAmount;
  const investedAmount = hand.playerInvestments[playerName] || 0;
  const netProfit = collectedAmount - investedAmount;
  hand.winners.push({ player: playerName, amount: netProfit });
}
