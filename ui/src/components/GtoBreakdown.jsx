import React, { useState } from "react";
import { Link } from "react-router-dom";
import styles from "../css/GtoBreakdown.module.css";

const stages = ["preflop", "flop", "turn", "river"];
const ranks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

const rankValues = {
  A: 14, K: 13, Q: 12, J: 11, T: 10,
  "9": 9, "8": 8, "7": 7, "6": 6, "5": 5, "4": 4, "3": 3, "2": 2
};

const top15Hands = new Set([
  "AA", "KK", "QQ", "JJ", "TT",
  "AKs", "AQs", "AJs", "ATs",
  "KQs", "KJs",
  "AKo", "AQo", "KQo"
]);

const callHands = new Set([
  "KJo", "QJo", "JTo", "T9s", "98s", "87s", "76s", "65s"
]);

function generatePreflopGrid() {
  return ranks.map((rowRank, rowIdx) =>
    ranks.map((colRank, colIdx) => {
      const isPair = rowRank === colRank;
      const suited = rowIdx > colIdx;
      const high = rankValues[rowRank] >= rankValues[colRank] ? rowRank : colRank;
      const low = rankValues[rowRank] >= rankValues[colRank] ? colRank : rowRank;
      const label = isPair ? rowRank + rowRank : high + low + (suited ? "s" : "o");

      if (top15Hands.has(label)) {
        return {
          label,
          mix: { raise: 0.8, call: 0.2, fold: 0.0 },
          ev: { raise: 1.5, call: 0.4, fold: 0.0 }
        };
      } else if (callHands.has(label)) {
        return {
          label,
          mix: { raise: 0.0, call: 0.6, fold: 0.4 },
          ev: { raise: -0.2, call: 0.3, fold: 0.0 }
        };
      } else {
        return {
          label,
          mix: { raise: 0.0, call: 0.0, fold: 1.0 },
          ev: { raise: -1.0, call: -0.6, fold: 0.0 }
        };
      }
    })
  );
}

const getStageGrid = (stage) => generatePreflopGrid();

export default function GtoBreakdown() {
  const [currentStage, setCurrentStage] = useState("preflop");
  const gtoMatrix = getStageGrid(currentStage);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>GTO BREAKDOWN: {currentStage.toUpperCase()}</h1>

      <div className={styles.stageSelector}>
        {stages.map((stage) => (
          <button
            key={stage}
            onClick={() => setCurrentStage(stage)}
            className={`${styles.stageButton} ${
              currentStage === stage ? styles.activeStage : ""
            }`}
          >
            {stage.charAt(0).toUpperCase() + stage.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {gtoMatrix.map((row, rowIdx) => (
          <div key={rowIdx} className={styles.row}>
            {row.map(({ label, mix, ev }, colIdx) => (
              <div key={colIdx} className={styles.cell}>
                <div className={styles.mixBar}>
                  <div className={styles.raiseBar} style={{ flex: mix.raise }} />
                  <div className={styles.callBar} style={{ flex: mix.call }} />
                  <div className={styles.foldBar} style={{ flex: mix.fold }} />
                </div>
                <div className={styles.cellLabel}>{label}</div>
                <div className={styles.tooltip}>
                  {Object.entries(ev).map(([action, value]) => (
                    <div key={action}>
                      <strong>{action.charAt(0).toUpperCase() + action.slice(1)}:</strong>{" "}
                      {value.toFixed(2)} BB
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.legend}>
        <div><span className={`${styles.legendBox} ${styles.raiseBar}`}></span> Raise</div>
        <div><span className={`${styles.legendBox} ${styles.callBar}`}></span> Call</div>
        <div><span className={`${styles.legendBox} ${styles.foldBar}`}></span> Fold</div>
      </div>

      <Link to="/" className={styles.backButton}>← Back to Hand Replayer</Link>
    </div>
  );
}
