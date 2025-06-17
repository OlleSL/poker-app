import React, { useState, useEffect } from "react";
import { parseRedDragonHands } from "../utils/parser";
import "../css/PokerTable.css";
import avatar from "../assets/avatar.png";
import { Link } from "react-router-dom";

const suitSymbols = {
  h: "♥",
  d: "♦",
  s: "♠",
  c: "♣",
}; 

const initialPlayers = [];

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
  const [hands, setHands] = useState([]);
  const [currentHandIndex, setCurrentHandIndex] = useState(0);
  const [currentStage, setCurrentStage] = useState("preflop");
  const [currentPlayerId, setCurrentPlayerId] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);

  const parsedHand = hands[currentHandIndex] || null;

  const dynamicPlayers = Object.values(parsedHand?.players || {});

  function handleNext() {
    if (!parsedHand) return;

    const stageActions = parsedHand.actions[currentStage] || [];

    if (currentActionIndex < stageActions.length - 1) {
      setCurrentActionIndex((prev) => prev + 1);
    } else {
      const currentIndex = stages.indexOf(currentStage);
      if (currentIndex < stages.length - 1) {
        setCurrentStage(stages[currentIndex + 1]);
        setCurrentActionIndex(0);
      }
    }
  }

  function handlePrev() {
    if (!parsedHand) return;

    if (currentActionIndex > 0) {
      setCurrentActionIndex((prev) => prev - 1);
    } else {
      const currentIndex = stages.indexOf(currentStage);
      if (currentIndex > 0) {
        const prevStage = stages[currentIndex - 1];
        const prevStageActions = parsedHand.actions[prevStage] || [];
        setCurrentStage(prevStage);
        setCurrentActionIndex(prevStageActions.length - 1);
      }
    }
  }

  function hasPlayerFolded(playerName) {
    if (!parsedHand) return false;

    let folded = false;


    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const actions = parsedHand.actions[stage] || [];

      for (let j = 0; j < actions.length; j++) {
        // Stop at current stage and current action index
        if (i === stages.indexOf(currentStage) && j >= currentActionIndex) {
          return folded;
        }

        const act = actions[j];
        if (act.player === playerName && act.action === "folds") {
          folded = true;
        }
      }
    }

    return folded;
  }


  function togglePlay() {
    setIsPlaying((prev) => !prev);
  }

  function jumpToStage(stage) {
    setCurrentStage(stage);
    setCurrentActionIndex(0);
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
    if (!parsedHand) return [];

    const board = parsedHand.board;

    if (currentStage === "preflop") return [];
    if (currentStage === "flop") return board.slice(0, 3);
    if (currentStage === "turn") return board.slice(0, 4);
    return board;
  }

  return (
    <div className="poker-wrapper">
      <div className="table-container">
        <div className="table-heading">
          <h1 className="title">Hand Replayer</h1>

          <input
            type="file"
            accept=".txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (e) => {
                const content = e.target.result;
                const parsedHands = parseRedDragonHands(content);
                setHands(parsedHands);
                setCurrentHandIndex(0);
                setCurrentStage("preflop");
                setCurrentActionIndex(0);
                setIsPlaying(false);
              };
              reader.readAsText(file);
            }}
            style={{ marginBottom: "1rem" }}
          />

          <textarea
            rows={8}
            cols={80}
            placeholder="Paste hand history here..."
            onChange={(e) => {
              const parsedHands = parseRedDragonHands(e.target.value);
              setHands(parsedHands);
              setCurrentHandIndex(0);
              setCurrentStage("preflop");
              setCurrentActionIndex(0);
              setIsPlaying(false);
            }}
            style={{ marginTop: "1rem", padding: "0.5rem", fontFamily: "monospace", width: "100%" }}
          />

          <Link to="/gto" className="gto-link">Click here for GTO breakdown</Link>
          <div className="underline"></div>
        </div>

        <div className="table-outer-ring">
          <div className="table">
            {dynamicPlayers.map((player) => {
              const currentAction = parsedHand?.actions[currentStage]?.[currentActionIndex];
              const isActing = currentAction?.player === player.name;

              return (
                <div
                  key={player.id}
                  className={`seat seat-${Math.floor(player.seat)} ${
                    player.id === currentPlayerId ? "active-player" : ""
                  } ${
                    parsedHand?.actions[currentStage]?.[currentActionIndex]?.player === player.name
                      ? "acting-player"
                      : ""
                  } ${hasPlayerFolded(player.name) ? "folded" : ""}`}
                >
                  <div className="player">
                    <div className="cards">
                      {player.cards.length > 0
                        ? player.cards.map((card, i) => (
                            <React.Fragment key={i}>{renderCard(card)}</React.Fragment>
                          ))
                        : [0, 1].map((_, i) => (
                            <div className="card back" key={i}>🂠</div>
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
              );
            })}

            <div className="community">
              {getVisibleCards().map((card, i) => (
                <React.Fragment key={i}>{renderCard(card)}</React.Fragment>
              ))}
            </div>

            {parsedHand && (() => {
              const current = parsedHand.actions[currentStage]?.[currentActionIndex];
              if (current?.amount && ["bets", "raises", "calls"].includes(current.action)) {
                return (
                  <div className="chip-animation">
                    💰 {current.amount}
                  </div>
                );
              }
              return null;
            })()}

            {parsedHand && (
              <div className="current-action" style={{ textAlign: "center", marginBottom: "1rem" }}>
                {(() => {
                  const stageActions = parsedHand.actions[currentStage];
                  if (!stageActions || stageActions.length === 0) return null;
                  const current = stageActions[currentActionIndex] || {};
                  return (
                    <p>
                      <strong>{current?.player}</strong>: {current?.action}
                      {current?.amount ? ` ${current.amount} chips` : ""}
                    </p>
                  );
                })()}
              </div>
            )}

            <div className="pot">
              Pot: {parsedHand?.totalPot ? `${parsedHand.totalPot} chips` : "24 BB"}
            </div>
          </div>
        </div>

        <div className="controls-wrapper">
          {/* Stage Controls (⬅️ ⏸️ ➡️) */}
          <div className="stage-controls">
            <button onClick={handlePrev} className="step-button">⬅️</button>
            <button onClick={togglePlay} className="step-button">
              {isPlaying ? "⏸️" : "▶️"}
            </button>
            <button onClick={handleNext} className="step-button">➡️</button>
          </div>

          {/* Hand Navigation (⏮️ ⏭️) */}
          <div className="hand-controls">
            <button
              onClick={() => {
                if (currentHandIndex > 0) {
                  setCurrentHandIndex(currentHandIndex - 1);
                  setCurrentStage("preflop");
                  setCurrentActionIndex(0);
                  setIsPlaying(false);
                }
              }}
              className="step-button"
            >
              ⏮️
            </button>
            <span className="hand-counter">
              Hand {currentHandIndex + 1} of {hands.length}
            </span>
            <button
              onClick={() => {
                if (currentHandIndex < hands.length - 1) {
                  setCurrentHandIndex(currentHandIndex + 1);
                  setCurrentStage("preflop");
                  setCurrentActionIndex(0);
                  setIsPlaying(false);
                }
              }}
              className="step-button"
            >
              ⏭️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}