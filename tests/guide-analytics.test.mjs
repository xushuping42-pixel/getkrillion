import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function events() {
  const listeners = new Map(), calls = [];
  vm.runInNewContext(fs.readFileSync(new URL('../design/phase-one/site.js', import.meta.url), 'utf8'), {
    window: { gtag: (...args) => calls.push(args) },
    document: { body: { dataset: { day: '2026-11-18' } }, addEventListener: (name, handler) => listeners.set(name, handler) }
  });
  return { listeners, calls };
}

test('official_game_open counts the header game button and excludes official source links', () => {
  const { listeners, calls } = events();
  for (const header of [false, true]) listeners.get('click')({ target: { closest: selector => selector === 'a' ? { href: 'https://krillion.io/', classList: { contains: name => header && name === 'practice-link' } } : null } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'official_game_open');
});

test('the real home search form triggers answer_search without including the search term', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<form id="home-search" action="\/search\/" method="get">/);
  const { listeners, calls } = events();
  listeners.get('submit')({ target: { matches: selector => selector.split(',').some(s => s.trim() === '#home-search') } });
  assert.equal(calls[0][1], 'answer_search');
  assert.deepEqual(Object.keys(calls[0][2]), ['day']);
});

test('all seven hint cards carry their prompt number and open events preserve it', () => {
  const html = fs.readFileSync(new URL('../hints/index.html', import.meta.url), 'utf8');
  assert.deepEqual([...html.matchAll(/class="hint-only-card" data-prompt="(\d+)"/g)].map(m => m[1]), ['1', '2', '3', '4', '5', '6', '7']);
  const { listeners, calls } = events();
  for (const card of [{ dataset: { prompt: '7' } }, { dataset: {}, id: 'prompt-3' }]) {
    listeners.get('toggle')({ target: { tagName: 'DETAILS', open: true, classList: { contains: () => false }, closest: () => card } });
  }
  assert.equal(calls[0][2].prompt_index, 7);
  assert.equal(calls[1][2].prompt_index, 3);
});

test('GA page_location retains campaign attribution while excluding searches and other query data', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m => m[1].includes('URLSearchParams'))?.[1];
  assert.ok(script, 'The generated page must contain the attribution filter');
  const window = {};
  vm.runInNewContext(script, { window, URLSearchParams, Date, location: { origin: 'https://getkrillion.xyz', pathname: '/', search: '?q=private+search&date=2026-11-18&utm_source=newsletter&utm_medium=email&utm_campaign=daily&utm_content=button&utm_term=krillion&gclid=click-id&email=private%40example.com' } });
  assert.equal(typeof window.gtag, 'function', 'Event listeners need a global gtag entry point');
  const config = [...window.dataLayer].find(args => args[0] === 'config');
  const location = new URL(config[2].page_location);
  assert.deepEqual([...location.searchParams.keys()], ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid']);
  assert.equal(location.searchParams.get('gclid'), 'click-id');
  window.gtag('event', 'answer_search');
  assert.equal(window.dataLayer.at(-1)[1], 'answer_search');
});
