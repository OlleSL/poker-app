import React, { useEffect, useState } from "react";
import "../css/GtoPanel.css";

export function GtoPanel({ open, onClose, url }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    // reset error when URL changes or panel opens
    setImgError(false);
  }, [url, open]);

  if (!open) return null;

  return (
    <div className="gto-overlay" onClick={onClose}>
      <aside className="gto-panel" onClick={(e) => e.stopPropagation()}>
        <header className="gto-header">
          <div className="gto-title">GTO Breakdown</div>
          <button className="gto-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="gto-content">
          {url && !imgError ? (
            <img
              className="gto-image"
              src={url}
              alt="GTO range"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="gto-empty">No matching range for this spot.</div>
          )}
        </div>
      </aside>
    </div>
  );
}
