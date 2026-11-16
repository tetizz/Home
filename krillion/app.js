import { META, QUESTIONS } from './data.js';
import { isCorrect, getHint, parseProgress, recordResult, getStats, selectSession } from './engine.js';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'krillion-recall-progress-v1';
const views = ['home', 'library', 'session', 'summary'];
const formatNumber = value => Number(value || 0).toLocaleString('en-US');
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const sourceURL = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
let progress = parseProgress(null);
let storageReady = true;
let session = null;
let currentView = 'home';
let libraryLimit = 30;
let searchTimer;

function showNotice(message) {
  $('storage-warning').textContent = message;
  $('storage-warning').hidden = false;
}

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const decoded = JSON.parse(raw);
    if (!decoded || decoded.version !== 1 || !decoded.cards || Array.isArray(decoded.cards)) throw new Error('Invalid saved progress');
    progress = parseProgress(decoded);
  }
} catch {
  showNotice('Saved progress could not be opened. You can keep practicing and import a backup below.');
  try { localStorage.setItem(`${STORAGE_KEY}-check`, '1'); localStorage.removeItem(`${STORAGE_KEY}-check`); }
  catch { storageReady = false; }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    storageReady = true;
    $('save-status').textContent = 'Progress saved in this browser';
  } catch {
    storageReady = false;
    $('save-status').textContent = 'Progress is in memory only';
    showNotice('Your browser is not saving progress right now. Practice still works. Export a backup before closing this page.');
  }
}

function updateStats() {
  const stats = getStats(QUESTIONS, progress);
  $('stat-seen').innerHTML = `${formatNumber(stats.seen)}<span> / ${formatNumber(stats.total)}</span>`;
  $('stat-mastered').textContent = formatNumber(stats.mastered);
  $('stat-due').textContent = formatNumber(stats.due);
  $('stat-xp').textContent = formatNumber(stats.xp);
  if (!storageReady) $('save-status').textContent = 'Progress is in memory only';
}

function showView(name, focus = false) {
  currentView = views.includes(name) ? name : 'home';
  views.forEach(view => { $(`${view}-view`).hidden = view !== currentView; });
  $('practice-nav').classList.toggle('active', currentView !== 'library');
  $('library-nav').classList.toggle('active', currentView === 'library');
  updateStats();
  if (currentView === 'library') renderLibrary();
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (focus) $('main').focus({ preventScroll: true });
}

function updatePreview() {
  const form = new FormData($('setup-form'));
  const names = { mixed: 'mixed practice', new: 'new answers', review: 'due for review', missed: 'missed before' };
  $('session-preview').textContent = `${form.get('rounds')} questions · ${names[form.get('deck')]}`;
  $('empty-deck').hidden = true;
}

function startSession(cards) {
  if (!cards.length) return;
  session = {
    queue: cards.map(card => ({ card, repeated: false })), index: 0, graded: false,
    hintLevel: 0, initialCount: cards.length, firstResults: new Map(), requeued: new Set(),
    missed: new Map(), earnedXP: 0, completed: 0, repeatedCompleted: 0
  };
  showView('session');
  renderQuestion();
}

$('setup-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const mode = String(form.get('deck'));
  const category = String(form.get('mode'));
  const cards = selectSession(QUESTIONS, progress, { mode, category, length: Number(form.get('rounds')) });
  if (!cards.length) {
    const categoryLabel = category === 'All' ? 'this ocean' : category;
    const messages = {
      review: `Nothing is due in ${categoryLabel} right now. Nicely done. Try Mixed or New answers, or come back when a review is ready.`,
      missed: `No missed answers to revisit in ${categoryLabel}. Try a few new ones.`,
      new: `You’ve seen every answer in ${categoryLabel}. Try another category, or review when your next cards are due.`,
      mixed: `You’re up to date in ${categoryLabel}. Try another category or Missed before, or come back when a review is ready.`
    };
    $('empty-deck').textContent = messages[mode] || messages.mixed;
    $('empty-deck').hidden = false;
    return;
  }
  $('empty-deck').hidden = true;
  startSession(cards);
});
$('setup-form').addEventListener('change', updatePreview);

