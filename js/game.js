import { buildIndex, match } from './answer.js';

export function createGame(prompts, ids){
  ids = ids || (prompts || []).map(p => p.id);
  const byId = new Map((prompts || []).map(p => [p.id, p]));
  if (!Array.isArray(ids) || ids.length !== 7 || new Set(ids).size !== 7 || ids.some(id => !byId.has(id))) {
    throw new Error('A round requires seven distinct, known prompt IDs');
  }
  const rounds = ids.map(id => byId.get(id));
  return {
    get prompt(){ return this.rounds[this.cur]; },
    get tries(){ return this.attempts[this.cur] || []; },
    attempts: {},
    guess(text){
      if (this.done) return { hit: false, roundDone: true };
      if (!String(text).trim()) return { hit: false, roundDone: false };
      const i = this.cur;
      const result = submit(this, text);
      if (result.type === 'dup') return { hit: true, duplicate: true, points: 0, roundDone: false };
      const tries = this.attempts[i] || (this.attempts[i] = []);
      tries.push({ text: String(text), hit: result.type === 'hit' });
      const roundDone = tries.length >= 3;
      if (roundDone) this.next();
      return { hit: result.type === 'hit', points: result.score || 0, roundDone };
    },
    next(){
      if (this.done) {
        this.cur = 0; this.scores = this.rounds.map(() => 0);
        this.found = {}; this.attempts = {}; this.total = 0; this.done = false;
        return { type: 'restart' };
      }
      return nextRound(this);
    },
    ids: rounds.map(r => r.id),
    rounds,
    indexes: rounds.map(buildIndex),
    cur: 0,
    scores: rounds.map(() => 0),
    found: {},              // { roundIdx: Set<answerIdx> }
    done: false,
    total: 0
  };
}

// 从存档恢复：重建 index 与 Set
export function hydrate(prompts, saved){
  const g = createGame(prompts, saved.ids || []);
  if (!Number.isInteger(saved.cur) || saved.cur < 0 || saved.cur >= 7) throw new Error('Invalid saved round');
  g.cur = saved.cur;
  g.done = saved.done === true;
  if (g.done && g.cur !== 6) throw new Error('Invalid completed round');
  g.found = {};
  const f = saved.found || {};
  Object.keys(f).forEach(k => {
    if (!/^[0-6]$/.test(k) || Number(k) > g.cur || !Array.isArray(f[k]) ||
        f[k].some(idx => !Number.isInteger(idx) || idx < 0 || idx >= g.rounds[k].a.length)) {
      throw new Error('Invalid saved answers');
    }
    g.found[k] = new Set(f[k]);
  });
  g.scores = g.rounds.map((_, i) => Math.max(0, ...[...(g.found[i] || [])].map(idx => Math.max(5, 99 - idx))));
  g.total = g.done ? g.scores.reduce((a, b) => a + b, 0) : 0;
  return g;
}

export function submit(state, input){
  if (state.done) return { type:'done' };
  const i = state.cur;
  const r = match(state.rounds[i], input, state.indexes[i]);
  if (!r.hit) return { type:'miss' };
  const set = state.found[i] || (state.found[i] = new Set());
  if (set.has(r.idx)) return { type:'dup', text:r.text };
  set.add(r.idx);
  state.scores[i] = Math.max(state.scores[i] || 0, r.score);   // 同题取最高，不累加
  state.total = state.scores.reduce((a, b) => a + b, 0);
  return { type:'hit', text:r.text, score:r.score, idx:r.idx };
}

export function nextRound(state){
  if (state.done) return { type:'done' };
  if (state.cur < state.rounds.length - 1){ state.cur += 1; return { type:'next' }; }
  state.done = true;
  state.total = state.scores.reduce((a, b) => a + b, 0);
  return { type:'settle', total:state.total };
}

export function summary(state){
  const max = state.rounds.length * 100;
  const total = state.done ? state.total : state.scores.reduce((a, b) => a + b, 0);
  return { total, max, roundScores: state.scores.slice(), ids: state.ids.slice() };
}

export function foundList(state, i){
  const set = state.found[i];
  if (!set) return [];
  return [...set].sort((a, b) => a - b)
    .map(idx => ({ text: state.rounds[i].a[idx][0], pts: Math.max(5, 100 - (idx + 1)) }));
}
