// src/gto/scenario.ts
export type HandLike = {
  bigBlind: number;
  players: Record<string, { name: string; seat: number; stack: number; hero?: boolean; position?: string }>;
  actions: {
    preflop?: Array<{ player: string; action: "posts"|"bets"|"calls"|"raises"|"folds"|"checks"; amount?: number }>;
  };
  button?: number;
};

type Scenario = {
  key: string;            // e.g. "HU_BTN_open_20bb"
  effBB: number;          // bucketed
  meta: {
    players: number;
    heroPos: "BTN"|"SB"|"BB"|"UTG"|"MP"|"CO"|"HJ"|"EP"|"Unknown";
    facing: "none"|"limp"|"raise"|"shove";
  };
};

const BUCKETS = [8,10,12,15,20,25,30,40];

function bucketBB(bb: number) {
  for (let i = 0; i < BUCKETS.length; i++) {
    const b = BUCKETS[i];
    const next = BUCKETS[i+1];
    if (!next) return b;
    if (bb <= (b + next) / 2) return b;
  }
  return BUCKETS[BUCKETS.length-1];
}

function countActivePlayers(players: Record<string, any>) {
  return Object.keys(players || {}).length;
}

function getHero(players: Record<string, any>) {
  const arr = Object.values(players || {});
  return arr.find(p => p.hero) || arr[0]; // fallback
}

function posOf(name: string, players: Record<string, any>) {
  const p = Object.values(players || {}).find(x => x.name === name);
  return (p?.position as Scenario["meta"]["heroPos"]) || "Unknown";
}

function effectiveStackBB(heroName: string, villainName: string | null, hand: HandLike) {
  const hero = Object.values(hand.players).find(p => p.name === heroName);
  const vil  = villainName ? Object.values(hand.players).find(p => p.name === villainName) : null;
  const eff  = vil ? Math.min(hero?.stack ?? 0, vil?.stack ?? 0) : (hero?.stack ?? 0);
  const bb   = Math.max(1, hand.bigBlind || 1);
  return eff / bb;
}

export function detectPreflopScenario(hand: HandLike): Scenario | null {
  if (!hand?.actions?.preflop) return null;

  const playersN = countActivePlayers(hand.players);
  const hero     = getHero(hand.players);
  const heroPos  = posOf(hero.name, hand.players);
  const pre      = hand.actions.preflop!.filter(a => a.action !== "posts");

  // determine who acts first and what hero faces
  // Heads-Up shortcuts
  if (playersN === 2) {
    // HU positions are BTN (posts SB) and BB
    // Find first non-post action
    const first = pre[0];
    // Who is hero's opponent (first action often defines facing)
    const villainName = Object.values(hand.players).find(p => p.name !== hero.name)?.name || null;
    const eff = bucketBB( effectiveStackBB(hero.name, villainName, hand) );

    // What is hero facing on hero's decision?
    // If hero is BTN: hero acts first preflop unless limp/open encoded as hero's action.
    if (heroPos === "BTN" || heroPos === "SB") {
      // If hero acts first, facing "none". If first is villain, hero faces something.
      if (!first || first.player === hero.name) {
        // it's on hero to decide first action (open/limp/shove)
        return { key: `HU_BTN_open_${eff}bb`, effBB: eff, meta: { players: 2, heroPos: "BTN", facing: "none" } };
      } else {
        // Villain acted first—unusual in HU but handle anyway
        const facing = first.action === "raises" && (first.amount ?? 0) >= (hand.bigBlind * 10) ? "shove"
                      : first.action === "raises" ? "raise"
                      : first.action === "checks" ? "none"
                      : first.action === "calls"  ? "limp"
                      : first.action === "bets"   ? "raise"
                      : "none";
        return { key: `HU_BTN_vsBB_${facing}_${eff}bb`, effBB: eff, meta: { players: 2, heroPos: "BTN", facing } };
      }
    }

    // Hero is BB (defending vs BTN)
    if (heroPos === "BB") {
      // Find BTN’s first real action
      const btnName = Object.values(hand.players).find(p => p.position === "BTN" || p.position === "SB")?.name;
      const btnAct  = pre.find(a => a.player === btnName);
      const facing  = !btnAct ? "none"
                    : (btnAct.action === "calls" ? "limp"
                    : btnAct.action === "raises"
                        ? ((btnAct.amount ?? 0) >= (hand.bigBlind * 10) ? "shove" : "raise")
                    : btnAct.action === "bets" ? "raise"
                    : "none");
      return { key: `HU_BB_vsBTN_${facing}_${eff}bb`, effBB: eff, meta: { players: 2, heroPos: "BB", facing } };
    }
  }

  // 3–7 handed (expand later)
  // Minimal: treat first raiser position vs hero position
  const first = pre[0];
  const villainName = first?.player || null;
  const eff = bucketBB( effectiveStackBB(hero.name, villainName, hand) );
  const facing =
    !first ? "none"
    : first.player === hero.name ? "none"
    : first.action === "calls" ? "limp"
    : first.action === "raises" && (first.amount ?? 0) >= (hand.bigBlind * 10) ? "shove"
    : first.action === "raises" ? "raise"
    : "none";

  // Example generic multiway key:
  return {
    key: `6max_${heroPos}_vs_${(posOf(villainName||"", hand.players))}_${facing}_${eff}bb`,
    effBB: eff,
    meta: { players: playersN as any, heroPos, facing }
  };
}