function sourceMarkup(card) {
  const official = /official/i.test(card.sourceType || '') && !/fan|community/i.test(card.sourceType || '');
  const label = official ? 'Official public reveal' : 'Historical public fan transcription';
  const url = sourceURL(card.sourceUrl);
  return `<p class="source-line">${escapeHTML(card.mode)} · Dive ${escapeHTML(card.dive)} · Prompt ${escapeHTML(card.round)}${card.sourceDate ? ` · ${escapeHTML(card.sourceDate)}` : ''}<br>${label}${official ? '' : '. Historical answers have not been independently verified against the official game.'}${url ? `<br><a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">View answer source ↗</a>` : ''}</p>`;
}

function renderQuestion() {
  if (!session || session.index >= session.queue.length) { finishSession(); return; }
  const { card, repeated } = session.queue[session.index];
  session.graded = false;
  session.hintLevel = 0;
  $('card-mode').textContent = `${card.mode} · ${card.dive}`;
  $('repeat-label').hidden = !repeated;
  $('card-question').textContent = card.question;
  $('session-position').textContent = `${session.index + 1} of ${session.queue.length}${repeated ? ' · review' : ''}`;
  const percent = Math.round(session.index / session.queue.length * 100);
  $('session-progress-fill').style.width = `${percent}%`;
  document.querySelector('.session-progress').setAttribute('aria-valuenow', String(percent));
  $('session-xp').textContent = `${formatNumber(session.earnedXP)} XP this dive`;
  $('answer-input').value = '';
  $('answer-input').disabled = false;
  $('answer-actions').hidden = false;
  $('hint-text').hidden = true;
  $('hint-text').textContent = '';
  $('hint-button').disabled = false;
  $('hint-button').innerHTML = 'A little hint <span aria-hidden="true">✳</span>';
  $('feedback').hidden = true;
  $('feedback').replaceChildren();
  $('graded-actions').hidden = true;
  $('card-source').open = false;
  $('card-source-content').innerHTML = sourceMarkup(card);
  requestAnimationFrame(() => $('answer-input').focus({ preventScroll: true }));
}

$('hint-button').addEventListener('click', () => {
  if (!session || session.graded) return;
  session.hintLevel = Math.min(3, session.hintLevel + 1);
  const card = session.queue[session.index].card;
  $('hint-text').textContent = getHint(card, session.hintLevel);
  $('hint-text').hidden = false;
  $('hint-button').textContent = session.hintLevel === 3 ? 'That’s all the hints' : 'A little more help';
  $('hint-button').disabled = session.hintLevel === 3;
  $('answer-input').focus({ preventScroll: true });
});

function queueRetry(card) {
  if (session.requeued.has(card.id)) return false;
  const upcoming = session.queue.slice(session.index + 1);
  // An encore must follow at least two other prompts. Tail misses stay in the
  // summary review list instead of creating an immediate answer-copy loop.
  let otherPrompts = 0;
  let insertion = -1;
  for (let index = 0; index < upcoming.length; index++) {
    if (upcoming[index].card.id !== card.id) otherPrompts++;
    if (otherPrompts >= 2) { insertion = session.index + index + 2; break; }
  }
  if (insertion < 0) return false;
  session.queue.splice(insertion, 0, { card, repeated: true });
  session.requeued.add(card.id);
  return true;
}

