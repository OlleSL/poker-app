import React from "react";

export default function HandHistory({ hands, onTagChange }) {
  return (
    <section className="hand-history">
      <h3>Recent Hands</h3>
      <ul>
        {hands.map((hand, index) => (
          <li key={index}>
            {hand.text}
            <select
              value={hand.tag}
              onChange={(e) => onTagChange(index, e.target.value)}
              style={{ marginLeft: "1rem" }}
            >
              <option value="">Tag</option>
              <option value="Bluff">Bluff</option>
              <option value="Cooler">Cooler</option>
              <option value="Good Fold">Good Fold</option>
              <option value="Mistake">Mistake</option>
            </select>
            {hand.tag && <span style={{ marginLeft: "0.5rem" }}>🟢 {hand.tag}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
