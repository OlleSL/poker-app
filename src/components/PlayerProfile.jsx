import React from "react";

export default function PlayerProfile({ name, ranking }) {
  return (
    <section className="profile">
      <h2>Player: {name}</h2>
      <p>Ranking: {ranking}</p>
    </section>
  );
}