function grade(revealed = false) {
  if (!session || session.graded) return;
  const item = session.queue[session.index];
  const card = item.card;
  const input = $('answer-input').value.trim();
  if (!revealed && !input) { $('answer-input').focus(); return; }
  session.graded = true;
  const correct = !revealed && isCorrect(card, input);
  const assisted = revealed || session.hintLevel > 0;
  const beforeXP = progress.totalXP;
  progress = recordResult(progress, card.id, { correct, assisted });
  const earned = Math.max(0, progress.totalXP - beforeXP);
  session.earnedXP += earned;
  session.completed++;
  if (item.repeated) session.repeatedCompleted++;
  if (!session.firstResults.has(card.id)) session.firstResults.set(card.id, { correct, assisted });
  if (!correct || assisted) session.missed.set(card.id, card);
  else session.missed.delete(card.id);
  const retry = (!correct || assisted) && !item.repeated ? queueRetry(card) : false;
  saveProgress();
  updateStats();
  $('answer-input').disabled = true;
  $('answer-actions').hidden = true;
  $('hint-text').hidden = true;
  const feedback = $('feedback');
  feedback.className = `feedback${!correct ? ' missed' : assisted ? ' assisted' : ''}`;
  const heading = correct ? assisted ? 'A little help. A little progress.' : 'That’s the one.' : revealed ? 'Meet your next good answer.' : 'A new one to remember.';
  const explanation = correct && !assisted
    ? earned ? 'Remembered, all by yourself. A good one to keep.' : 'A clean recall. Your next scheduled review is where more XP is waiting.'
    : retry ? 'Let it sink in. We’ll circle back after a couple of other prompts.' : 'Take a moment with it. You can revisit this one after the dive.';
  const valid = [...new Set(card.answers?.length ? card.answers : [card.answer])];
  feedback.innerHTML = `<div class="feedback-heading"><h2>${heading}</h2><span class="feedback-xp">${earned ? `+${earned}` : '0'} XP</span></div><p>${explanation}${valid.length > 1 ? ' Any of these top answers counts.' : ''}</p><ul class="answer-list">${valid.map(answer => `<li>${escapeHTML(answer)}</li>`).join('')}</ul>`;
  feedback.hidden = false;
  $('graded-actions').hidden = false;
  $('next-button').innerHTML = `${session.index + 1 >= session.queue.length ? 'See how you did' : 'Next question'} <span aria-hidden="true">→</span>`;
  $('session-position').textContent = `${session.index + 1} of ${session.queue.length}${item.repeated ? ' · review' : ''}`;
  $('session-xp').textContent = `${formatNumber(session.earnedXP)} XP this dive`;
  $('next-button').focus({ preventScroll: true });
}

$('answer-form').addEventListener('submit', event => { event.preventDefault(); grade(false); });
$('reveal-button').addEventListener('click', () => grade(true));
function nextQuestion() {
  if (!session || !session.graded) return;
  session.index++;
  if (session.index >= session.queue.length) finishSession();
  else renderQuestion();
}
$('next-button').addEventListener('click', nextQuestion);
document.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.repeat || currentView !== 'session' || !session?.graded) return;
  const target = event.target;
  if (target instanceof HTMLElement && target.closest('a,summary')) return;
  if (target === $('next-button')) return; // Native button activation handles it.
  event.preventDefault();
  nextQuestion();
});
$('leave-session').addEventListener('click', () => { session = null; showView('home', true); });

function finishSession() {
  if (!session) { showView('home'); return; }
  const first = [...session.firstResults.values()];
  const clean = first.filter(result => result.correct && !result.assisted).length;
  const assisted = first.filter(result => result.correct && result.assisted).length;
  const missed = first.filter(result => !result.correct).length;
  $('summary-clean').textContent = `${clean} / ${session.initialCount}`;
  $('summary-assisted').textContent = String(assisted);
  $('summary-missed').textContent = String(missed);
  $('summary-xp').textContent = `+${formatNumber(session.earnedXP)}`;
  $('summary-description').textContent = clean === session.initialCount
    ? 'Every answer, remembered without a peek. That’s a good dive.'
    : 'Every answer you met is one more you can remember. Come back for a little review.';
  $('summary-repeats').textContent = session.repeatedCompleted
    ? `${session.repeatedCompleted} extra recall ${session.repeatedCompleted === 1 ? 'attempt' : 'attempts'} helped the tricky answers sink in.`
    : 'Your next reviews are scheduled. A few spaced recalls make an answer stick.';
  $('review-missed').hidden = session.missed.size === 0;
  showView('summary', true);
}
$('review-missed').addEventListener('click', () => {
  const missed = session ? [...session.missed.values()] : [];
  if (missed.length) startSession(missed);
});
$('new-round').addEventListener('click', () => { session = null; showView('home', true); $('start-button').focus(); });
$('summary-home').addEventListener('click', () => { session = null; showView('home', true); });

