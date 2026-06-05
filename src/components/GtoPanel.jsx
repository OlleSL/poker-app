import React, { useEffect, useMemo, useState } from "react";
import "../css/GtoPanel.css";

export function GtoPanel({ open, onClose, url, inferredPosition, inferredBb }) {
  const [imgError, setImgError] = useState(false);

  // Derive pos+bb from props or fallback to parsing the URL path
  const { posLabel, bbLabel, raiseAmount } = useMemo(() => {
    let pos = inferredPosition || null;
    let bb = inferredBb || null;

    if ((!pos || !bb) && typeof url === "string") {
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

    // Calculate raise amount based on stack depth and position
    let raiseAmt = null;
    if (bb && pos) {
      // Special sizing for SB RFI (when folded to)
      if (pos === "SB") {
        if (bb >= 30) {
          raiseAmt = "3.2 BB";
        } else if (bb >= 20) {
          raiseAmt = "3.0 BB";
        } else {
          raiseAmt = "2.3 BB";
        }
      } else {
        // Standard sizing for other positions
        if (bb >= 80) {
          raiseAmt = "2.5 BB";
        } else if (bb >= 30) {
          raiseAmt = "2.3 BB";
        } else {
          raiseAmt = "2.0 BB";
        }
      }
    }

    return { posLabel: posText, bbLabel: bbText, raiseAmount: raiseAmt };
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
              <span className="gto-chip">Spot: RFI {raiseAmount ? `(${raiseAmount})` : "(Open-raise)"}</span>
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
                <span className="swatch swatch-green" /> Call
                <span className="legend-sep">•</span>
                <span className="swatch swatch-wine" /> All-in / Jam
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

        <footer className="gto-footer">
          <div style={{ 
            padding: "8px 16px", 
            fontSize: 10, 
            color: "#aaa", 
            textAlign: "center",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            backgroundColor: "rgba(0, 0, 0, 0.2)"
          }}>
            <strong style={{ color: "#ccc" }}>Range Limitations:</strong> Currently supports preflop RFI ranges only. 
            Available stack depths: 15BB, 20BB, 25BB, 30BB, 40BB, 50BB, 60BB, 80BB, 100BB.
          </div>
        </footer>
      </aside>
    </div>
  );
}
