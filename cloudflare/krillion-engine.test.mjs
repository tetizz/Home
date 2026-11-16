import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnswer, isCorrect, getHint, parseProgress, recordResult, getStats, selectSession } from '../krillion/engine.js';

const card = (id, mode = 'Daily') => ({ id, mode, answer: 'São Tomé and Príncipe', answers: ['São Tomé and Príncipe', 'Côte d’Ivoire'] });
const empty = () => parseProgress(null);

test('accent, case, punctuation and whitespace normalize while all top ties are accepted', () => {
  assert.equal(normalizeAnswer('  SÃO TOMÉ-and Príncipe! '), 'saotomeandprincipe');
  assert.equal(isCorrect(card('a'), 'sao tome and principe'), true);
  assert.equal(isCorrect(card('a'), 'COTE D IVOIRE'), true);
  assert.equal(isCorrect(card('a'), 'Cote'), false);
  for (const input of ['', '   ', '!!!', null, undefined]) assert.equal(isCorrect({ answer: '', answers: [''] }, input), false);
});

test('hints retain word lengths and never expose a complete word even at max level', () => {
  assert.equal(getHint({ answer: 'Galaxy Quest' }, 1), 'G••••• Q••••');
  assert.equal(getHint({ answer: 'A BB Cat Galaxy' }, 99), '• B• Ca• Gal•••');
  assert.equal(getHint({ answer: 'A-B' }, 0), '•-•');
});

test('empty and corrupt storage safely starts fresh and malicious keys cannot become progress', () => {
  for (const raw of [null, '', '{bad', '[]', '{"version":2}', 12]) assert.deepEqual(parseProgress(raw), empty());
  const parsed = parseProgress('{"version":1,"cards":{"__proto__":{"stage":5},"a":{"stage":999,"due":-1,"correct":-5,"misses":2,"lastSeen":"x"}},"totalXP":-2,"streak":2,"bestStreak":1}');
  assert.deepEqual(parsed.cards.a, { stage: 5, due: 0, correct: 0, misses: 2, lastSeen: 0 });
  assert.equal(Object.hasOwn(parsed.cards, '__proto__'), false);
  assert.equal(parsed.totalXP, 0);
  assert.equal(parsed.bestStreak, 2);
});

test('spaced clean recalls advance only at due time through the five intervals', () => {
  let progress = empty();
  let now = 1000;
  const intervals = [600000, 86400000, 259200000, 604800000, 1209600000];
  for (let i = 0; i < intervals.length; i++) {
    progress = recordResult(progress, 'a', { correct: true }, now);
    assert.equal(progress.cards.a.stage, i + 1);
    assert.equal(progress.cards.a.due, now + intervals[i]);
    now = progress.cards.a.due;
  }
  assert.equal(progress.totalXP, 500);
  assert.equal(progress.bestStreak, 5);
  assert.equal(getStats([card('a')], progress, now).mastered, 1);
});

test('early repetitions cannot farm stage, XP or streak and do not move review time', () => {
  const initial = empty();
  const first = recordResult(initial, 'a', { correct: true }, 1000);
  const second = recordResult(first, 'a', { correct: true }, 2000);
  assert.equal(second.cards.a.stage, 1);
  assert.equal(second.cards.a.due, 601000);
  assert.equal(second.totalXP, 100);
  assert.equal(second.streak, 1);
  assert.equal(second.cards.a.correct, 2);
  assert.deepEqual(initial, empty());
  assert.equal(first.cards.a.correct, 1);
});

test('misses and assisted recall reset mastery persistently and reveal earns no XP', () => {
  let progress = empty();
  for (const now of [0, 600000, 87000000]) progress = recordResult(progress, 'a', { correct: true }, now);
  const missed = recordResult(progress, 'a', { correct: false, assisted: true }, 87000001);
  assert.equal(missed.cards.a.stage, 0);
  assert.equal(missed.cards.a.due, 87120001);
  assert.equal(missed.cards.a.misses, 1);
  assert.equal(missed.totalXP, 300);
  assert.equal(missed.streak, 0);
  assert.equal(parseProgress(JSON.stringify(missed)).cards.a.stage, 0);
  const helped = recordResult(missed, 'a', { correct: true, assisted: true }, 87120001);
  assert.equal(helped.totalXP, 340);
  assert.equal(helped.cards.a.stage, 0);
  assert.equal(helped.cards.a.correct, 4);
  const repeated = recordResult(helped, 'a', { correct: true, assisted: true }, 87120002);
  assert.equal(repeated.totalXP, 340);
});

test('sessions filter category, deduplicate and prioritize due before new', () => {
  const cards = [card('new'), card('due'), card('later'), card('other', 'Movies'), card('due')];
  let progress = recordResult(empty(), 'due', { correct: false }, 0);
  progress = recordResult(progress, 'later', { correct: true }, 200000);
  assert.deepEqual(selectSession(cards, progress, { mode: 'mixed', category: 'Daily', length: 10 }, 200000, () => 0).map(c => c.id), ['due', 'new']);
  assert.deepEqual(selectSession(cards, progress, { mode: 'review' }, 200000).map(c => c.id), ['due']);
  assert.deepEqual(selectSession(cards, progress, { mode: 'new', category: 'Movies' }, 200000).map(c => c.id), ['other']);
  assert.deepEqual(selectSession(cards, progress, { mode: 'new', category: 'Unknown' }), []);
  assert.deepEqual(selectSession(cards, progress, { length: 0 }), []);
});

test('missed practice excludes mastered historical misses, exhausted review stays empty, selection deterministic', () => {
  const progress = parseProgress({ version: 1, cards: { a: { stage: 3, due: 10000, misses: 2 }, b: { stage: 0, due: 10000, misses: 1 } } });
  const cards = [card('a'), card('b'), card('c'), card('d')];
  assert.deepEqual(selectSession(cards, progress, { mode: 'missed' }, 0).map(c => c.id), ['b']);
  assert.deepEqual(selectSession(cards, progress, { mode: 'review' }, 0), []);
  assert.deepEqual(selectSession(cards, progress, { mode: 'new' }, 0, () => 0).map(c => c.id), ['d', 'c']);
  assert.deepEqual(getStats(cards, progress, 10000), { total: 4, seen: 2, mastered: 1, due: 2, xp: 0, bestStreak: 0 });
});

test('a card id matching an inherited property still begins unseen and saves normally', () => {
  const cards = [card('toString')];
  assert.equal(getStats(cards, empty(), 0).seen, 0);
  assert.equal(selectSession(cards, empty(), { mode: 'new' }, 0).length, 1);
  const progress = recordResult(empty(), 'toString', { correct: true }, 0);
  assert.equal(progress.cards.toString.stage, 1);
  assert.equal(progress.totalXP, 100);
});
