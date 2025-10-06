// utils/snapshot.js
export const STREETS = ["preflop", "flop", "turn", "river"];

export function buildSnapshot(hand, stage, actionIndex) {
  if (!hand) {
    return {
      pot: 0,
      visibleBets: {},
      foldsSet: new Set(),
      investedByPlayer: {},
      blindsMap: {},
    };
  }

  const potSeed = hand.anteTotal || 0;
  const investedByPlayer = {}; // total put in so far (all streets up to cursor)
  const streetInvested = {}; // per-street running amount for raise-to math
  const foldsSet = new Set();
  const visibleBets = {};
  let pot = potSeed;

  // include blinds once (preflop)
  const preflop = hand.actions?.preflop ?? [];
  const sb = preflop.find(
    (a) => a.action === "posts" && a.amount === hand.bigBlind / 2
  );
  const bb = preflop.find(
    (a) => a.action === "posts" && a.amount === hand.bigBlind
  );
  const blindsMap = {};
  if (sb) {
    pot += sb.amount;
    blindsMap[sb.player] = (blindsMap[sb.player] || 0) + sb.amount;
  }
  if (bb) {
    pot += bb.amount;
    blindsMap[bb.player] = (blindsMap[bb.player] || 0) + bb.amount;
  }

  // walk streets in order, stop at cursor
  for (const st of STREETS) {
    const acts = hand.actions[st] || [];
    streetInvested[st] = streetInvested[st] || {};

    const lastIdx =
      st === stage ? (actionIndex === -1 ? -1 : actionIndex) : acts.length - 1;

    for (let i = 0; i <= lastIdx; i++) {
      const a = acts[i];
      if (!a) continue;

      if (a.action === "folds") {
        foldsSet.add(a.player);
        continue;
      }

      if (a.action === "posts") {
        // we already seeded SB/BB to the pot; ignore further posts here
        continue;
      }

      if (a.action === "bets") {
        const amt = a.amount || 0;
        pot += amt;
        investedByPlayer[a.player] = (investedByPlayer[a.player] || 0) + amt;
        streetInvested[st][a.player] =
          (streetInvested[st][a.player] || 0) + amt;

        if (st === stage) visibleBets[a.player] = amt;
        continue;
      }

      if (a.action === "calls") {
        const amt = a.amount || 0;
        pot += amt;
        investedByPlayer[a.player] = (investedByPlayer[a.player] || 0) + amt;
        streetInvested[st][a.player] =
          (streetInvested[st][a.player] || 0) + amt;

        if (st === stage) {
          visibleBets[a.player] = (visibleBets[a.player] || 0) + amt;
        }
        continue;
      }

      if (a.action === "raises") {
        // HH "raises to X": we add only the increment beyond what this player has in this street
        const toAmt = a.amount || 0;
        const already = streetInvested[st][a.player] || 0;
        const inc = Math.max(0, toAmt - already);

        pot += inc;
        investedByPlayer[a.player] = (investedByPlayer[a.player] || 0) + inc;
        streetInvested[st][a.player] = toAmt;

        if (st === stage) visibleBets[a.player] = toAmt;
        continue;
      }
    }

    if (st === stage) break;
  }

  // preflop neutral state: show blinds as the visible bets
  if (stage === "preflop" && actionIndex === -1) {
    return {
      pot,
      visibleBets: blindsMap,
      foldsSet,
      investedByPlayer,
      blindsMap,
    };
  }

  return { pot, visibleBets, foldsSet, investedByPlayer, blindsMap };
}
