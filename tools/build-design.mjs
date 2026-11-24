import fs from 'node:fs';
import path from 'node:path';
import { validateReveal } from './reveal-data.mjs';
import { notes } from '../design/phase-one/notes.mjs';
import { easternDate } from '../design/phase-one/date-core.mjs';
import { editionSeo } from './design-seo.mjs';

const root = process.cwd();
const target = path.join(root, 'design/phase-one');
const snapshot = JSON.parse(fs.readFileSync(path.join(target, 'reveal-snapshot.json'), 'utf8'));
const snapshots = new Map([[snapshot.date, { ...snapshot, file: 'reveal-snapshot.json' }]]);
const recordsPath = path.join(target, 'records');
if (fs.existsSync(recordsPath)) for (const name of fs.readdirSync(recordsPath)) {
  if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) continue;
  const record = JSON.parse(fs.readFileSync(path.join(recordsPath, name), 'utf8'));
  if (name !== record.date + '.json') throw new Error('Record filename and date do not match');
  if (!snapshots.has(record.date)) snapshots.set(record.date, { ...record, file: 'records/' + name });
}
const today = easternDate();
const editions = [];
for (const snapshot of [...snapshots.values()].sort((a, b) => b.date.localeCompare(a.date))) {
const day = snapshot.date;
if (day > today || snapshot.source !== 'https://krillion.io/api/reveal?date=' + day || !Number.isFinite(Date.parse(snapshot.fetchedAt))) throw new Error('Invalid snapshot provenance');
const prompts = validateReveal(snapshot, day);
const compare = (a, b) => b.score - a.score || a.answer.localeCompare(b.answer, 'en');
const tierLabel = tier => ({ krillion: 'One in a Krillion', deepcut: 'Deep Cut', deep_cut: 'Deep Cut', rare: 'Rare', schooler: 'Schooler', tooclever: 'Too Clever', too_clever: 'Too Clever', plankton: 'Plankton' }[tier] || tier.replaceAll('_', ' '));
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z'));
const cards = prompts.map((p, i) => {
  const featured = p.answers.reduce((best, row) => row.score > best.score ? row : best);
  const answer = featured.answer;
  const words = answer.split(/\s+/);
  const note = notes.find(note => note.date === day && note.promptId === p.id && note.answer === answer);
  const noteHtml = note ? `<aside class="answer-note"><p class="micro">EDITOR’S FIELD NOTE</p><h4>${esc(note.title)}</h4><p>${esc(note.text)}</p><a href="${esc(note.source)}" target="_blank" rel="noopener noreferrer">${esc(note.sourceLabel)} ↗</a></aside>` : '';
  const shape = words.map(word => [...word].map((c, j) => j === 0 || !/[\p{L}\p{N}]/u.test(c) ? c.toUpperCase() : '·').join('')).join(' ');
  return `<article class="prompt-card" id="prompt-${i + 1}">
  <div class="card-top"><span class="category">Daily discovery</span><button class="review-toggle" type="button" data-review="${i + 1}" aria-pressed="false" aria-label="Mark prompt ${i + 1} as reviewed"><span aria-hidden="true">✓</span></button></div>
  <div class="prompt-heading"><span class="prompt-number">${String(i + 1).padStart(2, '0')}</span><div><p class="micro">PROMPT ${i + 1} OF 7</p><h3><span class="desktop-prompt-title">${esc(p.text)}</span><button class="prompt-expand" type="button" aria-expanded="false" aria-controls="prompt-hints-${i + 1}" aria-label="Show hints for prompt ${i + 1}: ${esc(p.text)}"><span>${esc(p.text)}</span><span aria-hidden="true">+</span></button></h3></div></div>
  <p class="answer-count">${p.answers.length.toLocaleString('en-US')} recorded answers <span aria-hidden="true">·</span> Official scores preserved</p>
  <div class="hint-stack"><div id="prompt-hints-${i + 1}">
    <details><summary><span><span class="hint-icon" aria-hidden="true">✧</span> A gentle nudge</span><span class="expand" aria-hidden="true">+</span></summary><div class="hint-content">One recorded example starts with <strong>“${esc([...answer][0].toUpperCase())}”</strong>.</div></details>
    <details><summary><span><span class="hint-icon" aria-hidden="true">✧</span> A little more help</span><span class="expand" aria-hidden="true">+</span></summary><div class="hint-content"><p>${words.length} ${words.length === 1 ? 'word' : 'words'} · ${[...answer.replace(/\s/g, '')].length} characters without spaces</p><p class="word-shape">${esc(shape)}</p></div></details>
    <details class="reveal"><summary><span>Ready for one answer?</span><span class="expand" aria-hidden="true">↗</span></summary><div class="hint-content answer-example"><div><span class="micro">${featured.score} POINTS · ${esc(tierLabel(featured.tier))}</span><strong>${esc(answer)}</strong></div><button type="button" class="copy-button" data-copy="${esc(answer)}">Copy <span aria-hidden="true">⧉</span></button></div>${noteHtml}</details>
  </div></div>
  <a class="all-answers" href="${esc(snapshot.source)}" data-dialog="answers-${i + 1}" aria-haspopup="dialog">Explore ${p.answers.length.toLocaleString('en-US')} answers <span aria-hidden="true">↗</span></a>
</article>`;
}).join('\n');
const dialogs = prompts.map((p, i) => `<dialog class="answer-dialog" id="answers-${i + 1}" data-prompt-id="${esc(p.id)}" aria-labelledby="dialog-title-${i + 1}">
<div class="dialog-head"><span class="micro">RECORDED REVEAL · ${esc(day)}</span><button class="dialog-close" type="button" aria-label="Close answer list">×</button></div>
<h2 id="dialog-title-${i + 1}">${esc(p.text)}</h2><p class="dialog-note">${p.answers.length.toLocaleString('en-US')} recorded answers with their official scores. This dated snapshot is a reference; the live game decides acceptance.</p>
<form class="list-search" data-list-search><label class="micro" for="list-query-${i + 1}">SEARCH THIS PROMPT</label><div><input id="list-query-${i + 1}" type="search" name="q" placeholder="Answer or alternative spelling…" autocomplete="off"><button class="copy-button" type="submit">Find</button></div><label class="sr-only" for="list-score-${i + 1}">Filter by rarity score</label><select id="list-score-${i + 1}" name="score"><option value="">All rarity tiers</option><option value="100">100 · One in a Krillion</option><option value="85">85 · Deep Cut</option><option value="60">60 · Rare</option><option value="30">30 · Schooler</option><option value="15">15 · Too Clever</option><option value="10">10 · Plankton</option></select><button class="reset-link" type="reset">Clear filters</button></form>
<ol class="answer-list">${p.answers.slice().sort(compare).slice(0, 50).map(a => `<li><span class="list-rank">${a.score}<small>PTS</small></span><div><strong>${esc(a.answer)}</strong><small>${esc(tierLabel(a.tier))}${a.aliases.length ? ' · Also: ' + a.aliases.map(esc).join(', ') : ''}</small></div><button class="copy-button" type="button" data-copy="${esc(a.answer)}" aria-label="Copy ${esc(a.answer)}">Copy</button></li>`).join('')}</ol>
<div class="list-controls"><span class="dialog-note" data-list-count>Showing ${Math.min(50, p.answers.length)} of ${p.answers.length.toLocaleString('en-US')}</span>${p.answers.length > 50 ? '<button class="copy-button" type="button" data-load-more>Show 50 more ↓</button>' : ''}</div><p class="dialog-note" data-list-message role="status"></p>
<p class="dialog-note">Source: <a href="${esc(snapshot.source)}" target="_blank" rel="noopener noreferrer">official reveal ↗</a>. Recorded ${esc(snapshot.fetchedAt)}.</p></dialog>`).join('\n');
const template = fs.readFileSync(path.join(target, 'template.html'), 'utf8');
const tokens = {
  DATE: esc(date), DAY: esc(day), DATE_STATUS: day === today ? "Today's recorded reveal" : day === [...snapshots.keys()].sort().at(-1) ? 'Latest complete recorded reveal' : 'Recorded past edition',
  ANSWER_COUNT: prompts.reduce((n, p) => n + p.answers.length, 0).toLocaleString('en-US'),
  SOURCE: esc(snapshot.source), CHECKED_AT: esc(snapshot.fetchedAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')),
  SNAPSHOT_FILE: esc(snapshot.file),
  ARCHIVED: String(day !== [...snapshots.keys()].sort().at(-1)),
  CARDS: cards, DIALOGS: dialogs,
  BUILT_AT: esc(new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()) + ' UTC')
};
function renderEdition(home) {
  const seo = editionSeo(day, today, { home });
  let html = template;
  for (const [key, value] of Object.entries({ ...tokens, PAGE_TITLE: esc(seo.title), PAGE_HEADING: esc(seo.heading) })) html = html.replaceAll('{{' + key + '}}', String(value));
  if (!home) html = html.replace('data-archive="false"', 'data-archive="true"');
  if (!home || day !== today) html = html.replace("Jump to today's seven prompts ↓", "Jump to this edition's seven prompts ↓");
  if (!home || tokens.ARCHIVED === 'true') html = html.replace('class="active" href="./#daily-prompts" aria-current="page"', 'href="./#daily-prompts"');
  if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved design token');
  return html;
}
fs.writeFileSync(path.join(target, 'edition-' + day + '.html'), renderEdition(false));
if (day === [...snapshots.keys()].sort().at(-1)) fs.writeFileSync(path.join(target, 'index.html'), renderEdition(true));
editions.push({ date: day, label: date, file: snapshot.file, href: 'edition-' + day + '.html', source: snapshot.source, fetchedAt: snapshot.fetchedAt, answerCount: prompts.reduce((sum, p) => sum + p.answers.length, 0), prompts: prompts.map(p => ({ id: p.id, text: p.text, count: p.answers.length })) });
console.log(`Design preview: ${day}; ${prompts.length} prompts; ${tokens.ANSWER_COUNT} official recorded answers`);
console.log('Output: design/phase-one/index.html');
}
fs.writeFileSync(path.join(target, 'archive-index.json'), JSON.stringify(editions));
await import('./build-design-pages.mjs');