function renderLibrary() {
  const query = $('library-search').value.trim().toLocaleLowerCase();
  const mode = $('library-mode').value;
  const matches = QUESTIONS.filter(card => (mode === 'All' || card.mode === mode) && (!query || `${card.question} ${card.answers.join(' ')}`.toLocaleLowerCase().includes(query)));
  $('library-count').textContent = `${formatNumber(matches.length)} ${matches.length === 1 ? 'prompt' : 'prompts'}`;
  const visible = matches.slice(0, libraryLimit);
  $('library-list').innerHTML = visible.length ? visible.map(card => `<article class="library-card"><div class="card-meta"><span class="mode-tag">${escapeHTML(card.mode)} · ${escapeHTML(card.dive)}</span><span class="point-tag">100 POINTS <span aria-hidden="true">✦</span></span></div><h2>${escapeHTML(card.question)}</h2><details><summary>Reveal the ${card.answers.length > 1 ? 'answers' : 'answer'}</summary><p class="library-answer">${escapeHTML(card.answer)}</p>${card.answers.length > 1 ? `<ul class="answer-list">${card.answers.slice(1).map(answer => `<li>${escapeHTML(answer)}</li>`).join('')}</ul>` : ''}${sourceMarkup(card)}</details></article>`).join('') : '<p class="library-empty">No prompts here yet. Try a different word or another mode.</p>';
  $('load-more').hidden = matches.length <= libraryLimit;
}
$('library-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { libraryLimit = 30; renderLibrary(); }, 120); });
$('library-mode').addEventListener('change', () => { libraryLimit = 30; renderLibrary(); });
$('load-more').addEventListener('click', () => { libraryLimit += 30; renderLibrary(); });

document.querySelectorAll('a[href="#home"],a[href="#library"]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  showView(link.getAttribute('href') === '#library' ? 'library' : 'home');
}));

$('export-progress').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'krillion-recall-progress.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('import-progress').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2000000) throw new Error('This backup is too large. Choose a Krillion Recall progress file.');
    const decoded = JSON.parse(await file.text());
    if (decoded?.version !== 1 || !decoded.cards || typeof decoded.cards !== 'object' || Array.isArray(decoded.cards)) throw new Error('This is not a Krillion Recall progress backup.');
    progress = parseProgress(decoded);
    session = null;
    saveProgress();
    updateStats();
    showView('home', true);
    showNotice(storageReady ? 'Progress imported. Welcome back to your ocean.' : 'Progress imported for this visit. Export a backup before you close this page.');
  } catch (error) { showNotice(error instanceof Error ? error.message : 'Could not import that backup. Your current progress is safe.'); }
  finally { event.target.value = ''; }
});

$('nav-count').textContent = formatNumber(META.count || QUESTIONS.length);
$('source-footer').textContent = `${formatNumber(QUESTIONS.length)} prompts with listed 100-point answers · As of ${META.asOf}. Includes official reveals and historical fan transcriptions. Practice here; play the original game on Krillion.`;
updatePreview();
updateStats();
showView(location.hash === '#library' ? 'library' : 'home');
setInterval(() => { if (currentView === 'home') updateStats(); }, 30000);
