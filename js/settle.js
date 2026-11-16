// js/settle.js —— 结算：成绩卡文本 + 分享
import { updateBest, updateStreak } from './store.js';

const GREEN = 90, YELLOW = 60, ORANGE = 30;

function cell(score){
  if (!score) return '⬛';
  if (score >= GREEN)  return '🟩';
  if (score >= YELLOW) return '🟨';
  if (score >= ORANGE) return '🟧';
  return '🟥';
}

export function buildShare(state, dayKey){
  const total = state.done ? state.total : state.scores.reduce((a, b) => a + b, 0);
  const max = state.rounds.length * 100;                 // 7 题 = 700
  return [
    'krillion unlimited · ' + dayKey,
    state.scores.map(cell).join(''),
    total + '/' + max,
    location.origin
  ].join('\n');
}

// 一局结束时调一次：更新最高分与连续天数
export function finish(state, dayKey, prevDayKey){
  const r = updateBest(state.total);
  const s = updateStreak(dayKey, prevDayKey);
  return { best: r.best, isNew: r.isNew, streak: s.n };
}

export async function copyText(text){
  try{
    if (navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(text);
      return true;
    }
  }catch{}
  try{
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }catch{ return false; }
}

export async function shareText(text, title){
  if (navigator.share){
    try{ await navigator.share({ title: title || 'krillion unlimited', text }); return true; }
    catch{ return false; }                                  // 用户取消，别当错误
  }
  return copyText(text);
}
