import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { validatePrompts, validateSchedule } from '../js/data.js';
import { validDay, shiftDay } from '../js/dates.js';

export function extendSchedule(prompts, existing, start, count = 1095, demo = false) {
  validatePrompts(prompts);
  if (!validDay(start) || !Number.isInteger(count) || count < 1) throw new Error('Valid start date and day count required');
  if (existing) {
    validateSchedule(existing, prompts);
    if (existing.start !== start) throw new Error('Cannot change an existing launch date');
    if (!!existing.demo !== demo) throw new Error('Demo schedule cannot become a production schedule');
  }
  const result = structuredClone(existing || { tz: 'America/New_York', start, demo, days: {} });
  const keys = Object.keys(result.days).sort();
  let day = keys.length ? shiftDay(keys.at(-1), 1) : start;
  const end = shiftDay(start, count - 1);
  for (; day <= end; day = shiftDay(day, 1)) {
    // Stable daily selection; extending never changes a previously scheduled day.
    let seed = [...day].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
    const pool = prompts.map(p => p.id);
    for (let i = pool.length - 1; i > 0; i--) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const j = (seed >>> 0) % (i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    result.days[day] = pool.slice(0, 7);
  }
  return validateSchedule(result, prompts);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = name => args[args.indexOf(name) + 1];
  if (!args.includes('--start')) throw new Error('Usage: node tools/schedule.mjs --start YYYY-MM-DD [--days 1095] [--demo]');
  const raw = JSON.parse(fs.readFileSync('data/prompts.json', 'utf8'));
  const prompts = validatePrompts(raw), demo = args.includes('--demo');
  if (!demo && (raw.demo || prompts.length !== 397)) throw new Error('Production requires the approved 397-prompt library');
  const existing = fs.existsSync('data/schedule.json') ? JSON.parse(fs.readFileSync('data/schedule.json', 'utf8')) : null;
  const schedule = extendSchedule(prompts, existing, option('--start'), args.includes('--days') ? Number(option('--days')) : 1095, demo);
  fs.writeFileSync('data/schedule.json', JSON.stringify(schedule, null, 2) + '\n');
  console.log(`Scheduled ${Object.keys(schedule.days).length} days; existing dates preserved.`);
}
