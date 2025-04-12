import React, { useState, useEffect } from "react";
import "../css/PokerTable.css";
import avatar from "../assets/avatar.png";

const suitSymbols = {
  h: "♥",
  d: "♦",
  s: "♠",
  c: "♣",
};

const initialPlayers = [
  { id: 1, name: "Player 1", stack: 42, cards: ["??", "??"], seat: 0, position: "UTG" },
  { id: 2, name: "Player 2", stack: 30, cards: ["??", "??"], seat: 1, position: "UTG+1" },
  { id: 3, name: "Player 3", stack: 28, cards: ["??", "??"], seat: 2.5, position: "LJ" },
  { id: 4, name: "Player 4", stack: 35, cards: ["??", "??"], seat: 3, position: "HJ" },
  { id: 5, name: "You", stack: 55, cards: ["Ah", "Kd"], seat: 4, position: "CO" },
  { id: 6, name: "Player 6", stack: 40, cards: ["??", "??"], seat: 5, position: "BTN" },
  { id: 7, name: "Player 7", stack: 25, cards: ["??", "??"], seat: 6, position: "SB" },
  { id: 8, name: "Player 8", stack: 20, cards: ["??", "??"], seat: 7, position: "BB" },
];

const allCommunityCards = ["8c", "Qs", "7h", "Jh", "As"];
const stages = ["preflop", "flop", "turn", "river", "showdown"];

function renderCard(card) {
  if (card === "??") return <div className="card back">??</div>;
  const value = card.slice(0, -1);
  const suit = card.slice(-1);
  const isRed = suit === "h" || suit === "d";
  return (
    <div className="card" style={{ color: isRed ? "red" : "black" }}>
      {value}
      {suitSymbols[suit]}
    </div>
  );
}

export default function PokerTable() {
  const [currentStage, setCurrentStage] = useState("preflop");
  const [currentPlayerId, setCurrentPlayerId] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  function handleNext() {
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex < stages.length - 1) {
      setCurrentStage(stages[currentIndex + 1]);
    }
  }

  function handlePrev() {
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex > 0) {
      setCurrentStage(stages[currentIndex - 1]);
    }
  }

  function togglePlay() {
    setIsPlaying((prev) => !prev);
  }

  function jumpToStage(stage) {
    setCurrentStage(stage);
    setIsPlaying(false);
  }

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      handleNext();
    }, 2000);
    return () => clearInterval(interval);
  }, [isPlaying, currentStage]);

  function getVisibleCards() {
    if (currentStage === "preflop") return [];
    if (currentStage === "flop") return allCommunityCards.slice(0, 3);
    if (currentStage === "turn") return allCommunityCards.slice(0, 4);
    return allCommunityCards;
  }

  return (
    <div className="table-container">
      <div className="table-heading">
        <h1 className="title">Hand Replayer</h1>
        <a href="#" className="gto-link">Click here for GTO breakdown</a>
        <div className="underline"></div>
      </div>

      <div className="table-outer-ring">
        <div className="table">
          {initialPlayers.map((player) => (
            <div
              key={player.id}
              className={`seat seat-${Math.floor(player.seat)} ${
                player.id === currentPlayerId ? "active-player" : ""
              }`}
            >
              <div className="player">
                <div className="cards">
                  {player.cards.map((card, i) => (
                    <React.Fragment key={i}>{renderCard(card)}</React.Fragment>
                  ))}
                </div>
                <div className="player-info">
                  <img src={avatar} alt="avatar" className="avatar" />
                  <div className="name-stack">
                    <div className="name">{player.name}</div>
                    <div className="stack">{player.stack} BB</div>
                    <div className="position-tag">{player.position}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="community">
            {getVisibleCards().map((card, i) => (
              <React.Fragment key={i}>{renderCard(card)}</React.Fragment>
            ))}
          </div>

          <div className="pot">Pot: 24 BB</div>
        </div>
      </div>

      <div className="controls-wrapper">
        <div className="stage-selector">
          {stages.map((stage) => (
            <button
              key={stage}
              onClick={() => jumpToStage(stage)}
              className={`stage-button ${currentStage === stage ? "active-stage" : ""}`}
            >
              {stage.charAt(0).toUpperCase() + stage.slice(1)}
            </button>
          ))}
        </div>

        <div className="step-controls below-stage-buttons">
          <button onClick={handlePrev} className="step-button">⬅️</button>
          <button onClick={togglePlay} className="step-button">
            {isPlaying ? "⏸️" : "▶️"}
          </button>
          <button onClick={handleNext} className="step-button">➡️</button>
        </div>
      </div>
    </div>
  );
}