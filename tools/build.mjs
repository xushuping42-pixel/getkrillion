// tools/build.mjs —— 生成静态页面：首页 / 答案归档页 / 每日答案页 / sitemap.xml / robots.txt
// 用法：在仓库根目录运行  node tools/build.mjs
// 规则：schedule.start 为空时只生成首页和外壳，不生成任何答案页与归档
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data');
const TZ = 'America/New_York';
const SITE = 'https://getkrillion.xyz';
const PER_ROUND = 7;
const MAX_SCORE = PER_ROUND * 100;   // 7 × 100 = 700
const RECENT = 7;                    // 归档页列最近 7 天

const read = (p) => fs.readFileSync(p, 'utf8');
const readJSON = (p) => JSON.parse(read(p).replace(/^\uFEFF/, ''));
const die = (m) => { console.error('BUILD FAILED: ' + m); process.exit(1); };
const write = (rel, s) => {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, s, 'utf8');
  console.log('wrote ' + rel + '  (' + s.length + ' bytes)');
};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// ---------- 1. 读题库（正式优先，没有则演示） ----------
const livePath = path.join(DATA, 'prompts.json');
const demoPath = path.join(DATA, 'prompts.demo.json');
let bankPath = null;
if (fs.existsSync(livePath)) {
  const b = readJSON(livePath);
  if (Array.isArray(b.prompts) && b.prompts.length >= PER_ROUND) bankPath = livePath;
}
if (!bankPath && fs.existsSync(demoPath)) {
  const b = readJSON(demoPath);
  if (Array.isArray(b.prompts) && b.prompts.length >= PER_ROUND) bankPath = demoPath;
}
if (!bankPath) die('data/prompts.json 与 data/prompts.demo.json 都不存在或不足 7 题');

const BANK = readJSON(bankPath);
const isDemo = !!BANK.demo || bankPath === demoPath;
const P = BANK.prompts;
if (!Array.isArray(P) || P.length < PER_ROUND) die('题库不足 ' + PER_ROUND + ' 题');

const ids = P.map((p) => String(p.id || ''));
if (ids.some((v) => !v)) die('有题目的 id 为空');
const dupe = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
if (dupe.length) die('id 重复：' + dupe.join(', '));

P.forEach((p) => {
  if (typeof p.p !== 'string' || !p.p.trim()) die('id=' + p.id + ' 缺少题面 p');
  if (!Array.isArray(p.a) || !p.a.length) die('id=' + p.id + ' 缺少答案 a');
  p.a.forEach((x) => {
    if (!Array.isArray(x) || typeof x[0] !== 'string' || x[0] === '') die('id=' + p.id + ' 答案格式错');
    if (typeof x[1] !== 'number' || x[1] < 1) die('id=' + p.id + ' 答案 "' + x[0] + '" 排名非法');
  });
});

console.log('bank: ' + path.relative(ROOT, bankPath) + '  ' + P.length + ' prompts  ' + (isDemo ? '[DEMO]' : '[LIVE]'));

// ---------- 2. 读排期（start 为空 = 不生成任何答案页） ----------
let SCHED = null;
const schedPath = path.join(DATA, 'schedule.json');
if (fs.existsSync(schedPath)) {
  const s = readJSON(schedPath);
  if (!s.start) {
    console.log('note: schedule.start 为空 → 只生成首页，不生成答案页与归档');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(s.start)) {
    die('schedule.start 不是 YYYY-MM-DD：' + s.start);
  } else {
    const have = new Set(ids);
    const days = s.days || {};
    const dayKeys = Object.keys(days);
    if (!dayKeys.length) die('schedule.start 有值但 days 为空');
    for (const d of dayKeys) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) die('days 里的日期格式错：' + d);
      if (d < s.start) die('days 里有早于 start 的日期：' + d);
      const list = days[d];
      if (!Array.isArray(list) || list.length !== PER_ROUND) die(d + ' 不是 ' + PER_ROUND + ' 题');
      if (new Set(list).size !== PER_ROUND) die(d + ' 有重复 id');
      list.forEach((id) => { if (!have.has(id)) die(d + ' 含不存在的 id：' + id); });
    }
    const used = new Set(dayKeys.flatMap((d) => days[d]));
    console.log('schedule: ' + dayKeys.length + ' 天  start=' + s.start + '  覆盖 ' + used.size + '/' + P.length + ' 题');
    SCHED = s;
  }
} else {
  console.log('note: 没有 data/schedule.json → 只生成首页');
}
if (SCHED && isDemo) die('演示题库不允许带排期生成答案页，请把 schedule.start 留空');

