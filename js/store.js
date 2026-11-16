const K_BEST = 'kril:best';
const K_STREAK = 'kril:streak';
const K_PROG = 'kril:prog:';      // + 日期

function read(k, fb){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }catch{ return fb; } }
function write(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch{ return false; } }

export function saveProgress(dayKey, state){
  const found = {};
  Object.keys(state.found || {}).forEach(k => { found[k] = state.found[k] ? [...state.found[k]] : []; });
  write(K_PROG + dayKey, {
    ids: state.ids, cur: state.cur, scores: state.scores,
    found, done: state.done, total: state.total
  });
}

export function loadProgress(dayKey){
  return read(K_PROG + dayKey, null);
}

export function updateBest(total){
  const best = Number(read(K_BEST, 0)) || 0;
  if (total > best){ write(K_BEST, total); return { best: total, isNew: true }; }
  return { best, isNew: false };
}

export function getBest(){ return Number(read(K_BEST, 0)) || 0; }

export function updateStreak(dayKey, prevDayKey){
  const s = getStreak();
  if (s.last >= dayKey) return s;
  const n = s.last === prevDayKey ? s.n + 1 : 1;
  const next = { last: dayKey, n };
  write(K_STREAK, next);
  return next;
}

export function getStreak(){
  const s = read(K_STREAK, null);
  return s && typeof s.last === 'string' && Number.isInteger(s.n) && s.n >= 0 ? s : { last: '', n: 0 };
}

// 清掉两周前的当天进度，避免 localStorage 越积越多
export function clearOld(daysToKeep = 14){
  try{
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    const mine = keys.filter(k => k && k.indexOf(K_PROG) === 0).sort();
    mine.slice(0, Math.max(0, mine.length - daysToKeep)).forEach(k => localStorage.removeItem(k));
  }catch{}
}
