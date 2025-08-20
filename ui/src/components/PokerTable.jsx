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

const chipTagPositions = {
  0: { top: 82, left: 50 },
  1: { top: 80, left: 28 },
  2: { top: 55, left: 20 },
  3: { top: 32, left: 28 },
  4: { top: 32, left: 72 },
  5: { top: 55, left: 80 },
  6: { top: 80, left: 72 },
  7: { top: 26, left: 25 },
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
  const [chipAnimations, setChipAnimations] = useState([]);  // Store chip animation data
  const [stageBets, setStageBets] = useState({});
  const [awardPhase, setAwardPhase] = useState("none"); // "none" | "show" | "applied"
  const [stackPayouts, setStackPayouts] = useState({}); // { [playerName]: amountWon }

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

  function resetForNewHand() {
    setCurrentStage("preflop");
    setCurrentActionIndex(-1);
    setIsPlaying(false);
    setVisibleBets(getBlindPosts(parsedHand)); // or {}
    setAwardPhase("none");
    setStackPayouts({});
  }


  function handleNext() {
    if (!parsedHand) return;

      // If we are showing the award, the next click applies it and clears the table
    if (awardPhase === "show") {
      // Convert the currently displayed visibleBets into final payouts
      // (supports multi-winner splits; if you used parser amounts, this is exact)
      setStackPayouts(prev => {
        const copy = { ...prev };
        Object.entries(visibleBets || {}).forEach(([name, amt]) => {
          copy[name] = (copy[name] || 0) + amt;
        });
        return copy;
      });

      setVisibleBets({});      // remove pot chips from table
      setAwardPhase("applied"); // stacks will reflect payout now
      return;                   // stop here; user can click again to move on
    }

    // If payout already applied, we can proceed normally (or to next hand)
    if (awardPhase === "applied") {
      // optional: auto-advance to next hand here, or just let normal step logic run
      // Example: jump to next hand and reset phases
      // (comment this out if you prefer staying on the river until user navigates)
      // goToNextHand();
      // return;
    }

    const acts = parsedHand.actions[currentStage] || [];

    // Store current bets in stageBets before moving to the next stage
    if (currentStage !== "showdown") {
      setStageBets((prevBets) => ({
        ...prevBets,
        [currentStage]: visibleBets, // Store the bets for the current stage
      }));
    }

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


  function handlePrev() {
    if (!parsedHand) return;

    // 1) If payout already applied, UNAPPLY it and show pot in front of winner(s)
    if (awardPhase === "applied") {
      setVisibleBets({ ...stackPayouts }); // chips back on table
      setAwardPhase("show");
      return; // one click just toggles applied -> show
    }

    // 2) If we were showing the pot, clear award state and FALL THROUGH to normal step-back
    if (awardPhase === "show") {
      setAwardPhase("none");
      setStackPayouts({});
      setVisibleBets({});
      // no return: continue into normal rewind logic below
    }

    // ---- existing rewind logic ----
    const actions = parsedHand.actions[currentStage] || [];

    if (currentActionIndex === getFirstActionIndex(currentStage)) {
      setCurrentActionIndex(-1);
      setVisibleBets(withBlinds());
      return;
    }

    // Step backward inside the same street
    let newIndex = currentActionIndex - 1;
    while (newIndex >= 0 && actions[newIndex].action === "posts") newIndex--;

    if (newIndex >= 0) {
      const a = actions[newIndex];
      setVisibleBets(updateVisibleBets(currentStage, newIndex));
      setCurrentActionIndex(newIndex);
      return;
    }

    // Move to previous street
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

        // Restore the previous bets for this stage
        if (stageBets[prevStage]) {
          setVisibleBets(stageBets[prevStage]); // Restore bets from stageBets
        }
        return;
      }
    }

    // Fully rewound
    setCurrentStage("preflop");
    setCurrentActionIndex(-1);
    setVisibleBets(withBlinds());
  }




  function contributionSoFar(hand, untilStreet, untilIdx, player) {
    if (!hand) return 0;

    let total = 0;
    const order = ["preflop", "flop", "turn", "river"];

    for (const st of order) {
      const acts = hand.actions[st] || [];
      const last = st === untilStreet ? (untilIdx === -1 ? -1 : untilIdx) : acts.length - 1;

      // amount this player already has in front at the start of this street
      const postedThisStreet = (st === "preflop")
        ? (acts.find(a => a.player === player && a.action === "posts" && a.amount >= hand.bigBlind / 2)?.amount || 0)
        : 0;

      let investedStreet = postedThisStreet; // IMPORTANT: seed with BB/SB once

      for (let i = 0; i <= last; i++) {
        const a = acts[i];
        if (!a || a.player !== player) continue;

        if (a.action === "bets") {
          total += a.amount ?? 0;
          investedStreet += a.amount ?? 0;
        } else if (a.action === "calls") {
          // HH "calls X" is the additional amount paid
          const inc = a.amount ?? 0;
          total += inc;
          investedStreet += inc;
        } else if (a.action === "raises") {
          // HH "raises Y to Z": a.amount is the TO amount
          const toAmount = a.amount ?? investedStreet;
          const inc = Math.max(0, toAmount - investedStreet);
          total += inc;
          investedStreet = toAmount;
        }
        // skip "posts" (handled via postedThisStreet)
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

  function extractWinnersFromHand(hand) {
    if (!hand) return [];

    // 1) Preferred: parser already gave winners
    if (Array.isArray(hand.winners) && hand.winners.length) {
      // expected: [{ player: "bajkee", amount: 2952516 }, ...]
      return hand.winners
        .filter(w => w && w.player && Number.isFinite(+w.amount))
        .map(w => ({ player: w.player, amount: +w.amount }));
    }

    // 2) Alternative shapes some parsers use
    if (Array.isArray(hand.collected) && hand.collected.length) {
      // e.g. [{ player: "bajkee", amount: 2952516 }]
      return hand.collected
        .filter(w => w && w.player && Number.isFinite(+w.amount))
        .map(w => ({ player: w.player, amount: +w.amount }));
    }
    if (Array.isArray(hand.results) && hand.results.length) {
      // e.g. [{ player, result: "won", amount }]
      return hand.results
        .filter(r => r && r.player && /won/i.test(r.result) && Number.isFinite(+r.amount))
        .map(r => ({ player: r.player, amount: +r.amount }));
    }

    // 3) Parse textual summary lines
    // Try to find "X collected N from pot" or "Seat #: X ... won (N)"
    const lines =
      hand.summaryLines || hand.summary || hand.rawSummary || hand.raw || [];
    const arr = Array.isArray(lines) ? lines : String(lines).split(/\r?\n/);

    const winners = [];
    const rxCollected = /^(.+?)\s+collected\s+(\d+)\s+from pot/i;
    const rxSeatWon  = /^Seat\s+\d+:\s*(.+?)\s.*\bwon\s*\((\d+)\)/i;

    for (const line of arr) {
      const m1 = line.match(rxCollected);
      if (m1) {
        winners.push({ player: m1[1].trim(), amount: +m1[2] });
        continue;
      }
      const m2 = line.match(rxSeatWon);
      if (m2) {
        winners.push({ player: m2[1].trim(), amount: +m2[2] });
      }
    }

    return winners;
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
    if (!parsedHand) return;

    const handEnded = currentStage === "showdown" || getRemainingPlayers() <= 1;
    if (!handEnded) return;

    if (awardPhase !== "none") return; // already showing/applied

    // Try to get winners from parser/summary
    let winners = extractWinnersFromHand(parsedHand);

    // If no explicit winners (folded pot, no summary), fall back to last player standing
    if (winners.length === 0) {
      const oneLeft = getRemainingPlayers() === 1 ? getWinnerName() : null;
      if (oneLeft) {
        winners = [{ player: oneLeft, amount: calculateCurrentPot() }];
      }
    }

    if (winners.length === 0) return; // nothing to award

    // Place pot in front of winner(s) (supports split pots)
    const vb = {};
    for (const w of winners) {
      vb[w.player] = (vb[w.player] || 0) + w.amount;
    }
    setVisibleBets(vb);
    setAwardPhase("show");
  }, [parsedHand, currentStage, currentActionIndex, awardPhase]);


  useEffect(() => {
    if (awardPhase === "show") setIsPlaying(false);
  }, [awardPhase]);

  useEffect(() => {
    if (!parsedHand) return;

    const handEnded =
      currentStage === "showdown" || getRemainingPlayers() <= 1;

    // If we’re no longer at the end of the hand, remove any award state
    if (!handEnded && (awardPhase !== "none" || Object.keys(stackPayouts).length)) {
      setAwardPhase("none");
      setStackPayouts({});
      // do NOT touch visibleBets here; the normal rewind logic controls it
    }
  }, [parsedHand, currentStage, currentActionIndex, awardPhase, stackPayouts]);

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

    let pot = parsedHand.anteTotal || 0;

    // Add SB and BB posts directly (even in the neutral state)
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

    // If we're still in the pre-flop neutral state, don't add more to the pot
    if (currentStage === "preflop" && currentActionIndex === -1) {
      return pot;
    }

    // Add other bets, calls, and raise increments
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

      if (isCurrent) break;   // Don’t look past the street we’re on
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
            {chipAnimations.map((chip, index) => (
              <div
                key={index}
                className={`chip-animation chip-${chip.player}`}
                style={{
                  position: "absolute",
                  top: `${chip.startTop}%`,  // Start position
                  left: `${chip.startLeft}%`,  
                  opacity: 1,
                  transform: "none", // Override transform styles from CSS
                  transition: `top 2s ease-out, left 2s ease-out, opacity 2s ease-out`, // Transition for smooth animation
                  transitionDelay: `${chip.delay}s`, // Staggered animation
                  zIndex: 100 + index, // Ensure chips are stacked correctly
                }}
              >
                <img src={chipImg} alt="chip" />
                <span>{chip.amount} BB</span>
              </div>
            ))}

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
                              const payout = stackPayouts[player.name] || 0;

                              let remaining = player.stack
                                - (initialPosts[player.name] || 0)
                                - (parsedHand?.antes?.find(a => a.player === player.name)?.amount ?? 0)
                                - contributionSoFar(parsedHand, currentStage, currentActionIndex, player.name);

                              // Only after the second click:
                              if (awardPhase === "applied") {
                                remaining += payout;
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
                  <span className="ante-label">Ante: {calculateAnte()}</span>
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
                  setCurrentHandIndex(i => i - 1);
                  resetForNewHand();
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
                  setCurrentHandIndex(i => i + 1);
                  resetForNewHand();
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