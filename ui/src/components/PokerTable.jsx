import React, { useState, useEffect } from "react";
import { parseRedDragonHands } from "../utils/parser";
import "../css/PokerTable.css";
import avatar from "../assets/avatar.png";
import { Link } from "react-router-dom";
import chipImg from "../assets/chip.svg";

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
  const [visibleBets, setVisibleBets] = useState({});


  const parsedHand = hands[currentHandIndex] || null;

  const dynamicPlayers = Object.values(parsedHand?.players || {});

  function getNextActingPlayerName() {
    if (!parsedHand) return null;

    const currentStageIndex = stages.indexOf(currentStage);

    for (let i = currentStageIndex; i < stages.length; i++) {
      const stage = stages[i];
      const actions = parsedHand.actions[stage] || [];

      // 👇 Use -1-aware starting index
      let startIndex =
        i === currentStageIndex ? (currentActionIndex === -1 ? 0 : currentActionIndex + 1) : 0;

      for (let j = startIndex; j < actions.length; j++) {
        const action = actions[j];
        if (!["posts"].includes(action.action)) {
          return action.player;
        }
      }
    }

    return null;
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  /**  How much this player has put in *so far*  */
  function contributionSoFar(hand, untilStage, untilIndex, player) {
    if (!hand) return 0;

    let total = 0;
    const allStages = ["preflop", "flop", "turn", "river"];
    for (const st of allStages) {
      const actions = hand.actions[st] ?? [];
      /* neutral state  →  we still want to include all “posts” (antes / blinds)
      that happened before the first real action                       */
      let lastIdx = actions.length - 1;
      if (st === untilStage && untilIndex !== -1) {
        lastIdx = untilIndex;
      }

      for (let i = 0; i <= lastIdx; i++) {
        const a = actions[i];
        if (!a || a.player !== player) continue;

      const moneyActions =
        untilIndex === -1 && st === untilStage
         ? ["posts"]
         : ["posts", "bets", "calls"];

      if (moneyActions.includes(a.action)) {
        total += a.amount ?? 0;
      }

        if (a.action === "raises") {
          /* ‘raises to 1200’ – we only want the *increment* beyond
            what they had already put in on this street. The parser
            keeps the *to* amount, so we need to know previous street
            contribution:                                    */
          const prev = actions
            .slice(0, i)
            .filter(p => p.player === player)
            .reduce((s, p) =>
              ["posts", "bets", "calls"].includes(p.action) ? s + (p.amount ?? 0)
                                                            : s, 0);
          total += (a.amount ?? 0) - prev;
        }
      }
      if (st === untilStage) break;
    }
    return total;
  }

  /**  Pretty chip tag (used both in seat & community “fly-up”) */
  function ChipTag({amount, bb}) {
    return (
      <span className="chip-tag">
        💰 {(amount / bb).toFixed(2)} BB
      </span>
    );
  }


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
      const nextAction = actions[newIndex];
      if (["bets", "raises", "calls"].includes(nextAction.action)) {
        setVisibleBets(prev => ({
          ...prev,
          [nextAction.player]: nextAction.amount,
        }));
      }
      setCurrentActionIndex(newIndex);
      return;
    }

    // 🌊 Move to next stage
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex < stages.length - 1) {
      const nextStage = stages[currentIndex + 1];
      const nextStageActions = parsedHand.actions[nextStage] || [];

      const firstIndex = getFirstActionIndex(nextStage);

      setCurrentStage(nextStage);
      setCurrentActionIndex(firstIndex < nextStageActions.length ? firstIndex : -1);

      if (firstIndex === -1 && nextStage === "preflop") {
        setVisibleBets(blindPosts());     // new hand, neutral pre-flop view
      } else {
        setVisibleBets(
          firstIndex !== -1 &&
          ["bets", "raises", "calls"].includes(nextStageActions[firstIndex]?.action)
            ? { [nextStageActions[firstIndex].player]: nextStageActions[firstIndex].amount }
            : {}
        );
      }

      const newVisibleBets = { ...visibleBets };
      const newAction = nextStageActions[firstIndex];

      if (newAction && ["bets", "raises", "calls"].includes(newAction.action)) {
        newVisibleBets[newAction.player] = newAction.amount;
      }

      setVisibleBets({});
      if (newAction && ["bets", "raises", "calls"].includes(newAction.action)) {
        setVisibleBets({ [newAction.player]: newAction.amount });
      }
    }
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

    let newVisibleBets = {};

    const actions = parsedHand.actions[currentStage] || [];

    // 🌟 Handle transition to neutral state if we're at first action
    if (currentActionIndex === getFirstActionIndex(currentStage)) {
      setCurrentActionIndex(-1);

      if (currentStage === "preflop") {
        setVisibleBets(blindPosts());        // 🠐 show SB & BB again
      } else {
        setVisibleBets({});
      }
      return;
    }


    let newIndex = currentActionIndex - 1;

    // ⏪ Skip "posts"
    while (newIndex >= 0 && actions[newIndex].action === "posts") {
      newIndex--;
    }

    if (newIndex >= 0) {
      const action = actions[newIndex];
      if (["bets", "calls", "raises"].includes(action.action)) {
        newVisibleBets[action.player] = action.amount;
      }
      setVisibleBets(newVisibleBets);
      setCurrentActionIndex(newIndex);
    } else {
      // 🌀 Go to previous stage if possible
      const currentIndex = stages.indexOf(currentStage);
      for (let i = currentIndex - 1; i >= 0; i--) {
        const prevStage = stages[i];
        const prevActions = parsedHand.actions[prevStage] || [];

        const lastActionIndex = [...prevActions]
          .map((a, idx) => ({ a, idx }))
          .reverse()
          .find(({ a }) => a.action !== "posts");

        if (lastActionIndex) {
          const actualIndex = lastActionIndex.idx;
          const action = prevActions[actualIndex];

          if (["bets", "calls", "raises"].includes(action.action)) {
            newVisibleBets[action.player] = action.amount;
          }

          setCurrentStage(prevStage);
          setVisibleBets(newVisibleBets);
          setCurrentActionIndex(actualIndex);
          return;
        }
      }

      // 🧼 If fully rewound, go neutral
      setVisibleBets({});
      setCurrentActionIndex(-1);
      setCurrentStage("preflop");
    }
  }




  function hasPlayerFolded(playerName) {
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


  function isPreflopDone() {
    if (currentStage !== "preflop" || !parsedHand) return false;

    const acts = parsedHand.actions.preflop ?? [];

    // index of the last   non-“posts”   action
    const lastRealIdx = [...acts]
      .reverse()
      .findIndex(a => a.action !== "posts");

    // if there were no “real” actions (rare), nothing to show
    if (lastRealIdx === -1) return false;

    const absoluteLast = acts.length - 1 - lastRealIdx;

    return currentActionIndex >= absoluteLast;  // we’ve reached the end
  }


  function getVisibleCards() {
    if (!parsedHand) return [];

    const board = parsedHand.board;

    /* 👁️  show flop immediately once pre-flop is DONE */
    if (isPreflopDone()) return board.slice(0, 3);

    if (currentStage === "preflop") return [];
    if (currentStage === "flop")    return board.slice(0, 3);
    if (currentStage === "turn")    return board.slice(0, 4);

    return board;          // river / showdown
  }

  function calculateCurrentPot() {
    if (!parsedHand) return 0;

    let pot = parsedHand.anteTotal || 0;

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

  function calculateAnte() {
    if (!parsedHand) return 0;           // safety
    const ante = parsedHand.anteTotal || 0;
    return parsedHand.bigBlind           // show in BB if we know the BB
          ? (ante / parsedHand.bigBlind).toFixed(2) + " BB"
          : ante + " chips";
  }

  /** number of chips = one per ante posted (simple & intuitive)             */
  function anteChipCount() {
    if (!parsedHand) return 0;
    const perPlayer = parsedHand.actions.preflop.find(
      a => a.action === "posts" && a.amount && a.amount < parsedHand.bigBlind / 2
    )?.amount ?? 0;

    // total ante / individual ante  ➜  #players that posted
    return perPlayer ? Math.round((parsedHand.anteTotal || 0) / perPlayer) : 0;
  }


  function blindPosts() {
    if (!parsedHand) return {};

    const posts = {};
    const preflop = parsedHand.actions.preflop || [];

    for (const action of preflop) {
      if (
        action.action === "posts" &&
        (action.amount === parsedHand.bigBlind || action.amount === parsedHand.bigBlind / 2)
      ) {
        posts[action.player] = action.amount;
      }
    }

    return posts;
  }


  return (
    <div className="poker-wrapper">
      <div className="table-container">
        <div className="table-heading">
          <h1 className="title">Hand Replayer</h1>

          {/* <input
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
          /> */}

          <textarea
            rows={8}
            cols={80}
            placeholder="Paste hand history here..."
            onChange={(e) => {
              const parsedHands = parseRedDragonHands(e.target.value);
              setHands(parsedHands);
              setVisibleBets(blindPosts());
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
              const isNextToAct = player.name === getNextActingPlayerName();
              return (
                <div
                  key={player.id}
                  className={`seat seat-${Math.floor(player.seat)} 
                    ${player.id === currentPlayerId ? "active-player" : ""} 
                    ${isNextToAct ? "next-acting-player" : ""} 
                    ${hasPlayerFolded(player.name) ? "folded" : ""}`}
                >
                  <div className={`player ${isNextToAct ? "next-acting-player" : ""}`}>
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
                            {parsedHand?.bigBlind
                              ? ((player.stack - contributionSoFar(parsedHand, currentStage, currentActionIndex, player.name)) / parsedHand.bigBlind).toFixed(2)
                              : player.stack} BB
                          </div>
                        <div className="position-tag">{player.position}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {dynamicPlayers.map((player) => {
              const betAmount = visibleBets[player.name];
              if (!betAmount || betAmount === 0) return null;

              return (
                <div className={`chip-tag chip-tag-${player.seat}`} key={`bet-${player.name}`}>
                  💰 {(betAmount / parsedHand.bigBlind).toFixed(2)} BB
                </div>
              );
            })}

            <div className="community">
              {getVisibleCards().map((card, i) => (
                <React.Fragment key={i}>{renderCard(card)}</React.Fragment>
              ))}
            </div>

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
                      <strong>{current?.player}</strong>:{" "}
                        {current?.action === "raises"
                          ? `raises to ${(current.amount / parsedHand.bigBlind).toFixed(2)} BB`
                          : `${current?.action}${current?.amount ? ` ${(current.amount / parsedHand.bigBlind).toFixed(2)} BB` : ""}`
                        }

                    </p>
                  );
                })()}
              </div>
            )}

            <div className="pot">
              Pot:{" "}
              {parsedHand?.bigBlind
                ? (calculateCurrentPot() / parsedHand.bigBlind).toFixed(2) + " BB"
                : calculateCurrentPot()}
            </div>
            
            {/* ---- ANTE --------------------------------------------------------- */}
            <div className="ante">
              {/* chip pile */}
              {[...Array(anteChipCount())].map((_, i) => (
                <img
                  key={i}
                  src={chipImg}
                  alt="ante-chip"
                  className="ante-chip"
                  style={{ right: `${i * 20 + 70}px`, zIndex: i }}   // slight fan-out
                />
              ))}

              {/* numeric label */}
              <span className="ante-label">
                {calculateAnte()}
              </span>
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