// 清理旧排期产物，确保日期目录与当前排期一致；不递归删除目录。
const answersRoot = path.join(ROOT, 'answers');
const scheduledDates = new Set(SCHED ? Object.keys(SCHED.days) : []);
if (fs.existsSync(answersRoot)) {
  for (const entry of fs.readdirSync(answersRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(entry.name) || scheduledDates.has(entry.name)) continue;
    const directory = path.resolve(answersRoot, entry.name);
    if (path.dirname(directory) !== path.resolve(answersRoot)) die('旧归档路径越界');
    const index = path.join(directory, 'index.html');
    if (fs.existsSync(index) && fs.lstatSync(index).isFile()) fs.unlinkSync(index);
    if (fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
  }
}

// ---------- 3. 页面骨架 ----------
const nav = '<nav><a href="/">Play</a> <span>·</span> <a href="/answers/">Answers</a></nav>';
const banner = isDemo ? '<div class="demo-banner">Demo build — question bank not final</div>' : '';
const shell = (o) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<link rel="canonical" href="${SITE}${o.path}">
${o.noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:url" content="${SITE}${o.path}">
<meta property="og:site_name" content="krillion unlimited">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
${banner}
<header><a class="logo" href="/"><h1>${esc(o.h1)}</h1></a>${nav}</header>
<main>
${o.body}
</main>
<footer>
<p>krillion unlimited is an independent fan-made guessing game. Not affiliated with krillion.io or any other service.</p>
<p><a href="/">Play</a> · <a href="/answers/">Answers</a></p>
</footer>
<script src="/js/main.js" type="module"></script>
</body>
</html>
`;

// ---------- 4. 首页（永远生成） ----------
const homeBody = `<div id="game"><p class="loading">Loading…</p></div>

<h2>What is krillion unlimited?</h2>
<p>krillion unlimited is a free daily guessing game. You get seven prompts, and for each one you name as many valid answers as you can before you run out of tries. Popular answers score more: the most common answer is worth 100 points, so a perfect round is ${MAX_SCORE} points. No download, no sign-up — the game starts the moment the page opens.</p>

<h2>How to play</h2>
<p>Read the prompt, type an answer, and press Enter. You have three tries per prompt. Answers are matched against a ranked list, so the more common your answer, the higher it scores. When all seven prompts are done, the round ends and you can copy your score card and share it.</p>

<h2>Daily round vs unlimited mode</h2>
<p>The daily round changes at midnight Eastern Time. Unlimited mode lets you keep playing new rounds from the same question bank, so you can practise without waiting a day. Your best score and streak are stored in your own browser — nothing is sent to a server.</p>

<h2>Seven categories</h2>
<p>Every round draws from the same seven categories: Animals, Geography, Food, Movies &amp; TV, Music, Sports and Trivia. The mix is shuffled each round, so no two games feel the same.</p>

<h2>Looking for the answers?</h2>
<p>If you are stuck or you want to check a round afterwards, see <a href="/answers/">today's Krillion answers</a>. The same page collects <a href="/answers/">Krillion hints</a> for prompts that are harder than they look.</p>`;

write('index.html', shell({
  title: 'krillion unlimited — Free Daily Guessing Game',
  desc: 'Play krillion unlimited free: seven prompts a day, three tries each, up to 700 points. No download, works on mobile, starts instantly in your browser.',
  h1: 'krillion unlimited',
  path: '/',
  body: homeBody,
  noindex: false
}));

// ---------- 5. 答案页与归档（只有排期有 start 才生成） ----------
const urls = [{ loc: '/', lastmod: new Date().toISOString().slice(0, 10) }];

if (SCHED) {
  const byId = new Map(P.map((p) => [p.id, p]));
  const days = Object.keys(SCHED.days).sort();
  const recent = days.slice().reverse().slice(0, RECENT);

  // 5a. 归档页 /answers/
  const recentList = recent.map((d) => `<li><a href="/answers/${d}/">${d}</a> — ${esc(byId.get(SCHED.days[d][0]).c)} round</li>`).join('\n');
  const answersBody = `<p>Every round of krillion unlimited is built from seven prompts. This page lists the most recent rounds with the full answer list for each one, so you can check a prompt you missed or look ahead before you play.</p>

<h2>Recent rounds</h2>
<ul class="days">
${recentList}
</ul>

<h2>krillion answers today</h2>
<p>Today's round is the first entry above. Each daily page lists all seven prompts and the accepted answers in ranking order, so you can see which answers were worth the most points.</p>

<h2>How scoring works</h2>
<p>Every accepted answer has a popularity rank. Rank 1 is the most common answer and is worth 100 points; each rank below it is worth a little less, with a floor of 5 points. A prompt is capped at 100 points and a full round at ${MAX_SCORE}.</p>

<h2>krillion hints vs full answers</h2>
<p>The daily pages give both. If you only want a nudge, read the first few entries of a prompt's list — the top answers are the ones most players name first. If you want the whole list, keep reading; nothing is hidden.</p>

<h2>Past rounds</h2>
<p>Rounds are archived by date and never rewritten, so an old page always shows the prompts that were live that day. Bookmark a date if you want to compare a later round against it.</p>

<h2>krillion io answers</h2>
<p>krillion unlimited uses its own question bank and its own ranking, so the answers here can differ from the list you see on krillion.io. Use these pages as the reference for this site's rounds.</p>

<p>Want to play instead? <a href="/">Play krillion unlimited</a>.</p>`;

  write('answers/index.html', shell({
    title: 'krillion answers today — Recent Rounds and Full Lists',
    desc: 'krillion answers for today and the last seven rounds, prompt by prompt, with every accepted answer in ranking order. Check a hint before you play the next round.',
    h1: 'krillion answers',
    path: '/answers/',
    body: answersBody,
    noindex: false
  }));
  urls.push({ loc: '/answers/', lastmod: new Date().toISOString().slice(0, 10) });

  // 5b. 一天一页 /answers/YYYY-MM-DD/
  days.forEach((d, i) => {
    const prev = i > 0 ? days[i - 1] : null;
    const next = i < days.length - 1 ? days[i + 1] : null;
    const blocks = SCHED.days[d].map((id, idx) => {
      const p = byId.get(id);
      const list = p.a
        .slice()
        .sort((x, y) => x[1] - y[1])
        .map((x) => {
          const alias = Array.isArray(x[2]) && x[2].length ? ` <span class="alias">(${esc(x[2].join(', '))})</span>` : '';
          return `<li><strong>${esc(x[0])}</strong>${alias} <span class="rank">#${x[1]}</span></li>`;
        })
        .join('\n');
      return `<section class="q">
<h2>${idx + 1}. ${esc(p.p)}</h2>
<p class="cat">${esc(p.c)}</p>
<ol class="answers">
${list}
</ol>
</section>`;
    }).join('\n');

    const dayBody = `<p class="meta">Round for ${d} · Eastern Time · ${PER_ROUND} prompts · ${MAX_SCORE} points maximum</p>
${blocks}

<h2>About this round</h2>
<p>These are the prompts that were live on ${d} and every answer the site accepts for them, ordered by popularity rank. Rank 1 answers are worth the most points. Rounds are archived by date and are never re-generated, so this page stays as it was on the day it ran.</p>

<p class="pager">
${prev ? `<a href="/answers/${prev}/">← ${prev}</a>` : '<span></span>'}
<a href="/answers/">All recent rounds</a>
${next ? `<a href="/answers/${next}/">${next} →</a>` : '<span></span>'}
</p>`;

    write('answers/' + d + '/index.html', shell({
      title: 'krillion answers for ' + d + ' — Full Round Solutions',
      desc: 'Full krillion answers for ' + d + ': all ' + PER_ROUND + ' prompts and every accepted answer in ranking order, with hints for the harder ones.',
      h1: 'krillion answers · ' + d,
      path: '/answers/' + d + '/',
      body: dayBody,
      noindex: false
    }));
    urls.push({ loc: '/answers/' + d + '/', lastmod: d });
  });
} else {
  // 没有排期也给一个 /answers/ 外壳，避免导航 404
  const stubBody = `<p>The first daily round has not been scheduled yet. Once rounds are live, every day gets its own page here with the full prompt and answer list.</p>
<h2>How scoring works</h2>
<p>Every accepted answer has a popularity rank. Rank 1 is the most common answer and is worth 100 points, with a floor of 5 points further down. A full round tops out at ${MAX_SCORE}.</p>
<p>You can already play: <a href="/">krillion unlimited</a>.</p>`;
  write('answers/index.html', shell({
    title: 'krillion answers — Rounds Archive',
    desc: 'Daily krillion answers and hints, archived by date. Each round lists all seven prompts with every accepted answer in ranking order.',
    h1: 'krillion answers',
    path: '/answers/',
    body: stubBody,
    noindex: true
  }));
}

// ---------- 6. sitemap.xml ----------
const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${SITE}${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
  </url>`).join('\n')}
</urlset>
`;
write('sitemap.xml', sm);

// ---------- 7. robots.txt ----------
const robots = isDemo
  ? `# DEMO BUILD — 不允许抓取
User-agent: *
Disallow: /
`
  : `User-agent: *
Allow: /
Disallow: /data/

Sitemap: ${SITE}/sitemap.xml
`;
write('robots.txt', robots);

// ---------- 8. 收尾汇总 ----------
console.log('');
console.log('done.');
console.log('  mode      : ' + (isDemo ? 'DEMO' : 'LIVE'));
console.log('  prompts   : ' + P.length);
console.log('  rounds    : ' + (SCHED ? Object.keys(SCHED.days).length : 0));
console.log('  sitemap   : ' + urls.length + ' urls');
if (isDemo) console.log('  note      : 演示构建，robots 全站 Disallow、答案页未生成');
if (!SCHED) console.log('  note      : schedule.start 为空，答案页未生成');
