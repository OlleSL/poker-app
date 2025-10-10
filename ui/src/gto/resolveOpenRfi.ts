// ui/src/gto/resolveOpenRfi.ts

type Pos = "UTG" | "LJ" | "HJ" | "CO" | "BTN" | "SB";
const POSITIONS = ["UTG", "LJ", "HJ", "CO", "BTN", "SB"] as const;

// Show opener RFI even if not strictly first-in (limp before raise, etc.)
const FALLBACK_SHOW_OPENER_RFI_WHEN_NOT_FIRST_IN = true;

// Canonical stacks you actually have on disk
const TYPICAL_BBS = [15, 20, 25, 30, 40, 50, 60, 80, 100];

/* ----------------------------- URL helpers ----------------------------- */
function withBase(p: string) {
  const base = (import.meta as any).env?.BASE_URL || "/";
  return (base.replace(/\/+$/, "") + "/" + p.replace(/^\/+/, "")).replace(/\/{2,}/g, "/");
}

// Best-effort HEAD check (may be blocked in dev)
async function head(url: string) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

/* ----------------------------- Position map ---------------------------- */
function mapPosition(raw: string): Pos | null {
  const up = String(raw || "").toUpperCase();
  const aliases: Record<string, Pos> = {
    MP: "LJ",
    "UTG+1": "LJ",
    EP: "UTG",
    UTG2: "LJ",
    UTG3: "HJ",
  };
  const mapped = (aliases[up] as Pos) || (up as Pos);
  return (POSITIONS as readonly string[]).includes(mapped) ? mapped : null;
}

/* ----------------------------- RFI derivation -------------------------- */
export function deriveOpenRfi(hand: any): { pos: Pos; effBB: number } | null {
  if (!hand?.actions?.preflop?.length) return null;

  const pre = (hand.actions.preflop as any[]).filter((a) => a?.action !== "posts");
  if (!pre.length) return null;

  const firstRaiseIdx = pre.findIndex((a) => a?.action === "raises");
  if (firstRaiseIdx < 0) return null;

  const before = pre.slice(0, firstRaiseIdx);
  const someoneEntered = before.some((a) => a?.action === "calls" || a?.action === "raises");

  const openerName = pre[firstRaiseIdx]?.player;
  if (!openerName) return null;

  const playersObj = (hand.players ?? {}) as Record<string, any>;
  const opener =
    Object.values(playersObj).find((p) => p?.name === openerName) ?? playersObj[openerName];
  if (!opener) return null;

  const pos = mapPosition(opener.position);
  if (!pos) return null;

  const bbSize = Math.max(1, Number(hand.bigBlind) || 1);
  const stacks = Object.values(playersObj)
    .map((p: any) => Number(p?.stack) || 0)
    .filter((n) => Number.isFinite(n) && n >= 0);
  const tableMin = stacks.length ? Math.min(...stacks) : Number(opener?.stack) || 0;
  const eff = Math.round(Math.min(Number(opener?.stack) || 0, tableMin) / bbSize);

  if (someoneEntered && !FALLBACK_SHOW_OPENER_RFI_WHEN_NOT_FIRST_IN) return null;

  return { pos, effBB: eff };
}

/* ----------------------------- Filename probing ------------------------ */
function nearestBucket(target: number, avail = TYPICAL_BBS) {
  let best = avail[0], bestD = Math.abs(avail[0] - target);
  for (const x of avail) {
    const d = Math.abs(x - target);
    if (d < bestD || (d === bestD && x > best)) { best = x; bestD = d; }
  }
  return best;
}

function buildCandidates(pos: Pos, bb: number): string[] {
  const P = pos;
  const p = pos.toLowerCase();
  const B = `${bb}BB`;

  const variants = [
    // Foldered simple (your normalized layout)
    `ranges/Main/7Max/open/${P}/${B}.png`,
    `ranges/Main/7Max/open/${p}/${B}.png`,

    // If verbose names slipped in
    `ranges/Main/7Max/open/${P}/${B}_${P}_RFI.png`,
    `ranges/Main/7Max/open/${P}/${B}_${P}.png`,
    `ranges/Main/7Max/open/${p}/${B}_${P}_RFI.png`,
    `ranges/Main/7Max/open/${p}/${B}_${P}.png`,

    // Flat variants (in case all files were dropped in one folder)
    `ranges/Main/7Max/open/${B}_${P}_RFI.png`,
    `ranges/Main/7Max/open/${B}_${P}.png`,
    `ranges/Main/7Max/open/${P}_${B}.png`,
  ];

  return Array.from(new Set(variants.map(withBase)));
}

/* ----------------------------- Resolve URL ----------------------------- */
export async function resolveOpenRfiUrl(hand: any): Promise<string | null> {
  const ctx = deriveOpenRfi(hand);
  if (!ctx) return null;

  // 1) Try to probe known patterns for nearest canonical bucket
  const bbNearest = nearestBucket(ctx.effBB);
  const urls = buildCandidates(ctx.pos, bbNearest);
  for (const u of urls) {
    if (await head(u)) return u; // great, confirmed
  }

  // 2) If HEAD is blocked by the dev server, just return the *canonical* simple path.
  //    This will exist if your folder is: /public/ranges/Main/7Max/open/<POS>/<BB>BB.png
  const simple = withBase(`ranges/Main/7Max/open/${ctx.pos}/${bbNearest}BB.png`);
  return simple;
}
