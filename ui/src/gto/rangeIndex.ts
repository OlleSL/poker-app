// src/gto/rangeIndex.ts
type Table = "7max" | "6max" | "HU";
type Pos = "UTG"|"MP"|"HJ"|"CO"|"BTN"|"SB"|"BB";
type Bucket = "8bb"|"10bb"|"12bb"|"15bb"|"20bb"|"25bb";

export type Ctx = {
  table: Table;
  heroPos?: Pos;
  stackBucket: Bucket;
};

// Only open-raise charts for now (your images live under /public)
export function rangeKey(ctx: Ctx) {
  return `/ranges/Main/${ctx.table}/open/${ctx.heroPos}/${ctx.stackBucket}.png`;
}

// HEAD-check a candidate URL
async function head(url: string) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

export async function resolveRangeUrl(ctx: Ctx): Promise<string|null> {
  // Try exact bucket first, then fall back down, then up
  const order: Bucket[] = ["8bb","10bb","12bb","15bb","20bb","25bb"];
  const want = ctx.stackBucket;
  const wantIdx = order.indexOf(want);

  // exact
  {
    const url = rangeKey(ctx);
    if (await head(url)) return url;
  }
  // down
  for (let i = wantIdx - 1; i >= 0; i--) {
    const url = rangeKey({ ...ctx, stackBucket: order[i] });
    if (await head(url)) return url;
  }
  // up
  for (let i = wantIdx + 1; i < order.length; i++) {
    const url = rangeKey({ ...ctx, stackBucket: order[i] });
    if (await head(url)) return url;
  }
  return null;
}
