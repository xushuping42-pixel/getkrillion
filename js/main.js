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
  const root = $('#game');
  root.innerHTML = '';
  const card = el('div', 'card');

  const head = el('div', 'row head');
  head.appendChild(el('span', 'pill', 'Prompt ' + (state.cur + 1) + '/' + PER_ROUND));
  head.appendChild(el('span', 'pill', state.total + '/' + MAX_SCORE));
  card.appendChild(head);

  if (!state.done) {
    const q = state.prompt;
    card.appendChild(el('p', 'prompt', q.p));
    card.appendChild(el('p', 'cat', q.cat || q.c || 'Trivia'));

    const tries = state.tries;
    const left = MAX_TRIES - tries.length;
    card.appendChild(el('p', 'tries', left + ' tries left'));

    const input = el('input', 'answer');
    input.type = 'text';
    input.autocomplete = 'off';
    input.autocapitalize = 'none';
    input.spellcheck = false;
    input.placeholder = 'Type your answer…';
    input.setAttribute('aria-label', 'Your answer');
    input.enterKeyHint = 'go';
    card.appendChild(input);

    const btn = el('button', 'go', 'Submit');
    btn.type = 'button';
    card.appendChild(btn);

    const msg = el('p', 'msg', state.message || '');
    msg.setAttribute('role', 'status');
    card.appendChild(msg);

    if (tries.length) {
      const list = el('ul', 'tries-list');
      tries.forEach(t => list.appendChild(el('li', t.hit ? 'hit' : 'miss', t.text + (t.hit ? ' ✓' : ' ✗'))));
      card.appendChild(list);
    }

    const submit = () => {
      const text = input.value.trim();
      if (!text) return;
      const r = state.guess(text);       // 由 game.js 判定命中与得分
      input.value = '';
      state.message = r && r.duplicate ? 'Already counted — try a different answer' :
        r && r.hit ? 'Nice — ' + r.points + ' pts' : 'Not on the list';
      if (r && r.roundDone) { state.message = ''; render(state); }
      else {
        msg.textContent = (r && r.hit) ? 'Nice — ' + r.points + ' pts' : 'Not on the list';
        msg.className = 'msg ' + ((r && r.hit) ? 'ok' : 'bad');
        if (left === 0) render(state);
        else render(state);
      }
    };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    setTimeout(() => input.focus({ preventScroll: true }), 30);
  } else {
    card.appendChild(el('p', 'prompt', 'Round over'));
    const score = state.scores.reduce((a, b) => a + b, 0);
    card.appendChild(el('p', 'final', score + '/' + MAX_SCORE));

    const nb = el('button', 'go', 'Next round · practice');
    nb.type = 'button';
    nb.addEventListener('click', () => { state.next(); render(state); });
    card.appendChild(nb);

    const sb = el('button', 'ghost', 'Share result');
    sb.type = 'button';
    sb.addEventListener('click', async () => {
      const text = buildShare(state, state.dayKey);
      const ok = await shareText(text, 'krillion unlimited');
      if (ok) sb.textContent = 'Copied ✓';
    });
    card.appendChild(sb);
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
    state = Game.createGame(todays);
  } catch (e) {
    console.error('[krillion] game.js 没有导出 createGame()', e);
    root.innerHTML = '<p class="msg bad">game.js 接口不匹配，看控制台</p>';
    return;
  }

  const prev = prevDay(key);
  const oc = state.next;
  state.dayKey = key;
  state.practice = mode !== 'live' || !!bank.demo;
  state.next = function () {
    const restarting = this.done;
    oc && oc.apply(this, arguments);
    if (restarting) this.practice = true;
    if (this.done && !this.practice) finish(this, key, prev);
  };

  render(state);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
