// ui/src/gto/openRanges.ts
type Pos = "UTG" | "LJ" | "HJ" | "CO" | "BTN" | "SB";

let _indexPromise: Promise<Record<Pos, number[]>> | null = null;

export function loadOpenIndex(): Promise<Record<Pos, number[]>> {
  if (!_indexPromise) {
    _indexPromise = fetch("/ranges/Main/7Max/open/index.json")
      .then(r => r.ok ? r.json() : Promise.reject(new Error("index.json not found")));
  }
  return _indexPromise;
}

export function openRangeUrl(pos: Pos, bb: number) {
  return `/ranges/Main/7Max/open/${pos}/${bb}BB.png`;
}

// choose nearest by absolute diff; ties -> larger bb (safer for opens)
export function nearestBB(target: number, avail: number[]) {
  if (!avail?.length) return null;
  if (avail.includes(target)) return target;
  let best = avail[0], bestD = Math.abs(avail[0] - target);
  for (const x of avail) {
    const d = Math.abs(x - target);
    if (d < bestD || (d === bestD && x > best)) { best = x; bestD = d; }
  }
  return best;
}

// Fallback if no index.json: probe a typical set quickly
const TYPICAL_BBS = [15,20,25,30,40,50,60,80,100] as const;
async function head(url: string) {
  try { const r = await fetch(url, { method: "HEAD" }); return r.ok; }
  catch { return false; }
}

export async function resolveOpenUrl(pos: Pos, effBB: number): Promise<string | null> {
  // Try using index.json (preferred)
  try {
    const idx = await loadOpenIndex();
    const avail = idx[pos];
    if (avail?.length) {
      const bb = nearestBB(Math.round(effBB), avail);
      return bb ? openRangeUrl(pos, bb) : null;
    }
  } catch { /* fall through to probing */ }

  // Fallback: probe typical set around the target (nearest-first ordering)
  const target = Math.round(effBB);
  const order = [...TYPICAL_BBS].sort((a,b) => {
    const da = Math.abs(a - target), db = Math.abs(b - target);
    if (da !== db) return da - db;
    return b - a; // prefer larger on tie
  });
  for (const bb of order) {
    const url = openRangeUrl(pos, bb);
    if (await head(url)) return url;
  }
  return null;
}
