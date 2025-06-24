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
  function contributionSoFar(hand, untilStage, untilIndex, player){
    if(!hand) return 0;
    let total   = 0;
    const loops = ["preflop","flop","turn","river"];
    for(const st of loops){
      const acts          = hand.actions[st] ?? [];
      const neutral       = st === untilStage && untilIndex === -1;
      const moneyActs     = neutral ? ["posts"] : ["posts","bets","calls"];
      let last            = acts.length-1;
      if(st === untilStage && untilIndex !== -1) last = untilIndex;

      for(let i=0;i<=last;i++){
        const a = acts[i];
        if(!a || a.player !== player) continue;
        if(moneyActs.includes(a.action)) total += a.amount ?? 0;

        /* raises are “to …”  ⇒ add only increment on that street           */
        if (!neutral && a.action === "raises") {
          const alreadyPutIn = acts
            .slice(0, i)
            .filter(
              p =>
                p.player === player &&
                ["posts", "bets", "calls", "raises"].includes(p.action)
            )
            .reduce((s, p) => s + (p.amount ?? 0), 0);

          total += (a.amount ?? 0) - alreadyPutIn;
        }
      }
      if(st === untilStage) break;
    }
    return total;
  }

  function handleNext(){
    if(!parsedHand) return;
    const acts = parsedHand.actions[currentStage] || [];

    /* neutral → first real action */
    if(currentActionIndex===-1){
      const first=getFirstActionIndex(currentStage);
      if(first<acts.length){
        setVisibleBets(updateVisibleBets(currentStage,first));
        setCurrentActionIndex(first);
      }else{
        setCurrentActionIndex(first); // e.g. flop-reveal click
      }
      return;
    }

    /* step inside current street */
    let idx=currentActionIndex+1;
    while(idx<acts.length && acts[idx].action==="posts") idx++;
    if(idx<acts.length){
      setVisibleBets(updateVisibleBets(currentStage,idx));
      setCurrentActionIndex(idx);
      return;
    }

    /* move to next street — stop in neutral state (-1) first               */
    const nextIdx = stages.indexOf(currentStage)+1;
    if(nextIdx<stages.length){
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

  function betsSoFar(hand, stage, /*inclusive*/uptoIdx) {
    const out = {};

    const acts = hand.actions?.[stage] ?? [];
    for (let i = 0; i <= uptoIdx; i++) {
      const a = acts[i];
      if (!a) break;

      /* blinds are just normal “posts”, but we only want SB + BB to show */
      if (
        stage === "preflop" &&
        a.action === "posts" &&
        (a.amount === hand.bigBlind || a.amount === hand.bigBlind / 2)
      ) {
        out[a.player] = a.amount;
      }

      if (["bets", "calls", "raises"].includes(a.action)) {
        /* the parser keeps the full “to” amount for raises, so this is
          already what has to be in front of the player */
        out[a.player] = a.amount;
      }
    }
    return out;
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

  useEffect(()=>{
    if(!isPlaying) return;
    const id=setInterval(handleNext,2000);
    return ()=>clearInterval(id);
  },[isPlaying,currentStage]);

  useEffect(()=>{
    if(parsedHand) setVisibleBets(getBlindPosts(parsedHand));
  },[parsedHand]);


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

  function getVisibleCards(){
    if(!parsedHand) return [];
    const b=parsedHand.board;
    if(currentStage==="preflop") return [];
    if(currentStage==="flop")    return b.slice(0,3);
    if(currentStage==="turn")    return b.slice(0,4);
    return b;
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
                            {
                              parsedHand?.bigBlind
                                ? Math.max(
                                    0,
                                    (player.stack - contributionSoFar(
                                      parsedHand,
                                      currentStage,
                                      currentActionIndex,
                                      player.name
                                    )) / parsedHand.bigBlind
                                  ).toFixed(2)
                                : player.stack
                            } BB
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