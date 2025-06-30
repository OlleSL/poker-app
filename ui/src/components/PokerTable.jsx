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

const seatLayoutMap = {
  2: [4, 0],
  3: [4, 2, 0],
  4: [4, 2, 0, 6],
  5: [4, 3, 1, 0, 6],
  6: [4, 3, 2, 0, 6, 5],
  7: [4, 3, 2, 1, 0, 6, 5],
};


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
  const [flashAction, setFlashAction] = useState([]); // { player, action, id }


  const parsedHand = hands[currentHandIndex] || null;

  const dynamicPlayers = Object.values(parsedHand?.players || {});

  
  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */
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

  function contributionSoFar(hand, untilStreet, untilIdx, player) {
    if (!hand) return 0;

    let total = 0;
    const order = ["preflop", "flop", "turn", "river"];

    for (const st of order) {
      const acts = hand.actions[st] || [];

      const last = st === untilStreet
        ? (untilIdx === -1 ? -1 : untilIdx)   // –1 ⇒ neutral state
        : acts.length - 1;

      let investedStreet = 0;                 // what this player has in front

      for (let i = 0; i <= last; i++) {
        const a = acts[i];
        if (!a || a.player !== player) continue;

        if (a.action === "bets" || a.action === "calls") {
          total          += a.amount ?? 0;
          investedStreet += a.amount ?? 0;
        }

        if (a.action === "calls") {
          const alreadyPosted = initialPosts[player] || 0;
          const previous = total; // current total before this call
          const needed = (a.amount ?? 0) - alreadyPosted;
          const callAmount = Math.max(0, needed - previous); // how much more they had to call

          total += callAmount;
        }

        if (a.action === "raises") {
          const alreadyPosted = initialPosts[player] || 0;
          const alreadyInvested = investedStreet + alreadyPosted;
          const raiseIncrement = Math.max(0, (a.amount ?? 0) - alreadyInvested);
          total += raiseIncrement;
          investedStreet = a.amount ?? 0;
        }
        /* posts (blinds/antes) are never added here – they live
          exclusively in `initialPosts` */
      }
      if (st === untilStreet) break;
    }
    return total;
  }

  // ─── TOTAL POSTS PER PLAYER (blinds + antes … once) ─────────────────────────
  const initialPosts = React.useMemo(() => {
    if (!parsedHand) return {};

    const out = {};

    // ▸ SB / BB / straddle (amount ≥ ½ BB)  – no antes here
    Object.values(parsedHand.actions || {}).forEach(stageActs => {
      stageActs.forEach(a => {
        if (
          a.action === "posts" &&
          (a.amount ?? 0) >= parsedHand.bigBlind / 2        // ← filter out antes
        ) {
          out[a.player] = (out[a.player] || 0) + (a.amount ?? 0);
        }
      });
    });

    // ▸ antes – every player exactly once
    (parsedHand.antes || []).forEach(({ player, amount }) => {
      out[player] = out[player] || 0;  // just mark presence
    });

    return out;                                // { playerName: totalPosted }
  }, [parsedHand]);

  function handleNext() {
    if (!parsedHand) return;
    const acts = parsedHand.actions[currentStage] || [];

    // Neutral → first real action
    if (currentActionIndex === -1) {
      const first = getFirstActionIndex(currentStage);
      if (first < acts.length) {
        const action = acts[first];
        setVisibleBets(updateVisibleBets(currentStage, first));
        setCurrentActionIndex(first);

        if (action && action.action !== "posts") {
          const flashId = Date.now(); // unique ID
          setFlashAction({ player: action.player, action: action.action, id: flashId });

          setTimeout(() => {
            setFlashAction((current) => current?.id === flashId ? null : current);
          }, 1000);
        }
      } else {
        setCurrentActionIndex(first);
      }
      return;
    }

    // Step inside current street
    let idx = currentActionIndex + 1;
    while (idx < acts.length && acts[idx].action === "posts") idx++;

    if (idx < acts.length) {
      const action = acts[idx];
      setVisibleBets(updateVisibleBets(currentStage, idx));
      setCurrentActionIndex(idx);

      if (action.action !== "posts") {
        const flashId = Date.now();
        setFlashAction({ player: action.player, action: action.action, id: flashId });

        setTimeout(() => {
          setFlashAction((current) => current?.id === flashId ? null : current);
        }, 1000);
      }

      return;
    }

    // Move to next street
    const nextIdx = stages.indexOf(currentStage) + 1;
    if (nextIdx < stages.length) {
      setCurrentStage(stages[nextIdx]);
      setCurrentActionIndex(-1);
      setVisibleBets({});
    }
  }

  function getFirstActionIndex(stage){
    const acts = parsedHand?.actions[stage] || [];
    for(let i=0;i<acts.length;i++) if(acts[i].action!=="posts") return i;
    return 0;
  }

  function updateVisibleBets(stage, uptoIdx){
    if(!parsedHand) return {};
    const acts = parsedHand.actions[stage] || [];
    const bets = {};
    for(let i=0;i<=uptoIdx;i++){
      const a = acts[i];
      if(!a) continue;

      /* show blinds (pre-flop only) */
      if(stage==="preflop" &&
         a.action==="posts" &&
         (a.amount===parsedHand.bigBlind || a.amount===parsedHand.bigBlind/2)){
        bets[a.player]=(bets[a.player]||0)+a.amount;
        continue;
      }

      if(a.action==="bets"   ) bets[a.player]=a.amount;
      if(a.action==="calls"  ) bets[a.player]=(bets[a.player]||0)+a.amount;
      if(a.action==="raises" ) bets[a.player]=a.amount;
    }
    return bets;
  }



  function handlePrev() {
    if (!parsedHand) return;
    const actions = parsedHand.actions[currentStage] || [];

    /* first real action → neutral */
    if (currentActionIndex === getFirstActionIndex(currentStage)) {
      setCurrentActionIndex(-1);
      setVisibleBets(withBlinds());      // keep SB + BB visible in pre-flop
      return;
    }

    /* step backward inside the same street */
    let newIndex = currentActionIndex - 1;
    while (newIndex >= 0 && actions[newIndex].action === "posts") newIndex--;

    if (newIndex >= 0) {
      const a = actions[newIndex];
      setVisibleBets(updateVisibleBets(currentStage, newIndex));
      setCurrentActionIndex(newIndex);
      return;
    }

    /* move to previous street */
    const prevStageIdx = stages.indexOf(currentStage) - 1;
    for (let i = prevStageIdx; i >= 0; i--) {
      const prevStage = stages[i];
      const prevActions = parsedHand.actions[prevStage] || [];
      const lastRealIdx = [...prevActions].map((a, idx) => ({ a, idx }))
        .reverse().find(item => item.a.action !== "posts");

      if (lastRealIdx) {
        const { a, idx } = lastRealIdx;
        setCurrentStage(prevStage);
        setCurrentActionIndex(idx);
        setVisibleBets(updateVisibleBets(prevStage, idx));
        return;
      }
    }

    /* fully rewound */
    setCurrentStage("preflop");
    setCurrentActionIndex(-1);
    setVisibleBets(withBlinds());
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

  function isHandOver() {
    return currentStage === "showdown" || getRemainingPlayers() <= 1;
  }

  function getWinnerName() {
    if (!isHandOver()) return null;
    const remaining = dynamicPlayers.filter(p => !hasPlayerFolded(p.name));
    return remaining.length === 1 ? remaining[0].name : null;
  }

  function getRemainingPlayers() {
    return dynamicPlayers.filter(p => !hasPlayerFolded(p.name)).length;
  }

  function togglePlay() {
    setIsPlaying((prev) => !prev);
  }

  useEffect(()=>{
    if(!isPlaying) return;
    const id=setInterval(handleNext,2000);
    return ()=>clearInterval(id);
  },[isPlaying,currentStage]);

  useEffect(()=>{
    if(parsedHand) setVisibleBets(getBlindPosts(parsedHand));
  },[parsedHand]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setFlashActions((prev) => prev.filter((a) => now - a.timestamp < 1000));
    }, 100); // check every 100ms
    return () => clearInterval(interval);
  }, []);

  function getVisibleCards(){
    if(!parsedHand) return [];
    const b=parsedHand.board;
    if(currentStage==="preflop") return [];
    if(currentStage==="flop")    return b.slice(0,3);
    if(currentStage==="turn")    return b.slice(0,4);
    return b;
  }

  /** ------------------------------------------------------------------  
   *  Accurate pot size up to (and including) the currentActionIndex  
   *  – handles posts / bets / calls incrementally  
   *  – handles “raise to …” by adding only the increment on this street  
   * ------------------------------------------------------------------ */
  function calculateCurrentPot() {
    if (!parsedHand) return 0;

    // start with antes
    let pot = parsedHand.anteTotal || 0;

    /* -----------------------------------------------------------
    * 👉  Always add SB + BB right away (even in the neutral state)
    * ----------------------------------------------------------- */
    if (parsedHand.actions?.preflop) {
      const sb = parsedHand.actions.preflop.find(
        a => a.action === "posts" && a.amount === parsedHand.bigBlind / 2
      );
      const bb = parsedHand.actions.preflop.find(
        a => a.action === "posts" && a.amount === parsedHand.bigBlind
      );
      if (sb) pot += sb.amount;
      if (bb) pot += bb.amount;
    }

    /* If we are still in the neutral state of the pre-flop street
      (-1 means no real action yet) we’re done – the pot is just
      antes + SB + BB.  */
    if (currentStage === "preflop" && currentActionIndex === -1) {
      return pot;
    }

    /* -----------------------------------------------------------
    * Everything below is unchanged: we walk through the streets
    * and add bets, calls and *increments* of raises.
    * ----------------------------------------------------------- */
    const order = ["preflop", "flop", "turn", "river"];
    for (const st of order) {
      const acts = parsedHand.actions[st] || [];
      const invested = {};
      const isCurrent = st === currentStage;
      const lastIdx =
        isCurrent ? (currentActionIndex === -1 ? -1 : currentActionIndex)
                  : acts.length - 1;

      for (let i = 0; i <= lastIdx; i++) {
        const a = acts[i];
        if (!a) continue;

        if (a.action === "bets" || a.action === "calls") {
          pot += a.amount ?? 0;
          invested[a.player] = (invested[a.player] || 0) + (a.amount ?? 0);
        }

        if (a.action === "raises") {
          const already = invested[a.player] || 0;
          const inc = Math.max(0, (a.amount ?? 0) - already);
          pot += inc;
          invested[a.player] = a.amount ?? 0;
        }
      }

      if (isCurrent) break;   // don’t look past the street we’re on
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
    (parsedHand.actions?.preflop ?? []).forEach(a => {
      if (
        a.action === "posts" &&
        (a.amount === parsedHand.bigBlind || a.amount === parsedHand.bigBlind / 2)
      ) {
        posts[a.player] = a.amount;
      }
    });
    return posts;
  }

  function withBlinds(extra = {}) {
    return currentStage === "preflop" ? { ...blindPosts(), ...extra } : extra;
  }

  function getBlindPosts(hand) {
    const posts = {};
    const preflop = hand?.actions?.preflop || [];

    for (const action of preflop) {
      if (
        action.action === "posts" &&
        (action.amount === hand.bigBlind || action.amount === hand.bigBlind / 2)
      ) {
        posts[action.player] = action.amount;
      }
    }

    return posts;
  }

function getRotatedPlayers() {
  if (!parsedHand) return [];

  const players = Object.values(parsedHand.players || {});
  const heroIndex = players.findIndex(p => p.hero);
  const playerCount = players.length;

  if (heroIndex === -1 || playerCount === 0) {
    // fallback to default seat order
    return players.map((p, i) => ({ ...p, visualSeat: i }));
  }

  const HERO_VISUAL_SEAT = 6;

  // Rotate players so hero is at index 0
  const rotated = [...players.slice(heroIndex), ...players.slice(0, heroIndex)];
  const seatMap = seatLayoutMap[rotated.length] || [];

  return rotated.map((player, i) => ({
    ...player,
    visualSeat: seatMap[i] ?? i,
  }));
}
  
  return (
    <div className="poker-wrapper">
      <div className="table-container">
        <div className="table-heading">
          <h1 className="title">Hand Replayer</h1>
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

          {/* <Link to="/gto" className="gto-link">Click here for GTO breakdown</Link> */}
          {/* <div className="underline"></div> */}
        </div>

        <div className="table-outer-ring">
          <div className={"table"}>
            {getRotatedPlayers().map((player, visualIndex) => {
              const currentAction = parsedHand?.actions[currentStage]?.[currentActionIndex];
              const isActing = currentAction?.player === player.name;
              const isNextToAct = player.name === getNextActingPlayerName();
              return (
                <div
                  key={player.id}
                  className={`seat seat-${player.visualSeat}
                    ${player.id === currentPlayerId ? "active-player" : ""} 
                    ${player.name === getNextActingPlayerName() ? "next-acting-player" : ""} 
                    ${hasPlayerFolded(player.name) ? "folded" : ""}`}
                >
                  <div className={`player ${isNextToAct ? "next-acting-player" : ""}`}>
                    <div className="cards">
                      {(() => {
                        const isHero = player.seat === 1;
                        const isShowdown = currentStage === "showdown";
                        const hasCards = player.cards.length > 0;

                        if (isHero) {
                          // Always show hero's cards
                          return player.cards.map((card, i) => (
                            <React.Fragment key={i}>{renderCard(card)}</React.Fragment>
                          ));
                        } else if (isShowdown && hasCards) {
                          // Show villains' cards only at showdown if present
                          return player.cards.map((card, i) => (
                            <React.Fragment key={i}>{renderCard(card)}</React.Fragment>
                          ));
                        } else {
                          // Hidden cards (face-down)
                          return [0, 1].map((_, i) => (
                            <div className="card back" key={i}>🂠</div>
                          ));
                        }
                      })()}
                    </div>
                    <div className="player-info">
                      <img src={avatar} alt="avatar" className="avatar" />
                      <div className="name-stack">
                        <div className="name">{player.name}</div>
                          <div className="stack">
                            {(() => {
                              const posted = initialPosts[player.name] || 0;
                              const invested = contributionSoFar(
                                parsedHand,
                                currentStage,
                                currentActionIndex,
                                player.name
                              );
                              const antePaid = parsedHand?.antes?.find(a => a.player === player.name)?.amount ?? 0;

                              let remaining = player.stack - posted - invested - antePaid;

                              if (isHandOver()) {
                                const winner = getWinnerName();
                                if (player.name === winner) {
                                  remaining += calculateCurrentPot();
                                }
                              }

                              const chipsLeft = Math.max(0, remaining);

                              return parsedHand?.bigBlind
                                ? (chipsLeft / parsedHand.bigBlind).toFixed(2) + " BB"
                                : chipsLeft + " chips";
                            })()}
                          </div>
                          {flashAction?.player === player.name && (
                            <div className="action-flash">{flashAction.action.toUpperCase()}</div>
                          )}
                          {player.position && (
                            <div className="position-tag">{player.position}</div>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {getRotatedPlayers().map((player) => {
              const betAmount = visibleBets[player.name];
              if (!betAmount || betAmount === 0) return null;

              return (
                <div className={`chip-tag chip-tag-${player.visualSeat}`} key={`bet-${player.name}`}>
                  💰 {(betAmount / parsedHand.bigBlind).toFixed(2)} BB
                </div>
              );
            })}
            
            {getRotatedPlayers().map((player, visualIndex) => {
              if (player.position === "BTN") {
                return (
                  <div
                    key="button-chip"
                    className={`button-chip button-chip-${player.visualSeat}`}
                  >
                    B
                  </div>
                );
              }
              return null;
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
              {currentStage === "preflop" ? (
                <>
                  {/* Chip pile for antes */}
                  {[...Array(anteChipCount())].map((_, i) => (
                    <img
                      key={i}
                      src={chipImg}
                      alt="ante-chip"
                      className="ante-chip"
                      style={{ right: `${i * 20 + 70}px`, zIndex: i }}
                    />
                  ))}
                  <span className="ante-label">{calculateAnte()}</span>
                </>
              ) : (
                <span className="ante-label">
                  Pot:{" "}
                  {parsedHand?.bigBlind
                    ? (calculateCurrentPot() / parsedHand.bigBlind).toFixed(2) + " BB"
                    : calculateCurrentPot()}
                </span>
              )}
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