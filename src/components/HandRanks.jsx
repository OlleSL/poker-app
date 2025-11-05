import React, { useState } from "react";
import "../css/HandRanks.css";

// tiny helper so we can target suits in CSS
function Card({ v, s }) {
  const suitChar = { h: "♥", d: "♦", s: "♠", c: "♣" }[s];
  return (
    <span className="hr-card" data-suit={s}>
      {v}{suitChar}
    </span>
  );
}

export default function HandRanks() {
  const [mode, setMode] = useState("examples"); // "examples" | "simple"

  return (
    <aside className="handranks">
      <header className="handranks__header">
        <div className="handranks__title">Hand Rankings</div>

        <div className="handranks__toggles" role="tablist" aria-label="Hand ranking view">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "examples"}
            className={`hr-tab ${mode === "examples" ? "is-active" : ""}`}
            onClick={() => setMode("examples")}
          >
            Examples
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "simple"}
            className={`hr-tab ${mode === "simple" ? "is-active" : ""}`}
            onClick={() => setMode("simple")}
          >
            Simple
          </button>
        </div>
      </header>

      {mode === "simple" ? (
        <ol className="handranks__simple">
          <li>Royal Flush</li>
          <li>Straight Flush</li>
          <li>Four of a Kind</li>
          <li>Full House</li>
          <li>Flush</li>
          <li>Straight</li>
          <li>Three of a Kind</li>
          <li>Two Pair</li>
          <li>One Pair</li>
          <li>High Card</li>
        </ol>
      ) : (
        <ul className="handranks__list">
          <li className="handranks__item">
            <div className="handranks__name">Royal Flush</div>
            <div className="handranks__cards">
              <Card v="A" s="h" /><Card v="K" s="h" /><Card v="Q" s="h" /><Card v="J" s="h" /><Card v="T" s="h" />
            </div>
            <div className="handranks__note">Highest possible straight flush.</div>
          </li>

          <li className="handranks__item">
            <div className="handranks__name">Straight Flush</div>
            <div className="handranks__cards">
              <Card v="9" s="c" /><Card v="8" s="c" /><Card v="7" s="c" /><Card v="6" s="c" /><Card v="5" s="c" />
            </div>
            <div className="handranks__note">Ranks by highest card in the straight.</div>
          </li>

          <li className="handranks__item">
            <div className="handranks__name">Four of a Kind</div>
            <div className="handranks__cards">
              <Card v="Q" s="s" /><Card v="Q" s="h" /><Card v="Q" s="d" /><Card v="Q" s="c" /><Card v="7" s="d" />
            </div>
            <div className="handranks__note">Kicker breaks ties.</div>
          </li>

          <li className="handranks__item">
            <div className="handranks__name">Full House</div>
            <div className="handranks__cards">
              <Card v="J" s="s" /><Card v="J" s="h" /><Card v="J" s="d" /><Card v="9" s="c" /><Card v="9" s="h" />
            </div>
            <div className="handranks__note">Ranked by trips, then pair.</div>
          </li>

          <li className="handranks__item">
            <div className="handranks__name">Flush</div>
            <div className="handranks__cards">
              <Card v="A" s="d" /><Card v="J" s="d" /><Card v="9" s="d" /><Card v="6" s="d" /><Card v="2" s="d" />
            </div>
            <div className="handranks__note">Compare highest card, then next, etc.</div>
          </li>

          <li className="handranks__item">
            <div className="handranks__name">Straight</div>
            <div className="handranks__cards">
              <Card v="8" s="s" /><Card v="7" s="d" /><Card v="6" s="h" /><Card v="5" s="c" /><Card v="4" s="h" />
            </div>
            <div className="handranks__note">A-2-3-4-5 is the lowest straight.</div>
          </li>

          <li className="handranks__item">
            <div className="handranks__name">Three of a Kind</div>
            <div className="handranks__cards">
              <Card v="9" s="s" /><Card v="9" s="h" /><Card v="9" s="d" /><Card v="K" s="c" /><Card v="6" s="d" />
            </div>
            <div className="handranks__note">Two kickers to break ties.</div>
          </li>

          <li className="handranks__item">
            <div className="handranks__name">Two Pair</div>
            <div className="handranks__cards">
              <Card v="K" s="s" /><Card v="K" s="h" /><Card v="7" s="d" /><Card v="7" s="c" /><Card v="3" s="h" />
            </div>
            <div className="handranks__note">Higher pair → lower pair → kicker.</div>
          </li>

          <li className="handranks__item">
            <div className="handranks__name">One Pair</div>
            <div className="handranks__cards">
              <Card v="A" s="s" /><Card v="A" s="h" /><Card v="Q" s="d" /><Card v="8" s="c" /><Card v="4" s="h" />
            </div>
            <div className="handranks__note">Kickers decide after the pair.</div>
          </li>

          <li className="handranks__item">
            <div className="handranks__name">High Card</div>
            <div className="handranks__cards">
              <Card v="A" s="c" /><Card v="J" s="h" /><Card v="9" s="s" /><Card v="6" s="d" /><Card v="3" s="c" />
            </div>
            <div className="handranks__note">Compare highest to lowest.</div>
          </li>
        </ul>
      )}

      <footer className="handranks__footer">
        <div className="handranks__tipsTitle">Tie-breakers</div>
        <ul className="handranks__tips">
          <li>Flush / High-card: compare highest, then next, etc.</li>
          <li>Straights: highest card wins (A-2-3-4-5 is the wheel).</li>
          <li>Full House: compare trips, then the pair.</li>
          <li>Two Pair: high pair → low pair → kicker.</li>
        </ul>
      </footer>
    </aside>
  );
}
