// src/gto/rangeMap.ts
export const rangeMap: Record<string, string> = {
  // Heads-up, BTN opens
  "HU_BTN_open_8bb":  "/ranges/hu/btn/open_8bb.png",
  "HU_BTN_open_10bb": "/ranges/hu/btn/open_10bb.png",
  "HU_BTN_open_12bb": "/ranges/hu/btn/open_12bb.png",
  "HU_BTN_open_15bb": "/ranges/hu/btn/open_15bb.png",
  "HU_BTN_open_20bb": "/ranges/hu/btn/open_20bb.png",
  "HU_BTN_open_25bb": "/ranges/hu/btn/open_25bb.png",

  // BB vs BTN facing
  "HU_BB_vsBTN_limp_10bb":  "/ranges/hu/bb/iso_vs_limp_10bb.png",
  "HU_BB_vsBTN_raise_10bb": "/ranges/hu/bb/def_vs_mino_10bb.png",
  "HU_BB_vsBTN_shove_10bb": "/ranges/hu/bb/call_vs_jam_10bb.png",

  // Example 6-max placeholder
  "6max_BB_vs_BTN_raise_20bb": "/ranges/6max/bb/def_vs_btn_20bb.png",
};

export function lookupRangeImage(key: string): string | null {
  if (rangeMap[key]) return rangeMap[key];
  // relax buckets (e.g., fall back to nearest lower bucket)
  const m = key.match(/(.+_) (\d+)bb$/);
  if (!m) return null;
  const prefix = m[1];
  const want   = parseInt(m[2], 10);
  const candidates = Object.keys(rangeMap)
    .filter(k => k.startsWith(prefix))
    .map(k => ({ k, bb: parseInt(k.replace(/^.*_(\d+)bb$/, "$1"), 10) }))
    .sort((a,b) => b.bb - a.bb); // high → low
  const fallback = candidates.find(c => c.bb <= want) || candidates[candidates.length-1];
  return fallback ? rangeMap[fallback.k] : null;
}
