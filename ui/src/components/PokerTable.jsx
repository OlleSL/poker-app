import React, { useState, useEffect } from "react";
import "../css/PokerTable.css";
import avatar from "../assets/avatar.png";

const sampleHand = [
  { street: "preflop", player: "Goatshaver", action: "posts ante", amount: 1050 },
  { street: "preflop", player: "bajkee", action: "posts ante", amount: 1050 },
  { street: "preflop", player: "Goatshaver", action: "posts small blind", amount: 3500 },
  { street: "preflop", player: "bajkee", action: "posts big blind", amount: 7000 },
  { street: "preflop", action: "Dealt to bajkee [Qh Kh]" },
  { street: "preflop", player: "Goatshaver", action: "raises all-in", amount: 384598 },
  { street: "preflop", player: "bajkee", action: "calls all-in", amount: 46302 },
  { street: "flop", cards: ["7c", "2h", "9s"] },
  { street: "turn", cards: ["As"] },
  { street: "river", cards: ["7h"] },
  { street: "showdown", player: "bajkee", action: "shows", cards: ["Qh", "Kh"] },
  { street: "showdown", player: "Goatshaver", action: "shows", cards: ["9d", "Qs"] },
  { street: "result", action: "Goatshaver wins", amount: 108704 }
];

const suitSymbols = {
  h: "♥",
  d: "♦",
  s: "♠",
  c: "♣",
};

const initialPlayers = [
  { id: 1, name: "Goatshaver", stack: 384598, cards: ["??", "??"], seat: 0, position: "SB" },
  { id: 2, name: "bajkee", stack: 46302, cards: ["Qh", "Kh"], seat: 4, position: "BB" },
  { id: 3, name: "Player 3", stack: 28, cards: ["??", "??"], seat: 1.5, position: "LJ" },
  { id: 4, name: "Player 4", stack: 35, cards: ["??", "??"], seat: 2.5, position: "HJ" },
  { id: 5, name: "Player 5", stack: 55, cards: ["??", "??"], seat: 3.5, position: "CO" },
  { id: 6, name: "Player 6", stack: 40, cards: ["??", "??"], seat: 5, position: "BTN" },
  { id: 7, name: "Player 7", stack: 25, cards: ["??", "??"], seat: 6, position: "UTG" },
  { id: 8, name: "Player 8", stack: 20, cards: ["??", "??"], seat: 7, position: "UTG+1" },
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
  const [handIndex, setHandIndex] = useState(0);
  const [players, setPlayers] = useState(initialPlayers);
  const [pot, setPot] = useState(0);
  const [playerActions, setPlayerActions] = useState({});  // { "Goatshaver": "raises 384598" }



  function handleNext() {
    if (handIndex >= sampleHand.length - 1) {
      setIsPlaying(false); // ✅ stop auto-play at end
      return;
    }
  
    const next = handIndex + 1;
    const event = sampleHand[next];
  
    // Update stage
    if (event.street && event.street !== currentStage) {
      setCurrentStage(event.street);
    }
  
    // Track action
    if (event.player && event.action) {
      setPlayerActions((prev) => ({
        ...prev,
        [event.player]: `${event.action} ${event.amount || ""}`.trim(),
      }));
  
      if (event.amount) {
        setPot((prev) => prev + event.amount);
      }
    }
  
    setHandIndex(next);
    setPlayerActions({});
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
  }, [isPlaying, handIndex]);
  

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
          {players.map((player) => (
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

                {playerActions[player.name] && (
                  <div className="action-label">{playerActions[player.name]}</div>
                )}
              </div>

            </div>
          ))}

          <div className="community">
            {getVisibleCards().map((card, i) => (
              <React.Fragment key={i}>{renderCard(card)}</React.Fragment>
            ))}
          </div>

          <div className="pot">Pot: {pot} chips</div>

        <div className="current-action">
          {sampleHand[handIndex]?.action && (
            <p style={{ fontSize: "1.2rem", marginTop: "1rem", color: "#fff" }}>
              {sampleHand[handIndex].action}
            </p>
          )}
        </div>
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