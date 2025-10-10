import React, { useEffect, useMemo, useState } from "react";
import "../css/GtoPanel.css";

export function GtoPanel({ open, onClose, url, inferredPosition, inferredBb }) {
  const [imgError, setImgError] = useState(false);

  // Derive pos+bb from props or fallback to parsing the URL path
  const { posLabel, bbLabel } = useMemo(() => {
    let pos = inferredPosition || null;
    let bb = inferredBb || null;

    if ((!pos || !bb) && typeof url === "string") {
      // Try to parse /ranges/Main/7max/open/BTN/30BB.png
      const m = url.match(/\/open\/([A-Za-z]+)\/(\d+)BB\.png$/i);
      if (m) {
        pos = pos || m[1].toUpperCase();
        bb = bb || Number(m[2]);
      }
    }

    // Human-friendly position label
    const posMap = {
      UTG: "Under the Gun",
      LJ: "Lojack",
      HJ: "Hijack",
      CO: "Cutoff",
      BTN: "Button",
      SB: "Small Blind",
      BB: "Big Blind",
    };
    const posText = pos ? `${posMap[pos] || pos} (${pos})` : null;
    const bbText = bb ? `${bb} BB (effective)` : null;

    return { posLabel: posText, bbLabel: bbText };
  }, [url, inferredPosition, inferredBb]);

  useEffect(() => {
    setImgError(false);
  }, [url, open]);

  if (!open) return null;

  return (
    <div className="gto-overlay" onClick={onClose}>
      <aside className="gto-panel" onClick={(e) => e.stopPropagation()}>
        <header className="gto-header">
          <div className="gto-title">
            GTO Breakdown
            <div className="gto-subtitle">
              <span className="gto-chip">Spot: Open-raise</span>
              {posLabel && (
                <>
                  <span className="legend-sep">•</span>
                  <span className="gto-chip">Position: {posLabel}</span>
                </>
              )}
              {bbLabel && (
                <>
                  <span className="legend-sep">•</span>
                  <span className="gto-chip">Stack: {bbLabel}</span>
                </>
              )}
            </div>
          </div>
          <button className="gto-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="gto-content">
          {!url || imgError ? (
            <div className="gto-empty">No matching range for this spot.</div>
          ) : (
            <>
              <div className="gto-legend" aria-label="Legend">
                <span className="swatch swatch-red" /> Raise / Open
                <span className="legend-sep">•</span>
                <span className="swatch swatch-blue" /> Fold
              </div>

              <img
                className="gto-image"
                src={url}
                alt={`GTO range — ${posLabel || "Unknown position"} • ${bbLabel || "Unknown stack"}`}
                onError={() => setImgError(true)}
              />

              {/* <div className="gto-caption">
                GTO range — {posLabel || "Position"} • {bbLabel || "Stack"}
              </div> */}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
