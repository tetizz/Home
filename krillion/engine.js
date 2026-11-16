const INTERVALS = [600000, 86400000, 259200000, 604800000, 1209600000];
const EMPTY = () => ({ version: 1, cards: {}, totalXP: 0, streak: 0, bestStreak: 0 });
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const timestamp = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
const savedEntry = (progress, id) => Object.hasOwn(progress.cards, id) ? progress.cards[id] : undefined;

export function normalizeAnswer(text) {
  if (typeof text !== 'string') return '';
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/œ/g, 'oe')
    .replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/ð/g, 'd')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function isCorrect(card, input) {
  const normalized = normalizeAnswer(input);
  if (!normalized) return false;
  const answers = [card?.answer, ...(Array.isArray(card?.answers) ? card.answers : [])];
  return answers.some(answer => normalizeAnswer(answer) === normalized);
}

export function getHint(card, level = 1) {
  const reveal = Math.max(0, Math.min(3, Math.floor(Number(level) || 0)));
  return String(card?.answer || '').replace(/[\p{L}\p{N}]+/gu, word => {
    const chars = Array.from(word);
    const visible = Math.min(reveal, Math.max(0, chars.length - 1));
    return chars.slice(0, visible).join('') + '•'.repeat(chars.length - visible);
  });
}

export function parseProgress(raw) {
  let value = raw;
  try { if (typeof raw === 'string') value = JSON.parse(raw); } catch { return EMPTY(); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) return EMPTY();
  const progress = EMPTY();
  const cards = value.cards;
  if (cards && typeof cards === 'object' && !Array.isArray(cards)) {
    for (const [id, entry] of Object.entries(cards)) {
      if (!id || ['__proto__', 'constructor', 'prototype'].includes(id) || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      progress.cards[id] = {
        stage: Math.min(5, count(entry.stage)), due: timestamp(entry.due),
        correct: count(entry.correct), misses: count(entry.misses), lastSeen: timestamp(entry.lastSeen)
      };
    }
  }
  progress.totalXP = count(value.totalXP);
  progress.streak = count(value.streak);
  progress.bestStreak = Math.max(progress.streak, count(value.bestStreak));
  return progress;
}

export function recordResult(progress, cardId, { correct, assisted = false }, now = Date.now()) {
  const next = parseProgress(progress);
  if (typeof cardId !== 'string' || !cardId || ['__proto__', 'constructor', 'prototype'].includes(cardId)) return next;
  now = timestamp(now);
  const previous = savedEntry(next, cardId);
  const eligible = !previous || previous.due <= now;
  const entry = previous ? { ...previous } : { stage: 0, due: 0, correct: 0, misses: 0, lastSeen: 0 };
  entry.lastSeen = now;
  if (correct === true) {
    entry.correct += 1;
    if (assisted) {
      entry.stage = 0;
      entry.due = now + 120000;
      next.streak = 0;
      if (eligible) next.totalXP += 40;
    } else if (eligible) {
      entry.stage = Math.min(5, entry.stage + 1);
      entry.due = now + INTERVALS[entry.stage - 1];
      next.totalXP += 100;
      next.streak += 1;
      next.bestStreak = Math.max(next.bestStreak, next.streak);
    }
  } else {
    entry.misses += 1;
    entry.stage = 0;
    entry.due = now + 120000;
    next.streak = 0;
  }
  next.cards[cardId] = entry;
  return next;
}

function uniqueCards(cards, category = 'All') {
  const seen = new Set();
  return (Array.isArray(cards) ? cards : []).filter(card => {
    if (!card || typeof card.id !== 'string' || !card.id || seen.has(card.id) || (category !== 'All' && card.mode !== category)) return false;
    seen.add(card.id);
    return true;
  });
}

export function getStats(cards, progress, now = Date.now()) {
  const saved = parseProgress(progress);
  const deck = uniqueCards(cards);
  const entries = deck.map(card => savedEntry(saved, card.id)).filter(Boolean);
  return {
    total: deck.length, seen: entries.length, mastered: entries.filter(entry => entry.stage >= 3).length,
    due: entries.filter(entry => entry.due <= now).length, xp: saved.totalXP, bestStreak: saved.bestStreak
  };
}

export function selectSession(cards, progress, options = {}, now = Date.now(), random = Math.random) {
  const { mode = 'mixed', category = 'All', length = 10 } = options;
  const saved = parseProgress(progress);
  const deck = uniqueCards(cards, category);
  const limit = Number.isFinite(length) ? Math.max(0, Math.floor(length)) : 10;
  const shuffle = values => {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const draw = random();
      const j = Math.floor((Number.isFinite(draw) ? Math.min(Math.max(draw, 0), 0.9999999999999999) : 0) * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  const due = deck.filter(card => savedEntry(saved, card.id)?.due <= now);
  const unseen = deck.filter(card => !savedEntry(saved, card.id));
  let selected;
  if (mode === 'new') selected = shuffle(unseen);
  else if (mode === 'review') selected = shuffle(due);
  else if (mode === 'missed') selected = shuffle(deck.filter(card => savedEntry(saved, card.id)?.misses > 0 && savedEntry(saved, card.id).stage < 3));
  else selected = [...shuffle(due), ...shuffle(unseen)];
  return selected.slice(0, limit);
}
