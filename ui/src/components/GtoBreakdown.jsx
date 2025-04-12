import React from "react";
import { Link } from "react-router-dom";
// import "../css/PokerTable.css";

export default function GtoBreakdown() {
  return (
    <div className="gto-breakdown-page">
      <h1 style={{ color: "white" }}>GTO Breakdown</h1>
      <p style={{ color: "#ccc" }}>
        This is where your strategy breakdown will go. You can display charts, EV comparisons, or tagged hand analysis here.
      </p>
      <Link to="/" className="gto-link">← Back to Table</Link>
    </div>
  );
}
