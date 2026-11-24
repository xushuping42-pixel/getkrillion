import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { easternDate } from '../design/phase-one/date-core.mjs';
import { editionSeo } from './design-seo.mjs';
import { renderStatus } from './build-status.mjs';
import { modeGuides, renderModeGuide } from './mode-guides.mjs';
import { tierLabel } from '../design/phase-one/search-core.mjs';

await import('./build-design.mjs');
const root = process.cwd(), source = path.join(root, 'design/phase-one');
const site = 'https://getkrillion.xyz', today = easternDate();
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plain = value => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const editions = JSON.parse(fs.readFileSync(path.join(source, 'archive-index.json'), 'utf8'));
if (!editions.length || editions.some(e => e.date > today || e.prompts.length !== 7)) throw new Error('Only complete, released Eastern dates may be published');
const latest = editions[0];
const snapshots = new Map(editions.map(e => [e.date, JSON.parse(fs.readFileSync(path.join(source, e.file), 'utf8'))]));
const publicEditions = editions.map(e => ({ ...e, file: `/assets/guide/records/${e.date}.json`, href: `/answers/${e.date}/` }));
const routes = { 'index.html': '/', 'hints.html': '/hints/', 'archive.html': '/archive/', 'guide.html': '/how-to-play/', 'scoring.html': '/scoring/', 'missing-answer.html': '/why-answer-not-accepted/', 'search.html': '/search/' };
routes[''] = '/';
for (const e of editions) routes[`edition-${e.date}.html`] = `/answers/${e.date}/`;
const assets = ['app.css', 'app.js', 'utilities.js', 'phase-three.js', 'answer-ui.mjs', 'copy-tools.mjs', 'search-core.mjs', 'date-core.mjs', 'question.js', 'site.js'];
const version = createHash('sha256').update(assets.map(name => fs.readFileSync(path.join(source, name))).reduce((a, b) => Buffer.concat([a, b]), Buffer.alloc(0))).digest('hex').slice(0, 12);
const output = new Map();
const pages = [];
function routeUrl(value, currentFile) {
  if (/^(?:https?:|mailto:|#)/.test(value)) return value;
  const resolved = new URL(value, site + '/design/phase-one/' + currentFile);
  const name = resolved.pathname.replace('/design/phase-one/', '');
  if (routes[name]) return routes[name] + resolved.search + resolved.hash;
  if (name === 'practice.html') throw new Error('Independent practice link remains in public content');
  if (assets.includes(name)) return '/assets/guide/' + name + '?v=' + version;
  if (name === 'reveal-snapshot.json' || /^records\/\d{4}-\d{2}-\d{2}\.json$/.test(name)) {
    const day = name === 'reveal-snapshot.json' ? latest.date : name.slice(8, 18);
    if (!snapshots.has(day)) throw new Error('Link to an unrecorded snapshot');
    return `/assets/guide/records/${day}.json`;
  }
  return resolved.pathname + resolved.search + resolved.hash;
}
function head(html, { url, title, description, index = true, breadcrumbs = [] }) {
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="robots"[^>]*>/, `<meta name="robots" content="${index ? 'index,follow,max-image-preview:large' : 'noindex,follow'}">`);
  const structured = url === '/' ? { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Krillion Fieldnotes', url: site + '/', description } : { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ name: 'Krillion Answers', item: site + '/' }, ...breadcrumbs, { name: plain(title), item: site + url }].map((item, i) => ({ '@type': 'ListItem', position: i + 1, ...item })) };
  return html.replace('</head>', `<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${site}${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Krillion Fieldnotes">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${site}${url}">
<meta property="og:image" content="${site}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:image" content="${site}/og.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}">
<script type="application/ld+json">${json(structured)}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-PJZ74G7C2B"></script>
<script>
(function(){
  var p=new URLSearchParams(location.search), k=new URLSearchParams();
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid'].forEach(function(n){if(p.get(n))k.set(n,p.get(n));});
  var q=k.toString();
  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};
  window.gtag('js',new Date());
  window.gtag('config','G-PJZ74G7C2B',{anonymize_ip:true,page_location:location.origin+location.pathname+(q?'?'+q:'')});
})();
</script>
<script src="/assets/guide/site.js?v=${version}" type="module"></script></head>`);
}
function publish(file, metadata, change = html => html) {
  let html = change(fs.readFileSync(path.join(source, file), 'utf8'));
  html = html.replace(/\b(href|src|action|data-snapshot)="([^"]+)"/g, (_, attr, value) => `${attr}="${routeUrl(value, file)}"`)
    .replace(/<script type="application\/json" id="edition-data">[\s\S]*?<\/script>/, `<script type="application/json" id="edition-data">${json(publicEditions)}</script>`)
    .replace('DESIGN PREVIEW', 'INDEPENDENT GUIDE').replace('About this preview', 'Sources & updates')
    .replaceAll('local archive', 'recorded archive').replaceAll('local snapshot', 'saved snapshot').replaceAll('selected local record', 'selected saved record').replaceAll('available locally', 'available in our records')
    .replace('</nav></footer>', '<a href="/score-calculator/">Score calculator</a><a href="/about/">About & sources</a><a href="/privacy/">Privacy</a></nav></footer>');
  html = head(html, metadata);
  if (/practice\.html|\/js\/(?:main|game)\.js|\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unreleased content remains in ' + metadata.url);
  const fileName = metadata.url === '/' ? 'index.html' : metadata.url.slice(1) + 'index.html';
  output.set(fileName, html); pages.push({ ...metadata, file: fileName });
  return html;
}
function main(html, content) {
  return html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/, `<main class="container utility-page" id="main">${content}</main>`).replace('href="#daily-prompts">Skip to the seven prompts', 'href="#main">Skip to content');
}
const hero = (title, copy) => `<section class="utility-hero"><p class="eyebrow">KRILLION FIELDNOTES / AN INDEPENDENT GUIDE</p><h1>${esc(title)}</h1><p>${copy}</p></section>`;
function dailyLinks(html, edition) {
  html = html.replace(/<dialog\b[\s\S]*?<\/dialog>/g, '');
  let index = 0;
  return html.replace(/<a class="all-answers"[^>]*data-dialog="answers-\d+"[^>]*>/g, () => `<a class="all-answers" href="/answers/${edition.date}/prompt-${++index}/">`);
}
publish('index.html', { url: '/', ...editionSeo(latest.date, today, { home: true }), description: `Explore all seven Krillion prompts for ${latest.label}, with progressive hints, rare answer examples, recorded scores and searchable answer lists.` }, html => dailyLinks(html, latest).replace('<section class="continue-section">', '<p class="mode-entry">Want to keep playing? <a href="/krillion-unlimited/">Explore Krillion Unlimited and other ways to play →</a></p><section class="continue-section">'));
for (const e of editions) {
  const seo = editionSeo(e.date, today);
  publish(`edition-${e.date}.html`, { url: `/answers/${e.date}/`, title: seo.title, description: `Krillion answers for ${e.label}: seven prompts, first-letter hints, rare examples and ${e.answerCount.toLocaleString('en-US')} recorded answers with scores.`, initialLastmod: e.date, breadcrumbs: [{ name: 'Answer archive', item: site + '/archive/' }] }, html => dailyLinks(html, e));
}
const metadata = [
  ['hints.html', '/hints/', null, `Progressive Krillion hints for ${latest.label}. Start with the prompt conditions, then reveal a first letter or word shape without seeing the answer.`],
  ['archive.html', '/archive/', 'Krillion Answers Archive — Past Prompts & Answers', 'Browse recorded Krillion dates, all seven prompts, hints and answer lists. Only complete saved editions are included; unavailable dates are not invented.'],
  ['guide.html', '/how-to-play/', 'How to Play Krillion — Prompts, Hints & Scoring', 'Learn how to approach the seven Krillion prompts, use progressive hints, check answer rarity and compare dated answer records with the official game.'],
  ['scoring.html', '/scoring/', 'Krillion Scoring Explained — Rarity Tiers & Points', 'Understand Krillion rarity tiers from Plankton to One in a Krillion, their recorded points and why a rare-sounding answer is not automatically a Krillion pick.'],
  ['missing-answer.html', '/why-answer-not-accepted/', 'Why Is My Krillion Answer Not Accepted?', 'Check the game date, prompt conditions, spelling and aliases when a Krillion answer seems missing. Learn why a saved answer list is not a final acceptance verdict.'],
  ['search.html', '/search/', 'Krillion Answer Finder — Search Recorded Answers', 'Search recorded Krillion answers and alternative spellings by date, prompt and rarity score. Find question wording across the saved archive.', false]
];
for (const [file, url, title, description, index = true] of metadata) {
  const text = fs.readFileSync(path.join(source, file), 'utf8');
  publish(file, { url, title: title || plain(text.match(/<title>(.*?)<\/title>/s)[1]), description, index });
}
for (const guide of modeGuides) {
  publish('guide.html', { url: '/' + guide.slug + '/', title: guide.title, description: guide.description }, html => main(html, renderModeGuide(guide)).replace('<script src="./utilities.js" type="module"></script>', ''));
}
const scoring = fs.readFileSync(path.join(source, 'scoring.html'), 'utf8');
const planner = scoring.match(/<section id="score-plan">[\s\S]*?<\/section>/)?.[0];
if (!planner) throw new Error('Score planner missing');
publish('scoring.html', { url: '/score-calculator/', title: 'Krillion Score Calculator — Plan Your Seven Answers', description: 'Add seven recorded Krillion rarity scores with this calculator. Compare combinations from 0 to 700 points without guessing how an answer will be accepted.' }, html => main(html, hero('Krillion Score Calculator', 'Plan seven recorded rarity scores. This tool adds points; it does not decide whether an answer is accepted.') + `<div class="article-body">${planner}<section><h2>How to use the Krillion score calculator</h2><p>Choose the recorded tier for each of seven prompts. Use zero for an unanswered prompt. The total changes as you adjust the selectors. Seven 100-point picks total 700; selecting those points here does not establish that any particular answer earns them in the live game.</p><a href="/scoring/">Read the six rarity tiers and scoring notes ↗</a></section></div>`));
publish('guide.html', { url: '/about/', title: 'About Krillion Fieldnotes — Answer Sources & Updates', description: 'How this independent Krillion guide records official reveals, builds progressive hints, labels missing dates and checks its answer sources.' }, html => main(html, hero('About Krillion Fieldnotes', 'A dated answer record, a useful hint, and a clear source.') + `<div class="article-body"><section><h2>Independent from the official game</h2><p>Krillion Fieldnotes at getkrillion.xyz is an independent answer and hints guide. It is not affiliated with or endorsed by krillion.io. Play the game on <a href="https://krillion.io/">the official Krillion website</a>.</p></section><section><h2>Where the answers come from</h2><p>Prompts, answer spellings, aliases, tiers and scores come from the date-matched <a href="${esc(latest.source)}">official published reveal</a>. We preserve a complete seven-prompt snapshot. We omit answer quips and official artwork. Original short editorial notes identify their own reference links.</p></section><section><h2>How dates and updates work</h2><p>The daily date follows America/New_York. Automated checks run hourly and determine the current date in America/New_York, including daylight saving changes. A valid saved record avoids another request for that date. Checks and publishing can be delayed. Only a complete validated reveal can replace an edition; if a new one is unavailable, the previous record keeps its actual date.</p></section><section><h2>What a hint or search result means</h2><p>First-letter and word-shape hints describe one recorded example, not every answer. Search includes aliases from the selected saved date. Missing dates remain missing, and a missing answer here does not prove the live game rejects it. For a correction, compare the linked official source and current game.</p></section><section><h2>Recorded coverage</h2><p>We currently hold ${editions.length} complete ${editions.length === 1 ? 'edition' : 'editions'}. The latest is ${esc(latest.label)}, checked ${esc(latest.fetchedAt)}.</p><a href="/archive/">Browse every available recorded date ↗</a><p><a href="/status/">Check the last fourteen days of snapshot status ↗</a></p></section></div>`));
publish('guide.html', { url: '/privacy/', title: 'Privacy — Krillion Fieldnotes', description: 'How Krillion Fieldnotes uses browser storage, Google Analytics and public answer records.', index: false }, html => main(html, hero('Privacy and browser storage', 'What this independent guide stores and measures.') + `<div class="article-body"><section><h2>Browser preferences</h2><p>Reviewed prompts, expanded hints and checklist selections are stored in your browser using localStorage. Clearing site data removes those preferences. This guide does not require an account or store an official game score.</p></section><section><h2>Analytics</h2><p>We use Google Analytics 4 to understand page visits and use of hints, copying and search tools. Analytics sends usage information to Google and can use cookies or browser identifiers. Our custom events do not include typed search terms or copied answer text. This site does not claim that nothing leaves your browser.</p><a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">How Google uses information from sites using its services ↗</a></section><section><h2>Answer data and external links</h2><p>Answer records originate from the public official reveal. Opening the official game or a reference link takes you to another site's privacy practices. Searching the saved records runs in your browser after the dated data is downloaded.</p></section></div>`));

for (const e of editions) {
  const snapshot = snapshots.get(e.date);
  snapshot.prompts.forEach((p, i) => {
    const answers = [...p.answers].sort((a, b) => b.score - a.score || a.answer.localeCompare(b.answer, 'en'));
    const title = `${p.text} — Krillion Answers ${e.date}`;
    const base = fs.readFileSync(path.join(source, `edition-${e.date}.html`), 'utf8');
    const card = base.match(new RegExp(`<article class="prompt-card" id="prompt-${i + 1}">[\\s\\S]*?<\\/article>`))?.[0];
    if (!card) throw new Error('Prompt card missing');
    // The complete card supplies the same date-matched hints without a second answer source.
    const hintContent = card.slice(card.indexOf('<div class="hint-stack">'), card.indexOf('<a class="all-answers"')).replaceAll('<h4>', '<h3>').replaceAll('</h4>', '</h3>');
    const rows = answers.slice(0, 200).map(a => `<li><span class="list-rank">${a.score}<small>PTS</small></span><div><strong>${esc(a.answer)}</strong><small>${esc(tierLabel(a.tier))}${a.aliases.length ? ' · Also: ' + a.aliases.map(esc).join(', ') : ''}</small></div><button type="button" class="copy-button" data-copy="${esc(a.answer)}">Copy</button></li>`).join('');
    const content = hero(p.text, `${esc(e.label)} · Prompt ${i + 1} of 7 · ${p.answers.length.toLocaleString('en-US')} recorded answers`) + `<p class="board-source"><a href="/answers/${e.date}/">← All seven prompts for ${esc(e.label)}</a></p><section class="article-body"><h2>Progressive hints for this Krillion prompt</h2>${hintContent}</section><section id="recorded-answers"><h2>Recorded answers and rarity scores</h2><p class="dialog-note">${p.answers.length <= 200 ? 'All recorded answers are shown below.' : 'The first 200 recorded answers are shown below, highest scores first. Search the full list or load more.'} A score applies to this prompt and date.</p><form class="list-search" id="question-search"><label for="question-query">Search this prompt's answers or aliases</label><div><input type="search" id="question-query" name="q" placeholder="An answer or alternative spelling…"><button class="copy-button" type="submit">Find</button></div><label class="sr-only" for="question-score">Filter by score</label><select id="question-score" name="score"><option value="">All scores</option>${[100,85,60,30,15,10].map(n => `<option value="${n}">${n} points</option>`).join('')}</select><button class="reset-link" type="reset">Clear filters</button></form><ol class="answer-list finder-list" id="question-answers">${rows}</ol><div class="list-controls"><span id="question-count" role="status">Showing ${Math.min(200, p.answers.length)} of ${p.answers.length.toLocaleString('en-US')}</span><button type="button" class="copy-button" id="question-more"${p.answers.length <= 200 ? ' hidden' : ''}>Show 100 more ↓</button></div></section><section class="article-body"><h2>About this recorded answer list</h2><p>Source: <a href="${esc(e.source)}" target="_blank" rel="noopener noreferrer">official reveal for ${esc(e.label)}</a>, checked ${esc(e.fetchedAt)}. Spellings, aliases and scores are preserved. A missing entry does not establish that the current game rejects an answer.</p><a href="/why-answer-not-accepted/">Why an answer might be missing ↗</a><p>${snapshot.prompts.map((_, n) => n === i ? `<span>Prompt ${n + 1}</span>` : `<a href="/answers/${e.date}/prompt-${n + 1}/">Prompt ${n + 1}</a>`).join(' · ')}</p></section>`;
    publish(`edition-${e.date}.html`, { url: `/answers/${e.date}/prompt-${i + 1}/`, title, description: `Find recorded answers for “${p.text}” in Krillion on ${e.label}. Includes progressive hints, rarity scores, search and copy controls.`, initialLastmod: e.date, breadcrumbs: [{ name: 'Answer archive', item: site + '/archive/' }, { name: e.label, item: site + `/answers/${e.date}/` }] }, html => main(html, content).replace('src="./app.js"', 'src="./question.js"').replace('data-archive="true"', `data-archive="true" data-prompt-id="${esc(p.id)}"`));
  });
}

// Validate the complete publication plan before removing any legacy date output.
for (const p of pages) {
  const dates = [...p.url.matchAll(/\d{4}-\d{2}-\d{2}/g)].map(m => m[0]);
  if (dates.some(day => day > today)) throw new Error('Future page in publication plan');
  if ((output.get(p.file).match(/<h1\b/g) || []).length !== 1) throw new Error('Each public page needs one main heading: ' + p.url);
}
const oldSitemap = fs.existsSync('sitemap.xml') ? fs.readFileSync('sitemap.xml', 'utf8') : '';
const previousDates = new Map([...oldSitemap.matchAll(/<url>\s*<loc>(.*?)<\/loc>\s*<lastmod>(.*?)<\/lastmod>/g)].map(m => [m[1], m[2]]));
for (const p of pages) {
  const old = fs.existsSync(p.file) ? fs.readFileSync(p.file, 'utf8') : null;
  p.lastmod = old === output.get(p.file) && previousDates.has(site + p.url) ? previousDates.get(site + p.url) : !previousDates.has(site + p.url) && p.initialLastmod ? p.initialLastmod : today;
}
const answerRoot = path.resolve(root, 'answers');
if (fs.existsSync(answerRoot)) for (const name of fs.readdirSync(answerRoot)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) continue;
  const target = path.resolve(answerRoot, name);
  if (path.dirname(target) !== answerRoot || !target.startsWith(root + path.sep)) throw new Error('Unsafe legacy cleanup target');
  if (!editions.some(e => e.date === name)) fs.rmSync(target, { recursive: true, force: true });
}
if (fs.existsSync(path.join(answerRoot, 'index.html'))) fs.unlinkSync(path.join(answerRoot, 'index.html'));
for (const name of assets) output.set('assets/guide/' + name, fs.readFileSync(path.join(source, name)));
for (const e of editions) output.set(`assets/guide/records/${e.date}.json`, json(snapshots.get(e.date)));
output.set('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + pages.filter(p => p.index !== false).map(p => `  <url><loc>${site}${p.url}</loc><lastmod>${p.lastmod}</lastmod></url>`).join('\n') + '\n</urlset>\n');
output.set('robots.txt', `User-agent: *\nAllow: /\nDisallow: /data/\nDisallow: /tools/\nDisallow: /tests/\nSitemap: ${site}/sitemap.xml\n`);
output.set('_redirects', '/answers /archive/ 301\n/answers/ /archive/ 301\n');
output.set('_headers', '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n\n/assets/*\n  Cache-Control: public, max-age=0, must-revalidate\n  X-Robots-Tag: noindex\n\n/design/*\n  X-Robots-Tag: noindex, nofollow\n\n/search/*\n  X-Robots-Tag: noindex, follow\n\n/release.json\n  Cache-Control: no-cache\n  X-Robots-Tag: noindex\n');
output.set('404.html', '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page Not Found — Krillion Fieldnotes</title><link rel="stylesheet" href="/assets/guide/app.css"></head><body><main class="container utility-page"><h1>That edition is not in our records.</h1><p>We only publish complete recorded rounds. Future and unavailable dates have no answer page.</p><p><a href="/">Latest recorded answers →</a> · <a href="/archive/">Browse the archive →</a></p></main></body></html>');
output.set('_headers', output.get('_headers') + '\n/status/*\n  Cache-Control: no-cache\n  X-Robots-Tag: noindex, follow\n');
output.set('status/index.html', renderStatus({ root }));
const hash = createHash('sha256');
for (const [file, content] of [...output].sort(([a], [b]) => a.localeCompare(b))) hash.update(file).update(content);
const release = { id: hash.digest('hex').slice(0, 20), latestDate: latest.date, indexedPages: pages.filter(p => p.index !== false).length, officialPrompts: 7, answerCount: latest.answerCount };
output.set('release.json', json(release));
for (const [file, content] of output) {
  const absolute = path.resolve(root, file);
  if (!absolute.startsWith(root + path.sep)) throw new Error('Unsafe output path');
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (fs.existsSync(absolute) && fs.readFileSync(absolute).equals(bytes)) continue;
  fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, bytes);
}
console.log(`Production guide: ${latest.date}; ${release.indexedPages} indexable pages; release ${release.id}`);
