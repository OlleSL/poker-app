import PokerSolver from "pokersolver";

const { Hand } = PokerSolver;

/** Convert HH card "Ah" / "Td" to pokersolver "Ah" / "Td". */
function toSolverCard(card) {
  if (!card || card === "??") return null;
  let rank = String(card).slice(0, -1).toUpperCase();
  const suit = String(card).slice(-1).toLowerCase();
  if (rank === "10") rank = "T";
  return `${rank}${suit}`;
}

/**
 * Best 5-card hand description for hole + board (Hold'em).
 * Returns null if not enough known cards.
 */
export function describeHoldEmHand(holeCards = [], boardCards = []) {
  const cards = [...holeCards, ...boardCards]
    .map(toSolverCard)
    .filter(Boolean);
  if (cards.length < 5) return null;
  try {
    const solved = Hand.solve(cards);
    return {
      name: solved.name,
      descr: solved.descr,
    };
  } catch {
    return null;
  }
}
