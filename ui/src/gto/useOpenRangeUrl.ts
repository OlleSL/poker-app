// src/gto/useOpenRangeUrl.ts
import { useEffect, useState } from "react";
import { resolveOpenRfiUrl } from "./resolveOpenRfi";

export function useOpenRangeUrl(hand: any, stage: "preflop"|"flop"|"turn"|"river") {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hand || stage !== "preflop") { setUrl(null); return; }
      const u = await resolveOpenRfiUrl(hand);
      if (!cancelled) setUrl(u);
    })();
    return () => { cancelled = true; };
  }, [hand, stage]);

  return url;
}
