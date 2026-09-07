const STORAGE_KEY = "poker-app-hand-tags-v1";

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Stable-ish id for a hand history block. */
export function getHandKey(hand) {
  if (!hand) return null;
  const raw = (hand.raw || "").trim();
  const firstLine = raw.split("\n")[0] || "";
  const idMatch = firstLine.match(/Hand #(\d+)/i);
  if (idMatch) {
    const site = hand.site || "unknown";
    return `${site}:${idMatch[1]}`;
  }
  // Fallback: short fingerprint from header + hero cards
  const hero = hand.hero || "";
  const cards = (hand.heroCards || []).join("");
  return `raw:${firstLine.slice(0, 80)}:${hero}:${cards}`;
}

export function getHandTags(handKey) {
  if (!handKey) return [];
  const store = readStore();
  const tags = store[handKey];
  return Array.isArray(tags) ? tags : [];
}

export function setHandTags(handKey, tags) {
  if (!handKey) return;
  const store = readStore();
  const cleaned = [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))];
  if (cleaned.length === 0) delete store[handKey];
  else store[handKey] = cleaned;
  writeStore(store);
}

export function addHandTag(handKey, tag) {
  const next = [...getHandTags(handKey), tag];
  setHandTags(handKey, next);
  return getHandTags(handKey);
}

export function removeHandTag(handKey, tag) {
  const next = getHandTags(handKey).filter((t) => t !== tag);
  setHandTags(handKey, next);
  return next;
}

export const SUGGESTED_TAGS = [
  "review",
  "bluff",
  "value",
  "mistake",
  "good",
  "cooler",
  "ICM",
];

export function formatCardShort(card) {
  if (!card || card.length < 2) return "?";
  const rank = card.slice(0, -1);
  const suit = card.slice(-1).toLowerCase();
  const suitChar = { h: "♥", d: "♦", s: "♠", c: "♣" }[suit] || suit;
  return `${rank}${suitChar}`;
}

export function summarizeHand(hand) {
  if (!hand) return { heroCards: "—", result: "—", position: "" };
  const heroCards = (hand.heroCards || []).map(formatCardShort).join(" ") || "—";
  const position = hand.players?.[hand.hero]?.position || "";
  let result = "played";
  if (hand.winner && hand.hero) {
    result = hand.winner === hand.hero ? "won" : "lost";
  } else if (hand.eliminations?.some((e) => e.player === hand.hero)) {
    result = "busted";
  }
  return { heroCards, result, position };
}
