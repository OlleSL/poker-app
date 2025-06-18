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

    const actions = parsedHand.actions[currentStage] || [];

    // 🧭 Initial step from neutral state
    if (currentActionIndex === -1) {
      const first = getFirstActionIndex(currentStage);
      setCurrentActionIndex(first);
      return;
    }

    let newIndex = currentActionIndex + 1;

    // ⏩ Skip "posts"
    while (newIndex < actions.length && actions[newIndex].action === "posts") {
      newIndex++;
    }

    // ✅ Still more actions in this stage
    if (newIndex < actions.length) {
      setCurrentActionIndex(newIndex);
      return;
    }

    // 🌊 Try to move to next stage
    const currentIndex = stages.indexOf(currentStage);
    for (let i = currentIndex + 1; i < stages.length; i++) {
      const nextStage = stages[i];
      const nextActions = parsedHand.actions[nextStage] || [];
      const nextIndex = getFirstActionIndex(nextStage);

      if (nextIndex < nextActions.length) {
        setCurrentStage(nextStage);
        setCurrentActionIndex(nextIndex);
        return;
      }
    }

    // 🛑 No more actions → freeze at last state
    return;
  }


  function getFirstActionIndex(stage) {
    const actions = parsedHand?.actions[stage] || [];
    for (let i = 0; i < actions.length; i++) {
      if (actions[i].action !== "posts") return i;
    }
    return 0;
  }

  function handlePrev() {
    if (!parsedHand) return;

    const actions = parsedHand.actions[currentStage] || [];

    // 🌟 Handle transition to neutral state if we're at first action
    if (currentActionIndex === getFirstActionIndex(currentStage)) {
      setCurrentActionIndex(-1);
      return;
    }

    let newIndex = currentActionIndex - 1;

    // ⏪ Skip "posts"
    while (newIndex >= 0 && actions[newIndex].action === "posts") {
      newIndex--;
    }

    if (newIndex >= 0) {
      setCurrentActionIndex(newIndex);
    } else {
      // 🌀 Go to previous stage if possible
      const currentIndex = stages.indexOf(currentStage);
      for (let i = currentIndex - 1; i >= 0; i--) {
        const prevStage = stages[i];
        const prevActions = parsedHand.actions[prevStage] || [];
        const lastValid = prevActions.map(a => a.action).lastIndexOf("posts") + 1;

        const lastAction = prevActions.slice(0, lastValid).findLastIndex(a => a.action !== "posts");

        if (lastAction >= 0) {
          setCurrentStage(prevStage);
          setCurrentActionIndex(lastAction);
          return;
        }
      }

      // 🧼 If fully rewound, go neutral
      setCurrentActionIndex(-1);
      setCurrentStage("preflop");
    }
  }



  function hasPlayerFolded(playerName) {
    if (currentActionIndex === -1) return false;

    if (!parsedHand) return false;

    const currentStageIndex = stages.indexOf(currentStage);
    let folded = false;

    for (let i = 0; i <= currentStageIndex; i++) {
      const stage = stages[i];
      const actions = parsedHand.actions[stage] || [];

      for (let j = 0; j < actions.length; j++) {
        // Stop early if we've reached beyond the current action in the current stage
        if (i === currentStageIndex && j > currentActionIndex) {
          return folded;
        }

        const action = actions[j];
        if (action.player === playerName && action.action === "folds") {
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
    setCurrentActionIndex(-1);
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

  function calculateCurrentPot() {
    if (!parsedHand) return 0;

    let pot = 0;

    // ✅ Add antes from all players
    const anteLines = Object.values(parsedHand.players).filter((player) =>
      parsedHand.actions.preflop.some((a) => a.player === player.name && a.action === "posts" && a.amount && a.amount <= parsedHand.bigBlind / 2)
    );

    if (anteLines.length > 0) {
      // All players posting ante: get amount from one of them
      const anteAmount = parsedHand.actions.preflop.find(
        (a) => a.action === "posts" && a.amount && a.amount <= parsedHand.bigBlind / 2
      )?.amount || 0;

      pot += anteAmount * anteLines.length;
    }

    // ✅ Add small blind and big blind
    const sb = parsedHand.actions.preflop.find((a) => a.action === "posts" && a.amount === parsedHand.bigBlind / 2);
    const bb = parsedHand.actions.preflop.find((a) => a.action === "posts" && a.amount === parsedHand.bigBlind);

    if (sb) pot += sb.amount;
    if (bb) pot += bb.amount;

    // ✅ Add actual betting/calling/raising after blinds+antes
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const actions = parsedHand.actions[stage] || [];

      for (let j = 0; j < actions.length; j++) {
        if (i === stages.indexOf(currentStage) && j > currentActionIndex) return pot;

        const action = actions[j];
        if (["bets", "calls", "raises"].includes(action.action)) {
          pot += parseFloat(action.amount || 0);
        }
      }
    }

    return pot;
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
                setCurrentActionIndex(-1);
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
              setCurrentActionIndex(-1);
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
                        <div className="stack">
                          {parsedHand?.bigBlind ? (player.stack / parsedHand.bigBlind).toFixed(2) : player.stack} BB
                        </div>
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
                  if (currentActionIndex === -1 || !stageActions || stageActions.length === 0) return null;
                  const current = stageActions[currentActionIndex] || {};

                  // Skip ante posts from display
                  const isAntePost = current.action === "posts" && current.amount <= parsedHand.bigBlind / 2;
                  if (isAntePost) return null;

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
              Pot:{" "}
              {parsedHand?.bigBlind
                ? (calculateCurrentPot() / parsedHand.bigBlind).toFixed(2) + " BB"
                : calculateCurrentPot() + " chips"}
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
                  setCurrentActionIndex(-1);
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
                  setCurrentActionIndex(-1);
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