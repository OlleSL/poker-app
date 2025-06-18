export function parseRedDragonHands(rawText) {
  const handBlocks = rawText
    .split(/\n(?=Hand #)/)
    .map((block) => block.trim())
    .filter(Boolean);

  const hands = [];

  for (const block of handBlocks) {
    const hand = parseSingleHand(block);
    if (hand) hands.push(hand);
  }

  return hands;
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
    winner: null,
    totalPot: null,
  };

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
  let seatCounter = 0;

  for (let line of lines) {
    if (line.startsWith("Dealt to")) {
      const match = line.match(/Dealt to (\w+) \[(.*)\]/);
      if (match) {
        hand.hero = match[1];
        hand.heroCards = match[2].split(" ");
        if (!hand.players[hand.hero]) {
          hand.players[hand.hero] = {
            id: hand.hero,
            name: hand.hero,
            cards: hand.heroCards,
            seat: seatCounter++,
            stack: 0,
            position: "",
          };
        } else {
          hand.players[hand.hero].cards = hand.heroCards;
        }
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
        const amount = detail.match(/(\d+)/)?.[1] || null;

        hand.actions[street].push({
          player,
          action,
          amount: amount ? parseInt(amount) : null,
          raw: line,
        });
      }
    }

    // Handle "posts the ante" as a separate case
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
      }
    }

    if (line.includes("collected")) {
      const match = line.match(/(\w+)\scollected\s(\d+)/);
      if (match) {
        hand.winner = match[1];
        hand.totalPot = parseInt(match[2]);
      }
    }

    if (line.startsWith("Seat")) {
      const match = line.match(/Seat (\d+): (\w+).*?\((\d+)\s+in chips\)/);
      if (match) {
        const [, seat, name, stackStr] = match;
        const stack = stackStr ? parseInt(stackStr, 10) : 0;
        if (!hand.players[name]) {
          hand.players[name] = {
            id: name,
            name,
            cards: [],
            seat: parseInt(seat, 10),
            stack,
            position: "",
          };
        } else {
          hand.players[name].stack = stack;
        }
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

  return hand;
}
