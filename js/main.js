// js/main.js —— 入口：取题 → 渲染 → 作答 → 结算 → 分享
import { loadBank } from './load.js';
import { buildShare, finish, copyText, shareText } from './settle.js';
import * as Game from './game.js';

const TZ = 'America/New_York';
const PER_ROUND = 7;
const MAX_TRIES = 3;
const MAX_SCORE = PER_ROUND * 100;          // 7 题 × 100 = 700

const $ = (s, r = document) => r.querySelector(s);
function el(tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}

// 换日按美东算，和 schedule.json 的 tz 一致
function dayKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}
function prevDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

const ROUND_PREFIX = 'krillion_round_';

function saveRound(state) {
  try {
    localStorage.setItem(ROUND_PREFIX + state.dayKey, JSON.stringify({
      dayKey: state.dayKey, cur: state.cur, tries: state.tries,
      scores: state.scores, total: state.total, done: state.done,
      ids: state.ids, attempts: state.attempts,
      practice: state.practice, result: state.result
    }));
  } catch { /* Storage may be blocked or full; keep playing. */ }
}

function restoreRound(prompts, key) {
  const storageKey = ROUND_PREFIX + key;
  try {
    const oldKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const storedKey = localStorage.key(i);
      if (storedKey?.startsWith(ROUND_PREFIX) && storedKey !== storageKey) oldKeys.push(storedKey);
    }
    oldKeys.forEach(storedKey => localStorage.removeItem(storedKey));
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || saved.dayKey !== key || !Array.isArray(saved.ids) ||
        saved.ids.join('|') !== prompts.map(p => p.id).join('|') ||
        !Number.isInteger(saved.cur) || saved.cur < 0 || saved.cur >= PER_ROUND ||
        typeof saved.done !== 'boolean' || !Array.isArray(saved.tries) ||
        saved.tries.length > MAX_TRIES || !Array.isArray(saved.scores) ||
        saved.scores.length !== PER_ROUND || !saved.attempts ||
        typeof saved.attempts !== 'object' || Array.isArray(saved.attempts) ||
        Object.keys(saved.attempts).some(i => !/^[0-6]$/.test(i))) throw new Error('Invalid round');
    const restored = Game.createGame(prompts);
    // Replay recorded attempts before wrapping next(), rebuilding indexes and duplicate-answer Sets.
    for (let i = 0; i < PER_ROUND; i++) {
      const attempts = saved.attempts[i] || [];
      const expected = i < saved.cur || (saved.done && i === saved.cur)
        ? MAX_TRIES : i === saved.cur ? saved.tries.length : 0;
      if (!Array.isArray(attempts) || attempts.length !== expected) throw new Error('Invalid attempts');
      for (const attempt of attempts) {
        if (!attempt || typeof attempt.text !== 'string' || !attempt.text.trim() ||
            typeof attempt.hit !== 'boolean') throw new Error('Invalid answer');
        const result = restored.guess(attempt.text);
        if (result.duplicate || result.hit !== attempt.hit) throw new Error('Answer list changed');
      }
    }
    if (restored.cur !== saved.cur || restored.done !== saved.done ||
        restored.total !== saved.total || restored.scores.some((score, i) => score !== saved.scores[i]) ||
        restored.tries.some((attempt, i) => attempt.text !== saved.tries[i]?.text ||
          attempt.hit !== saved.tries[i]?.hit)) throw new Error('Round does not match');
    restored.practice = saved.practice === true;
    if (saved.result && Number.isFinite(saved.result.best) && typeof saved.result.isNew === 'boolean' &&
        Number.isInteger(saved.result.streak) && saved.result.streak >= 0) restored.result = saved.result;
    return restored;
  } catch {
    try { localStorage.removeItem(storageKey); } catch { /* Storage unavailable. */ }
    return null;
  }
}

// 没有 schedule.json 时的确定性抽题：同一个美东日永远同一套题
function seededPick(prompts, key, n) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  const pool = prompts.slice(), out = [];
  for (let i = 0; i < n && pool.length; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    out.push(pool.splice(h % pool.length, 1)[0]);
  }
  return out;
}

