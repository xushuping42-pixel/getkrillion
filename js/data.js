import { validDay } from './dates.js';

export function validatePrompts(raw) {
  const list = Array.isArray(raw) ? raw : raw?.prompts;
  if (!Array.isArray(list) || list.length < 7) throw new Error('At least seven prompts required');
  const ids = new Set();
  for (const p of list) {
    if (!p || typeof p.id !== 'string' || !p.id || ids.has(p.id) ||
        typeof p.p !== 'string' || !p.p.trim() || !Array.isArray(p.a) || !p.a.length) {
      throw new Error('Invalid or duplicate prompt');
    }
    ids.add(p.id);
    for (const row of p.a) {
      if (!Array.isArray(row) || typeof row[0] !== 'string' || !row[0].trim() ||
          (row[2] !== undefined && (!Array.isArray(row[2]) || row[2].some(s => typeof s !== 'string')))) {
        throw new Error(`Invalid answer in ${p.id}`);
      }
    }
  }
  return list;
}

export function validateSchedule(s, prompts) {
  if (!s || !validDay(s.start) || !s.days || typeof s.days !== 'object' || Array.isArray(s.days)) {
    throw new Error('Invalid schedule');
  }
  if (s.tz !== 'America/New_York') throw new Error('Schedule must use America/New_York');
  const ids = new Set(prompts.map(p => p.id));
  for (const [day, round] of Object.entries(s.days)) {
    if (!validDay(day) || day < s.start || !Array.isArray(round) || round.length !== 7 ||
        new Set(round).size !== 7 || round.some(id => !ids.has(id))) {
      throw new Error(`Invalid seven-prompt round: ${day}`);
    }
  }
  return s;
}
