import React from "react";
import Card from "@heruka_urgyen/react-playing-cards/lib/TcN";

/**
 * Normalize HH card codes like "Ah", "Td", "10s" to library format (rank+suit).
 */
export function toCardCode(card) {
  if (!card || card === "??") return null;
  let rank = String(card).slice(0, -1).toUpperCase();
  const suit = String(card).slice(-1).toLowerCase();
  if (rank === "10") rank = "T";
  if (!["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"].includes(rank)) {
    return null;
  }
  if (!["c", "d", "h", "s"].includes(suit)) return null;
  return `${rank}${suit}`;
}

/**
 * Playing-card face using public SVG deck (Adrian Kennard / CC0 via react-playing-cards).
 */
export default function PokerCard({
  card,
  faceDown = false,
  height = 58,
  className = "",
  animate = true,
}) {
  const code = toCardCode(card);
  const showBack = faceDown || !code;

  return (
    <span
      className={`poker-svg-card${animate ? " poker-svg-card--deal" : ""}${className ? ` ${className}` : ""}`}
      style={{ height, display: "inline-flex", verticalAlign: "middle" }}
    >
      <Card
        card={code || "As"}
        height={`${height}px`}
        back={showBack}
      />
    </span>
  );
}
