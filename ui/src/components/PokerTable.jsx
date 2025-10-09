import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useTransition,
} from "react";
import "../css/PokerTable.css";
import avatar from "../assets/avatar.png";
import chipImg from "../assets/chip.svg";
import { parseRedDragonHands } from "../utils/parser"; // optional fallback (not used if worker is available)
import { extractContext } from "../gto/context";
import { GtoPanel } from "../components/GtoPanel";
import { resolveRangeUrl } from "../gto/rangeIndex";

// Web worker for parsing (Vite syntax)
const workerUrl = new URL("../workers/parser.worker.js", import.meta.url);

/* ───────────────────── Helpers & constants ───────────────────── */

const suitSymbols = { h: "♥", d: "♦", s: "♠", c: "♣" };
const stages = ["preflop", "flop", "turn", "river", "showdown"];

const seatLayoutMap = {
  2: [4, 0],
  3: [4, 2, 0],
  4: [4, 2, 0, 6],
  5: [4, 3, 1, 0, 6],
  6: [4, 3, 2, 0, 6, 5],
  7: [4, 3, 2, 1, 0, 6, 5],
};

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

/**
 * Build a snapshot of table state up to (stage, actionIndex).
 * Returns: { pot, visibleBets, foldsSet, investedByPlayer, blindsMap }
 */
function buildSnapshot(hand, stage, actionIndex) {
  if (!hand) {
    return {
      pot: 0,
      visibleBets: {},
      foldsSet: new Set(),
      investedByPlayer: {},
      blindsMap: {},
    };
  }

  const STREETS = ["preflop", "flop", "turn", "river"];
  let pot = hand.anteTotal || 0;

  const investedByPlayer = {};
  const streetInvested = {};
  const foldsSet = new Set();
  const visibleBets = {};

  // Seed blinds once (add to pot AND to preflop invested so raises compute increments correctly)
  const pre = hand.actions?.preflop ?? [];
  const sb = pre.find((a) => a.action === "posts" && a.amount === hand.bigBlind / 2);
  const bb = pre.find((a) => a.action === "posts" && a.amount === hand.bigBlind);
  const blindsMap = {};

  if (sb) {
    pot += sb.amount;
    blindsMap[sb.player] = (blindsMap[sb.player] || 0) + sb.amount;
  }
  if (bb) {
    pot += bb.amount;
    blindsMap[bb.player] = (blindsMap[bb.player] || 0) + bb.amount;
  }

  // Ensure preflop street buckets exist and are pre-seeded with blinds
  streetInvested.preflop = streetInvested.preflop || {};
  if (sb) {
    streetInvested.preflop[sb.player] =
      (streetInvested.preflop[sb.player] || 0) + sb.amount;
    investedByPlayer[sb.player] = (investedByPlayer[sb.player] || 0) + sb.amount;
  }
  if (bb) {
    streetInvested.preflop[bb.player] =
      (streetInvested.preflop[bb.player] || 0) + bb.amount;
    investedByPlayer[bb.player] = (investedByPlayer[bb.player] || 0) + bb.amount;
  }

  for (const st of STREETS) {
    const acts = hand.actions?.[st] || [];
    streetInvested[st] = streetInvested[st] || {};

    // On preflop, start visibleBets with blinds so totals include posts
    if (st === stage && st === "preflop") {
      Object.assign(visibleBets, blindsMap);
    }

    const lastIdx =
      st === stage ? (actionIndex === -1 ? -1 : actionIndex) : acts.length - 1;

    for (let i = 0; i <= lastIdx; i++) {
      const a = acts[i];
      if (!a) continue;

      if (a.action === "folds") {
        foldsSet.add(a.player);
        continue;
      }
      if (a.action === "posts") {
        // Blinds are already handled (and antes in pot seed); skip other posts here
        continue;
      }
      if (a.action === "bets") {
        const amt = a.amount || 0;
        pot += amt;
        investedByPlayer[a.player] = (investedByPlayer[a.player] || 0) + amt;
        streetInvested[st][a.player] = (streetInvested[st][a.player] || 0) + amt;
        if (st === stage) visibleBets[a.player] = amt;
        continue;
      }
      if (a.action === "calls") {
        const amt = a.amount || 0;
        pot += amt;
        investedByPlayer[a.player] = (investedByPlayer[a.player] || 0) + amt;
        streetInvested[st][a.player] = (streetInvested[st][a.player] || 0) + amt;
        if (st === stage) visibleBets[a.player] = (visibleBets[a.player] || 0) + amt;
        continue;
      }
      if (a.action === "raises") {
        // "raises to X": add only the increment over what they've already put in this street
        const toAmt = a.amount || 0;
        const already = streetInvested[st][a.player] || 0; // includes blind on preflop now
        const inc = Math.max(0, toAmt - already);
        pot += inc;
        investedByPlayer[a.player] = (investedByPlayer[a.player] || 0) + inc;
        streetInvested[st][a.player] = toAmt;
        if (st === stage) visibleBets[a.player] = toAmt;
        continue;
      }
    }

    if (st === stage) break;
  }

  // Preflop neutral state: show only blinds as visible chips-in-front
  if (stage === "preflop" && actionIndex === -1) {
    return { pot, visibleBets: blindsMap, foldsSet, investedByPlayer, blindsMap };
  }

  return { pot, visibleBets, foldsSet, investedByPlayer, blindsMap };
}


