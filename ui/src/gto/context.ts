// src/gto/context.ts
export type Street = "preflop" | "flop" | "turn" | "river";

export type HandContext = {
  table: "7max" | "6max" | "HU";
  stage: Street;
  heroPos?: "UTG" | "MP" | "HJ" | "CO" | "BTN" | "SB" | "BB";
  stackBB: number;
  stackBucket: "8bb" | "10bb" | "12bb" | "15bb" | "20bb" | "25bb";
};

// bucket rules for your images
export function toBucket(bb: number): HandContext["stackBucket"] {
  if (bb <= 9)  return "8bb";
  if (bb <= 11) return "10bb";
  if (bb <= 13) return "12bb";
  if (bb <= 17) return "15bb";
  if (bb <= 22) return "20bb";
  return "25bb";
}

export function extractContext(parsedHand: any, stage: Street = "preflop"): HandContext {
  const players: any[] = Object.values(parsedHand?.players || {});
  const table: "7max" | "6max" | "HU" =
    players.length <= 2 ? "HU" : (players.length === 7 ? "7max" : "6max");

  // hero (your parser already attaches .hero and .position)
  const hero = players.find((p: any) => p && p.hero);
  const heroPos = hero?.position as HandContext["heroPos"];

  // effective stack in BB – minimum stack among seated players
  const bb = parsedHand?.bigBlind || 1;
  const effChips = Math.min(...players.map((p: any) => Number(p.stack) || 0));
  const stackBB = Math.max(1, Math.round(effChips / bb));

  return { table, stage, heroPos, stackBB, stackBucket: toBucket(stackBB) };
}
