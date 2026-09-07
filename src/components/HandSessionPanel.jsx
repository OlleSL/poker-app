import React, { useEffect, useMemo, useState } from "react";
import {
  SUGGESTED_TAGS,
  addHandTag,
  getHandKey,
  getHandTags,
  removeHandTag,
  summarizeHand,
} from "../utils/handMeta";
import "../css/HandSessionPanel.css";

export default function HandSessionPanel({
  hands,
  currentHandIndex,
  onSelectHand,
}) {
  const [tagDraft, setTagDraft] = useState("");
  const [tagVersion, setTagVersion] = useState(0);

  const currentHand = hands[currentHandIndex] || null;
  const currentKey = getHandKey(currentHand);

  const currentTags = useMemo(() => {
    void tagVersion;
    return getHandTags(currentKey);
  }, [currentKey, tagVersion]);

  useEffect(() => {
    setTagDraft("");
  }, [currentKey]);

  function refreshTags() {
    setTagVersion((v) => v + 1);
  }

  function handleAddTag(tag) {
    if (!currentKey || !tag.trim()) return;
    addHandTag(currentKey, tag.trim());
    refreshTags();
    setTagDraft("");
  }

  function handleRemoveTag(tag) {
    if (!currentKey) return;
    removeHandTag(currentKey, tag);
    refreshTags();
  }

  if (!hands.length) return null;

  return (
    <aside className="session-panel" aria-label="Session hands">
      <div className="session-panel__header">
        <div className="session-panel__title">Hands</div>
        <div className="session-panel__count">{hands.length}</div>
      </div>

      <div className="session-panel__list" role="list">
        {hands.map((hand, index) => {
          const key = getHandKey(hand) || `idx-${index}`;
          const { heroCards, result, position } = summarizeHand(hand);
          const tags = getHandTags(key);
          const active = index === currentHandIndex;
          return (
            <button
              type="button"
              role="listitem"
              key={key}
              className={`session-hand${active ? " is-active" : ""}`}
              onClick={() => onSelectHand(index)}
            >
              <div className="session-hand__top">
                <span className="session-hand__num">#{index + 1}</span>
                <span className="session-hand__cards">{heroCards}</span>
                {position ? (
                  <span className="session-hand__pos">{position}</span>
                ) : null}
                <span className={`session-hand__result is-${result}`}>
                  {result}
                </span>
              </div>
              {tags.length > 0 && (
                <div className="session-hand__tags">
                  {tags.map((t) => (
                    <span key={t} className="session-tag is-compact">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="session-panel__tags">
        <div className="session-panel__tags-title">Tags for this hand</div>
        <div className="session-panel__tag-row">
          {currentTags.length === 0 && (
            <span className="session-panel__empty-tags">No tags yet</span>
          )}
          {currentTags.map((tag) => (
            <button
              type="button"
              key={tag}
              className="session-tag"
              onClick={() => handleRemoveTag(tag)}
              title="Remove tag"
            >
              {tag} ×
            </button>
          ))}
        </div>
        <form
          className="session-panel__tag-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleAddTag(tagDraft);
          }}
        >
          <input
            type="text"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            placeholder="Add tag…"
            maxLength={32}
            disabled={!currentKey}
          />
          <button type="submit" className="session-panel__add" disabled={!tagDraft.trim()}>
            Add
          </button>
        </form>
        <div className="session-panel__suggestions">
          {SUGGESTED_TAGS.filter((t) => !currentTags.includes(t)).map((tag) => (
            <button
              type="button"
              key={tag}
              className="session-tag is-suggest"
              onClick={() => handleAddTag(tag)}
            >
              + {tag}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