/* ───────────────────── Component ───────────────────── */

export default function PokerTable() {
  const [hands, setHands] = useState([]);
  const [currentHandIndex, setCurrentHandIndex] = useState(0);
  const [currentStage, setCurrentStage] = useState("preflop");
  const [currentActionIndex, setCurrentActionIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showGto, setShowGto] = useState(false);
  const [gtoUrl, setGtoUrl] = useState(null);


  // award flow state
  const [visibleBets, setVisibleBets] = useState({});
  const [stageBets, setStageBets] = useState({});
  const [flashAction, setFlashAction] = useState(null); // { player, action, id }
  const [awardPhase, setAwardPhase] = useState("none"); // "none" | "show" | "applied"
  const [stackPayouts, setStackPayouts] = useState({}); // { [player]: amount }

  const parsedHand = hands[currentHandIndex] || null;
  const dynamicPlayers = Object.values(parsedHand?.players || {});

  /* Web Worker setup for parsing */
  const workerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!parsedHand) { setGtoUrl(null); return; }
      const ctx = extractContext(parsedHand, "preflop"); // open ranges for now
      const url = await resolveRangeUrl(ctx);
      if (!cancelled) setGtoUrl(url);
    })();
    return () => { cancelled = true; };
  }, [parsedHand]);

  useEffect(() => {
    try {
      const w = new Worker(workerUrl, { type: "module" });
      w.onerror = (e) => {
        console.error("Parser worker error:", e?.message || e);
        // disable worker so we fall back to sync parser
        workerRef.current = null;
      };
      workerRef.current = w;
    } catch {
      workerRef.current = null; // fallback will be sync parsing
    }
    return () => workerRef.current?.terminate();
  }, []);

  function handlePasteSubmit() {
    const input = (pasteText || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    if (!input.trim()) {
      alert("Paste hand history text first.");
      return;
    }
    handlePaste(input);
    setShowPaste(false);
  }


  function handlePaste(text) {
    const input = (text || "").replace(/^\uFEFF/, ""); // strip BOM if present
    if (!input.trim()) {
      alert("No text to parse.");
      return;
    }

    // prefer worker, but fall back if disabled or errors
    if (workerRef.current) {
      workerRef.current.onmessage = (e) => {
        const parsed = Array.isArray(e.data) ? e.data : [];
        console.log("Worker parsed hands:", parsed.length);
        setHands(parsed);
        setCurrentHandIndex(0);
        if (parsed.length === 0) {
          alert("No hands found in file. Is this the correct hand-history format?");
        }
      };
      workerRef.current.postMessage(input);
      return;
    }

    // fallback: sync
    const parsed = parseRedDragonHands(input);
    console.log("Sync parsed hands:", parsed.length);
    setHands(parsed);
    setCurrentHandIndex(0);
    if (parsed.length === 0) {
      alert("No hands found in file. Is this the correct hand-history format?");
    }
  }


  // NEW: load a .txt file, normalize newlines, then reuse handlePaste
  function handleFileChange(e) {
    const inputEl = e.target;
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;

    // Don't hard-block on extension; warn but proceed
    const isText = (file.type || "").startsWith("text");
    const nameLooksOk = /\.((txt|log)|handhistory)$/i.test(file.name);
    if (!isText && !nameLooksOk) {
      console.warn("File may not be plain text; attempting to read anyway.");
    }

    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      // Strip BOM and normalize CRLF -> LF so parser sees consistent text
      const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
      if (!normalized.trim()) {
        alert("File appears empty or unreadable.");
        inputEl.value = ""; // allow re-selecting the same file
        return;
      }
      handlePaste(normalized); // reuse your existing flow (worker/sync)
      inputEl.value = ""; // let onChange fire again if user picks same file
    };
    reader.onerror = (err) => {
      console.error("FileReader error:", err);
      alert("Could not read file. Try another file?");
      inputEl.value = "";
    };
    reader.readAsText(file);
  }


  /* Precompute snapshots for all (stage, idx) once per hand */
  const snapshotTable = useMemo(() => {
    if (!parsedHand) return {};
    const table = {};
    const streetList = ["preflop", "flop", "turn", "river"];
    for (const st of streetList) {
      const acts = parsedHand.actions?.[st] || [];
      for (let i = -1; i < acts.length; i++) {
        table[`${st}:${i}`] = buildSnapshot(parsedHand, st, i);
      }
    }
    return table;
  }, [parsedHand]);

  const snapshot = useMemo(
    () =>
      snapshotTable[`${currentStage}:${currentActionIndex}`] ||
      buildSnapshot(parsedHand, currentStage, currentActionIndex),
    [snapshotTable, parsedHand, currentStage, currentActionIndex]
  );

  /* Initial posts (SB/BB/straddles + mark antes) */
  const initialPosts = useMemo(() => {
    if (!parsedHand) return {};
    const out = {};
    Object.values(parsedHand.actions || {}).forEach((acts) => {
      acts.forEach((a) => {
        if (
          a.action === "posts" &&
          (a.amount ?? 0) >= parsedHand.bigBlind / 2
        ) {
          out[a.player] = (out[a.player] || 0) + (a.amount ?? 0);
        }
      });
    });
    (parsedHand.antes || []).forEach(({ player }) => {
      out[player] = out[player] || 0;
    });
    return out;
  }, [parsedHand]);

  /* autoplay with transition (keeps UI responsive) */
  const [, startTransition] = useTransition();
  const playTimer = useRef(null);
  const fileInputRef = useRef(null);
  useEffect(() => {
    if (!isPlaying) {
      if (playTimer.current) clearTimeout(playTimer.current);
      playTimer.current = null;
      return;
    }
    function tick() {
      startTransition(() => handleNext());
      playTimer.current = setTimeout(tick, 800);
    }
    playTimer.current = setTimeout(tick, 800);
    return () => {
      if (playTimer.current) clearTimeout(playTimer.current);
    };
  }, [isPlaying, currentStage, currentActionIndex]);

  /* Reset when the hand changes */
  useEffect(() => {
    if (!parsedHand) return;
    setStageBets({});
    setAwardPhase("none");
    setStackPayouts({});
    setCurrentStage("preflop");
    setCurrentActionIndex(-1);
    setIsPlaying(false);
  }, [parsedHand]);

  /* Stop autoplay when showing the award */
  useEffect(() => {
    if (awardPhase === "show") setIsPlaying(false);
  }, [awardPhase]);

  /* Clear award state if we rewind off the end */
  useEffect(() => {
    if (!parsedHand) return;
    const handEnded =
      currentStage === "showdown" || getRemainingPlayers() <= 1;
    if (!handEnded && (awardPhase !== "none" || Object.keys(stackPayouts).length)) {
      setAwardPhase("none");
      setStackPayouts({});
    }
  }, [parsedHand, currentStage, currentActionIndex, awardPhase, stackPayouts]);

  /* ─────────── per-hand helpers ─────────── */

  const visibleBoard = useMemo(() => {
    if (!parsedHand) return [];
    const b = parsedHand.board || [];
    if (currentStage === "preflop") return [];
    if (currentStage === "flop") return b.slice(0, 3);
    if (currentStage === "turn") return b.slice(0, 4);
    return b;
  }, [parsedHand, currentStage]);

  function getFirstActionIndex(stage) {
    const acts = parsedHand?.actions[stage] || [];
    for (let i = 0; i < acts.length; i++) if (acts[i].action !== "posts") return i;
    return 0;
  }

  function getNextActingPlayerName() {
    if (!parsedHand) return null;
    const currentStageIndex = stages.indexOf(currentStage);
    for (let i = currentStageIndex; i < stages.length; i++) {
      const stage = stages[i];
      const actions = parsedHand.actions[stage] || [];
      const startIndex =
        i === currentStageIndex ? (currentActionIndex === -1 ? 0 : currentActionIndex + 1) : 0;
      for (let j = startIndex; j < actions.length; j++) {
        const action = actions[j];
        if (action.action !== "posts") return action.player;
      }
    }
    return null;
  }

  function updateVisibleBets(stage, uptoIdx) {
    if (!parsedHand) return {};
    const acts = parsedHand.actions[stage] || [];
    const bets = {};
    for (let i = 0; i <= uptoIdx; i++) {
      const a = acts[i];
      if (!a) continue;

      // show blinds at preflop
      if (
        stage === "preflop" &&
        a.action === "posts" &&
        (a.amount === parsedHand.bigBlind || a.amount === parsedHand.bigBlind / 2)
      ) {
        bets[a.player] = (bets[a.player] || 0) + a.amount;
        continue;
      }
      if (a.action === "bets") bets[a.player] = a.amount;
      if (a.action === "calls") bets[a.player] = (bets[a.player] || 0) + a.amount;
      if (a.action === "raises") bets[a.player] = a.amount;
    }
    return bets;
  }

  function hasPlayerFolded(playerName) {
    return snapshot.foldsSet.has(playerName);
  }

  function getRemainingPlayers() {
    return dynamicPlayers.filter((p) => !hasPlayerFolded(p.name)).length;
  }

  function isHandOver() {
    return currentStage === "showdown" || getRemainingPlayers() <= 1;
  }

  function getWinnerName() {
    if (!isHandOver()) return null;
    const remaining = dynamicPlayers.filter((p) => !hasPlayerFolded(p.name));
    return remaining.length === 1 ? remaining[0].name : null;
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

  function extractWinnersFromHand(hand) {
    if (!hand) return [];
    if (Array.isArray(hand.winners) && hand.winners.length) {
      return hand.winners
        .filter((w) => w && w.player && Number.isFinite(+w.amount))
        .map((w) => ({ player: w.player, amount: +w.amount }));
    }
    if (Array.isArray(hand.collected) && hand.collected.length) {
      return hand.collected
        .filter((w) => w && w.player && Number.isFinite(+w.amount))
        .map((w) => ({ player: w.player, amount: +w.amount }));
    }
    if (Array.isArray(hand.results) && hand.results.length) {
      return hand.results
        .filter((r) => r && r.player && /won/i.test(r.result) && Number.isFinite(+r.amount))
        .map((r) => ({ player: r.player, amount: +r.amount }));
    }
    const lines = hand.summaryLines || hand.summary || hand.rawSummary || hand.raw || [];
    const arr = Array.isArray(lines) ? lines : String(lines).split(/\r?\n/);
    const winners = [];
    const rxCollected = /^(.+?)\s+collected\s+(\d+)\s+from pot/i;
    const rxSeatWon = /^Seat\s+\d+:\s*(.+?)\s.*\bwon\s*\((\d+)\)/i;
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

  function remainingChipsLabel(player) {
    const bb = parsedHand?.bigBlind || 1;
    const posted = initialPosts[player.name] || 0;
    const antePaid =
      parsedHand?.antes?.find((a) => a.player === player.name)?.amount || 0;
    const invested = snapshot.investedByPlayer[player.name] || 0;
    let remaining = player.stack - posted - antePaid - invested;
    if (awardPhase === "applied") remaining += stackPayouts[player.name] || 0;
    const chipsLeft = Math.max(0, remaining);
    return parsedHand?.bigBlind
      ? (chipsLeft / bb).toFixed(2) + " BB"
      : chipsLeft + " chips";
  }

  /* navigation / step handlers */

  function handleNext() {
    if (!parsedHand) return;

    // award flow
    if (awardPhase === "show") {
      setStackPayouts((prev) => {
        const copy = { ...prev };
        Object.entries(visibleBets || {}).forEach(([name, amt]) => {
          copy[name] = (copy[name] || 0) + amt;
        });
        return copy;
      });
      setVisibleBets({});
      setAwardPhase("applied");
      return;
    }

    const acts = parsedHand.actions[currentStage] || [];

    // stash current stage bets before moving on
    if (currentStage !== "showdown") {
      setStageBets((prev) => ({ ...prev, [currentStage]: visibleBets }));
    }

    // neutral → first action
    if (currentActionIndex === -1) {
      const first = getFirstActionIndex(currentStage);
      if (first < acts.length) {
        const action = acts[first];
        setVisibleBets(updateVisibleBets(currentStage, first));
        setCurrentActionIndex(first);

        if (action && action.action !== "posts") {
          const flashId = Date.now();
          setFlashAction({ player: action.player, action: action.action, id: flashId });
          setTimeout(() => {
            setFlashAction((cur) => (cur?.id === flashId ? null : cur));
          }, 1000);
        }
      } else {
        setCurrentActionIndex(first);
      }
      return;
    }

    // step within street
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
          setFlashAction((cur) => (cur?.id === flashId ? null : cur));
        }, 1000);
      }
      return;
    }

    // advance street
    const nextIdx = stages.indexOf(currentStage) + 1;
    if (nextIdx < stages.length) {
      setCurrentStage(stages[nextIdx]);
      setCurrentActionIndex(-1);
      setVisibleBets({});
    }

    // if end reached, show award chips
    const handEnded = nextIdx >= stages.length || getRemainingPlayers() <= 1;
    if (handEnded && awardPhase === "none") {
      let winners = extractWinnersFromHand(parsedHand);
      if (!winners.length) {
        const oneLeft = getWinnerName();
        if (oneLeft) winners = [{ player: oneLeft, amount: snapshot.pot }];
      }
      if (winners.length) {
        const vb = {};
        for (const w of winners) vb[w.player] = (vb[w.player] || 0) + w.amount;
        setVisibleBets(vb);
        setAwardPhase("show");
      }
    }
  }

  function handlePrev() {
    if (!parsedHand) return;

    if (awardPhase === "applied") {
      setVisibleBets({ ...stackPayouts });
      setAwardPhase("show");
      return;
    }
    if (awardPhase === "show") {
      setAwardPhase("none");
      setStackPayouts({});
      setVisibleBets({});
      // fallthrough into rewind logic
    }

    const actions = parsedHand.actions[currentStage] || [];

    if (currentActionIndex === getFirstActionIndex(currentStage)) {
      setCurrentActionIndex(-1);
      setVisibleBets(snapshot.blindsMap || {});
      return;
    }

    // step back within street
    let newIndex = currentActionIndex - 1;
    while (newIndex >= 0 && actions[newIndex].action === "posts") newIndex--;

    if (newIndex >= 0) {
      setVisibleBets(updateVisibleBets(currentStage, newIndex));
      setCurrentActionIndex(newIndex);
      return;
    }

    // move to previous street
    const prevStageIdx = stages.indexOf(currentStage) - 1;
    for (let i = prevStageIdx; i >= 0; i--) {
      const prevStage = stages[i];
      const prevActions = parsedHand.actions[prevStage] || [];
      const lastRealIdx = [...prevActions]
        .map((a, idx) => ({ a, idx }))
        .reverse()
        .find((item) => item.a.action !== "posts");

      if (lastRealIdx) {
        const { idx } = lastRealIdx;
        setCurrentStage(prevStage);
        setCurrentActionIndex(idx);
        if (stageBets[prevStage]) setVisibleBets(stageBets[prevStage]);
        return;
      }
    }

    // fully rewound
    setCurrentStage("preflop");
    setCurrentActionIndex(-1);
    setVisibleBets(snapshot.blindsMap || {});
  }

  function togglePlay() {
    setIsPlaying((prev) => !prev);
  }

  function getRotatedPlayers() {
    if (!parsedHand) return [];
    const players = Object.values(parsedHand.players || {});
    const heroIndex = players.findIndex((p) => p.hero);
    const playerCount = players.length;

    if (heroIndex === -1 || playerCount === 0) {
      return players.map((p, i) => ({ ...p, visualSeat: i }));
    }

    const rotated = [
      ...players.slice(heroIndex),
      ...players.slice(0, heroIndex),
    ];
    const seatMap = seatLayoutMap[rotated.length] || [];
    return rotated.map((player, i) => ({
      ...player,
      visualSeat: seatMap[i] ?? i,
    }));
  }

  const rotatedPlayers = useMemo(() => getRotatedPlayers(), [parsedHand]);

  /* ─────────── Render ─────────── */

  const potLabel = parsedHand?.bigBlind
    ? (snapshot.pot / parsedHand.bigBlind).toFixed(2) + " BB"
    : snapshot.pot;

  function calculateAnteLabel() {
    if (!parsedHand) return "0";
    const ante = parsedHand.anteTotal || 0;
    return parsedHand.bigBlind
      ? (ante / parsedHand.bigBlind).toFixed(2) + " BB"
      : String(ante);
  }

  const displayBets = awardPhase === "none" ? snapshot.visibleBets : visibleBets;
  const nextToAct = getNextActingPlayerName();

  return (
    <div className="poker-wrapper">
      <div className="table-container">
        <div className="table-heading">
          {/* <h1 className="title">Hand Replayer</h1> */}

          {/* NEW: unified uploader grid */}
          <div className="uploader-grid">
            {/* Paste */}
            <button
              type="button"
              className="uploader-card"
              onClick={() => setShowPaste((s) => !s)}
              title="Paste hand history"
              aria-label="Paste hand history"
            >
              <div className="uploader-title">Paste hand history</div>
              <div className="uploader-sub">Paste text from your clipboard</div>
            </button>

            {/* Browse (hidden input triggered) */}
            <button
              type="button"
              className="uploader-card"
              onClick={() => fileInputRef.current?.click()}
              title="Upload hand history"
              aria-label="Upload hand history"
            >
              <div className="uploader-title">Upload hand history</div>
              <div className="uploader-sub">Choose a .txt or .log file</div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.log,.handhistory,text/plain"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />

            {/* Drag & Drop */}
            <button
              type="button"
              className="uploader-card"
              title="Drop hand history"
              aria-label="Drop hand history"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files && e.dataTransfer.files[0];
                if (!f) return;
                const fakeEvent = { target: { files: [f], value: "" } };
                handleFileChange(fakeEvent);
              }}
            >
              <div className="uploader-title">Drop hand history</div>
              <div className="uploader-sub">Drag a .txt or .log file here</div>
            </button>
          </div> 

          <div style={{ width: "var(--table-w)", maxWidth: "min(90vw, var(--table-w))", margin: "1px auto 0", fontSize: 12, color: "#ddd", textAlign: "center" }}>
            Supported: Red Dragon / text exports (.txt, .log). We’ll auto-detect line endings and BOM.
          </div>

          {/* collapsible paste panel */}
          {showPaste && (
            <div className="paste-panel">
              <textarea
                rows={8}
                placeholder="Paste hand history here…"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <div className="paste-actions">
                <button className="step-button" onClick={handlePasteSubmit}>Load</button>
                <button className="step-button" onClick={() => setShowPaste(false)}>Close</button>
              </div>
            </div>
          )}
        </div>

        <div className="table-outer-ring">
          <div className="table">
            {rotatedPlayers.map((player) => {
              const isNextToAct = player.name === nextToAct;
              const folded = snapshot.foldsSet.has(player.name);
              const hasCards = player.cards?.length > 0;
              const isHero = player.seat === 1;
              const isShowdown = currentStage === "showdown";

              return (
                <div
                  key={player.id}
                  className={`seat seat-${player.visualSeat}
                    ${isNextToAct ? "next-acting-player" : ""} 
                    ${folded ? "folded" : ""}`}
                >
                  <div className="player">
                    <div className="cards">
                      {isHero
                        ? (player.cards || []).map((card, i) => (
                            <React.Fragment key={i}>{renderCard(card)}</React.Fragment>
                          ))
                        : isShowdown && hasCards
                        ? player.cards.map((card, i) => (
                            <React.Fragment key={i}>{renderCard(card)}</React.Fragment>
                          ))
                        : [0, 1].map((_, i) => (
                            <div className="card back" key={i}>
                              🂠
                            </div>
                          ))}
                    </div>
                    <div className="player-info">
                      <img src={avatar} alt="avatar" className="avatar" />
                      <div className="name-stack">
                        <div className="name">{player.name}</div>
                        <div className="stack">{remainingChipsLabel(player)}</div>
                        {flashAction?.player === player.name && (
                          <div className="action-flash">
                            {flashAction.action.toUpperCase()}
                          </div>
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

            {rotatedPlayers.map((player) => {
              const betAmount = displayBets[player.name];
              if (!betAmount || betAmount === 0) return null;
              return (
                <div
                  className={`chip-tag chip-tag-${player.visualSeat}`}
                  key={`bet-${player.name}`}
                >
                  {(betAmount / (parsedHand?.bigBlind || 1)).toFixed(2)} BB
                </div>
              );
            })}

            {rotatedPlayers.map((player) => {
              if (player.position === "BTN") {
                return (
                  <div
                    key={`btn-${player.visualSeat}`}
                    className={`button-chip button-chip-${player.visualSeat}`}
                  >
                    B
                  </div>
                );
              }
              return null;
            })}

            <div className="community">
              {visibleBoard.map((card, i) => (
                <React.Fragment key={i}>{renderCard(card)}</React.Fragment>
              ))}
            </div>

            {parsedHand && (
              <div
                className="current-action"
                style={{ textAlign: "center", marginBottom: "1rem" }}
              >
                {(() => {
                  const stageActions = parsedHand.actions[currentStage];
                  if (
                    currentActionIndex === -1 ||
                    !stageActions ||
                    stageActions.length === 0
                  )
                    return null;
                  const current = stageActions[currentActionIndex] || {};
                  const isAntePost =
                    current.action === "posts" &&
                    current.amount <= parsedHand.bigBlind / 2;
                  if (isAntePost) return null;

                  return (
                    <p>
                      <strong>{current?.player}</strong>:{" "}
                      {current?.action === "raises"
                        ? `raises to ${(current.amount / parsedHand.bigBlind).toFixed(2)} BB`
                        : `${current?.action}${
                            current?.amount
                              ? ` ${(current.amount / parsedHand.bigBlind).toFixed(2)} BB`
                              : ""
                          }`}
                    </p>
                  );
                })()}
              </div>
            )}

            <div className="pot">Pot: {potLabel}</div>

            <div className="ante">
              {currentStage === "preflop" ? (
                <span className="ante-label">Ante: {calculateAnteLabel()}</span>
              ) : (
                <span className="ante-label">Pot: {potLabel}</span>
              )}
            </div>
          </div>
        </div>

        <div className="controls-wrapper">
          <div className="stage-controls">
            <button onClick={handlePrev} className="step-button">
              ⬅️
            </button>
            <button onClick={togglePlay} className="step-button">
              {isPlaying ? "⏸️" : "▶️"}
            </button>
            <button onClick={handleNext} className="step-button">
              ➡️
            </button>
            <button
              onClick={() => setShowGto(s => !s)}
              className="step-button"
              title={gtoUrl ? "Show GTO panel" : "No matching range yet"}
            >
              📊 GTO
            </button>
          </div>

          <div className="hand-controls">
            <button
              onClick={() => {
                if (currentHandIndex > 0) {
                  setCurrentHandIndex((i) => i - 1);
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
                  setCurrentHandIndex((i) => i + 1);
                }
              }}
              className="step-button"
            >
              ⏭️
            </button>
          </div>
        </div>
      </div>
    <GtoPanel open={showGto} onClose={()=>setShowGto(false)} url={gtoUrl} />
    </div>

  );
}