async function todayPrompts(bank, key) {
  try {
    const res = await fetch('./data/schedule.json', { cache: 'no-cache', signal: AbortSignal.timeout(3000) });
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('json')) {
      const s = await res.json();
      const ids = s && s.days && s.days[key];
      if (Array.isArray(ids) && ids.length === PER_ROUND) {
        const byId = new Map(bank.prompts.map(p => [p.id, p]));
        const got = [...new Set(ids)].map(id => byId.get(id)).filter(Boolean);
        if (got.length === PER_ROUND) return got;
      }
    }
  } catch { /* 没排期就退回确定性抽题 */ }
  return seededPick(bank.prompts, key, PER_ROUND);
}

function render(state) {
  saveRound(state);
  const root = $('#game');
  const keepFocus = document.activeElement?.matches('input');
  root.innerHTML = '';
  root.classList.toggle('is-complete', state.done);
  const card = el('div', 'card');

  const progress = el('div', 'dots');
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', 'Completed prompts');
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', String(PER_ROUND));
  progress.setAttribute('aria-valuenow', String(state.done ? PER_ROUND : state.cur));
  for (let i = 0; i < PER_ROUND; i++) {
    const dot = el('span', 'dot' + (state.done || i < state.cur ? ' ok' : i === state.cur ? ' now' : ''));
    dot.setAttribute('aria-hidden', 'true');
    progress.appendChild(dot);
  }
  card.appendChild(progress);

  const head = el('div', 'row head');
  head.appendChild(el('span', 'pill', 'Prompt ' + (state.cur + 1) + '/' + PER_ROUND));
  head.appendChild(el('span', 'pill score-pill', state.total + ' / ' + MAX_SCORE + ' pts'));
  card.appendChild(head);

  if (!state.done) {
    const q = state.prompt;
    const question = el('div', 'question');
    question.appendChild(el('span', 'cat', q.cat || q.c || 'Trivia'));
    question.appendChild(el('h2', 'prompt', q.p));
    card.appendChild(question);

    const tries = state.tries;
    const left = MAX_TRIES - tries.length;
    const attempts = el('div', 'tries');
    const tokens = el('span', 'attempt-tokens');
    tokens.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < MAX_TRIES; i++) tokens.appendChild(el('i', 'attempt-token' + (tries[i] ? tries[i].hit ? ' hit' : ' miss' : '')));
    attempts.append(tokens, el('span', '', left + (left === 1 ? ' guess remaining' : ' guesses remaining')));
    card.appendChild(attempts);

    const input = el('input', 'answer');
    input.type = 'text';
    input.autocomplete = 'off';
    input.autocapitalize = 'none';
    input.spellcheck = false;
    input.placeholder = 'Type your answer…';
    input.setAttribute('aria-label', 'Your answer');
    input.enterKeyHint = 'go';

    const btn = el('button', 'go', 'Submit');
    btn.type = 'button';
    const inputRow = el('div', 'row input-row');
    inputRow.append(input, btn);
    card.appendChild(inputRow);

    const msg = el('p', 'msg ' + (state.messageType || ''), state.message || '');
    msg.setAttribute('aria-live', 'polite');
    msg.setAttribute('role', 'status');
    card.appendChild(msg);
    if (!tries.length) card.appendChild(el('p', 'input-help', 'Type an answer and press Enter ↵'));

    if (tries.length) {
      const list = el('ul', 'tries-list');
      tries.forEach(t => { const item = el('li', t.hit ? 'hit' : 'miss'); item.append(el('span', '', t.text), el('span', 'answer-status', t.hit ? 'Accepted ✓' : 'Not on the list')); list.appendChild(item); });
      card.appendChild(list);
    }

    const submit = () => {
      const text = input.value.trim();
      if (!text) return;
      const r = state.guess(text);       // 由 game.js 判定命中与得分
      input.value = '';
      state.message = r && r.duplicate ? 'Already counted — try a different answer' :
        r && r.hit ? 'Nice — ' + r.points + ' pts' : 'Not on the list';
      state.messageType = r && !r.duplicate ? r.hit ? 'good' : 'bad' : '';
      if (r && r.roundDone) { state.message = ''; state.messageType = ''; }
      render(state);
    };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    if (keepFocus || matchMedia('(pointer:fine)').matches) input.focus({ preventScroll: true });
  } else {
    card.appendChild(el('p', 'eyebrow', state.practice ? 'PRACTICE ROUND COMPLETE' : 'DAILY ROUND COMPLETE'));
    card.appendChild(el('h2', 'result-title', state.total >= MAX_SCORE * 0.8 ? 'Nicely played.' : 'Every guess counts.'));
    const score = state.scores.reduce((a, b) => a + b, 0);
    const scoreLine = el('p', 'score', String(score));
    scoreLine.appendChild(el('small', '', '/' + MAX_SCORE));
    card.appendChild(scoreLine);

    const grid = el('div', 'grid');
    grid.setAttribute('role', 'list');
    grid.setAttribute('aria-label', 'Scores by prompt');
    state.scores.forEach((points, i) => {
      const cell = el('i', points >= 90 ? 'g' : points >= 60 ? 'y' : points >= 30 ? 'o' : '', String(points));
      cell.setAttribute('role', 'listitem');
      cell.setAttribute('aria-label', 'Prompt ' + (i + 1) + ': ' + points + ' points');
      grid.appendChild(cell);
    });
    card.appendChild(grid);

    if (state.result) {
      const best = el('p', 'best', 'Best ' + state.result.best + (state.result.streak > 1 ? ' · ' + state.result.streak + '-day streak' : ''));
      if (state.result.isNew) best.prepend(el('span', 'newbest', 'New best! '));
      card.appendChild(best);
    }
    const text = buildShare(state, state.dayKey);
    card.appendChild(el('pre', 'share', text));
    const buttons = el('div', 'btns');

    const nb = el('button', 'wide', 'Play unlimited mode →');
    nb.type = 'button';
    nb.addEventListener('click', () => { state.next(); state.message = ''; state.messageType = ''; render(state); });

    const sb = el('button', 'primary', 'Share result');
    sb.type = 'button';
    sb.addEventListener('click', async () => {
      const ok = await shareText(text, 'krillion unlimited');
      if (ok) sb.textContent = 'Shared ✓';
    });
    const cb = el('button', '', 'Copy result');
    cb.type = 'button';
    cb.addEventListener('click', async () => {
      const ok = await copyText(text);
      cb.textContent = ok ? 'Copied ✓' : 'Copy unavailable';
    });
    buttons.append(sb, cb, nb);
    card.appendChild(buttons);
  }

  root.appendChild(card);
}

async function boot() {
  const root = $('#game');
  if (!root) return;
  root.innerHTML = '<p class="loading">Loading…</p>';

  const { bank, mode } = await loadBank();
  console.log('[krillion] bank mode =', mode);
  if (mode === 'demo' && !$('.demo-banner')) {
    const bar = el('div', 'demo-banner', 'Demo build — question bank not final');
    document.body.insertBefore(bar, document.body.firstChild);
  }

  const key = dayKey();
  const todays = await todayPrompts(bank, key);

  let state;
  try {
    state = restoreRound(todays, key) || Game.createGame(todays);
  } catch (e) {
    console.error('[krillion] game.js 没有导出 createGame()', e);
    root.innerHTML = '<p class="msg bad">game.js 接口不匹配，看控制台</p>';
    return;
  }

  const prev = prevDay(key);
  const oc = state.next;
  state.dayKey = key;
  state.practice = state.practice === true || mode !== 'live' || !!bank.demo;
  state.next = function () {
    const restarting = this.done;
    oc && oc.apply(this, arguments);
    if (restarting) { this.practice = true; this.result = null; }
    if (this.done && !this.practice) this.result = finish(this, key, prev);
  };

  render(state);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
