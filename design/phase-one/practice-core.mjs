export function choosePractice(prompts, previous = [], random = Math.random) {
  const key = p => p.p.trim().replace(/\s+/g, ' ').toLowerCase();
  const old = new Set(prompts.filter(p => previous.includes(p.id)).map(key));
  let pool = [...new Map(prompts.filter(p => !old.has(key(p))).map(p => [key(p), p])).values()];
  if (pool.length < 7) pool = [...new Map(prompts.map(p => [key(p), p])).values()];
  if (pool.length < 7) throw new Error('Seven distinct practice questions are needed');
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 7);
}

export function restorePractice(bank, saved, createGame) {
  if (!saved || saved.version !== 1 || !Array.isArray(saved.ids) || !Array.isArray(saved.attempts) || saved.attempts.length !== 7) return null;
  try {
    const game = createGame(bank, saved.ids);
    for (let i = 0; i < 7; i++) {
      if (!Array.isArray(saved.attempts[i]) || saved.attempts[i].length > 3) return null;
      for (const text of saved.attempts[i]) {
        if (game.done || game.cur !== i || typeof text !== 'string' || !text.trim() || game.guess(text).duplicate) return null;
      }
    }
    return game;
  } catch { return null; }
}
