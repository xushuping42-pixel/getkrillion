// tools/make-schedule.mjs —— 由题库生成确定性排期，可重跑、结果一致
// 用法：node tools/make-schedule.mjs --start=2026-11-20 --days=60
//       node tools/make-schedule.mjs --start=            （清空排期，只构建首页）
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PER_ROUND = 7;
const fail = (m) => { console.error('SCHEDULE FAILED: ' + m); process.exit(1); };
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith('--' + k + '='));
  return hit === undefined ? d : hit.slice(k.length + 3);
};

const START = (arg('start', '') || '').trim();
const DAYS = Number(arg('days', '60')) || 60;
const SEED = Number(arg('seed', '20261116')) || 20261116;
const COOL = Number(arg('cooldown', '7')) || 7;

if (START && !/^\d{4}-\d{2}-\d{2}$/.test(START)) fail('--start 必须是 YYYY-MM-DD');
if (DAYS < 1 || DAYS > 3650) fail('--days 取 1~3650');

let s = SEED >>> 0;
const rnd = () => {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const bankPath = path.join(ROOT, 'data', 'prompts.json');
if (!fs.existsSync(bankPath)) fail('找不到 data/prompts.json');
const raw = JSON.parse(fs.readFileSync(bankPath, 'utf8').replace(/^\uFEFF/, ''));
const prompts = Array.isArray(raw) ? raw : raw.prompts;
if (!Array.isArray(prompts) || prompts.length < PER_ROUND) fail('题库不足 ' + PER_ROUND + ' 题');

const ids = prompts.map((p) => String(p.id || ''));
if (ids.some((v) => !v)) fail('有题目 id 为空');
if (new Set(ids).size !== ids.length) fail('题库里有重复 id，先修题库再排期');

const out = path.join(ROOT, 'data', 'schedule.json');

if (!START) {
  fs.writeFileSync(out, JSON.stringify({
    version: 1, start: '', perRound: PER_ROUND, seed: SEED, days: {}
  }, null, 2) + '\n', 'utf8');
  console.log('schedule: start 为空 → days 已清空，构建只生成首页（题库 ' + ids.length + ' 题待用）');
  process.exit(0);
}

const tie = new Map(ids.map((id) => [id, rnd()]));
const lastUsed = new Map();
const days = {};
const startMs = Date.UTC(+START.slice(0, 4), +START.slice(5, 7) - 1, +START.slice(8, 10));

for (let d = 0; d < DAYS; d++) {
  const scored = ids.map((id) => {
    const lu = lastUsed.has(id) ? lastUsed.get(id) : null;
    return { id, gap: lu === null ? Number.MAX_SAFE_INTEGER : d - lu, tie: tie.get(id) };
  });
  scored.sort((a, b) => (b.gap - a.gap) || (a.tie - b.tie));
  const picked = scored.slice(0, PER_ROUND).map((x) => x.id);
  for (const id of picked) {
    if (lastUsed.has(id)) {
      const gap = d - lastUsed.get(id);
      if (gap < COOL) fail('第 ' + (d + 1) + ' 天 ' + id + ' 只隔 ' + gap + ' 天重复');
    }
  }
  picked.forEach((id) => lastUsed.set(id, d));
  const key = new Date(startMs + d * 86400000).toISOString().slice(0, 10);
  days[key] = picked;
}

const used = new Set(Object.values(days).flat());
const counts = new Map(ids.map((id) => [id, 0]));
Object.values(days).forEach((l) => l.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
const maxUse = Math.max(...counts.values());

fs.writeFileSync(out, JSON.stringify({
  version: 1, start: START, perRound: PER_ROUND, seed: SEED, days
}, null, 2) + '\n', 'utf8');

console.log('schedule: ' + DAYS + ' 天  start=' + START + '  题库 ' + ids.length + ' 题  覆盖 ' + used.size + ' 题  单题最多用 ' + maxUse + ' 次');
console.log('wrote data/schedule.json');
