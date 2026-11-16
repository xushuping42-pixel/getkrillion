import fs from 'node:fs';
const FALLBACK = JSON.parse(fs.readFileSync(new URL('../data/prompts.demo.json', import.meta.url), 'utf8'));
import { dayAt } from '../js/dates.js';
import { extendSchedule } from './schedule.mjs';

if (fs.existsSync('data/prompts.json') || fs.existsSync('data/schedule.json')) {
  throw new Error('Demo setup will not overwrite existing data');
}
fs.mkdirSync('data', { recursive: true });
const prompts = structuredClone(FALLBACK.prompts.filter(p => !p.id.startsWith('demo-')));
prompts.push(
  { id: 'demo-sandwich', cat: 'Food', p: 'Name a sandwich.', a: [['Peanut butter and jelly', 1, ['pb&j', 'pb and j', 'pbj']], ['Grilled cheese', 2, []], ['BLT', 3, []]] },
  { id: 'demo-fast-food', cat: 'Food', p: 'Name a fast-food chain.', a: [["McDonald’s", 1, ['mcdonalds']], ['Chick-fil-A', 2, []], ['In-N-Out', 3, []]] }
);
fs.writeFileSync('data/prompts.json', JSON.stringify({ version: 1, demo: true, prompts }, null, 2) + '\n');
fs.writeFileSync('data/schedule.json', JSON.stringify(extendSchedule(prompts, null, dayAt(), 1095, true), null, 2) + '\n');
console.log('Created clearly marked demo data. Replace with approved data before launch.');
