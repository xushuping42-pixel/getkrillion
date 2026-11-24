import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const slugs = ['krillion-unlimited','krillion-multiplayer','krillion-minecraft','krillion-roblox'];
const site = 'https://getkrillion.xyz';
const links = html => [...html.matchAll(/href="([^"]+)"/g)].map(m => new URL(m[1], site)).filter(u => u.origin === site).map(u => u.pathname);

test('the four evergreen guides are indexable canonical pages with undated titles and valid breadcrumbs', () => {
  const sitemap = read('sitemap.xml');
  for (const slug of slugs) {
    const url = site + '/' + slug + '/';
    const html = read(slug + '/index.html');
    assert.ok(sitemap.includes('<loc>' + url + '</loc>'));
    assert.ok(html.includes('rel="canonical" href="' + url + '"'));
    assert.ok(html.includes('content="index,follow,max-image-preview:large"'));
    const title = html.match(/<title>(.*?)<\/title>/s)[1];
    assert.match(title.toLowerCase(), new RegExp(slug.replaceAll('-', ' ')));
    assert.doesNotMatch(title, /\b20\d\d\b|\b(today|november)\b/i);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    const crumbs = schemas.find(s => s['@type'] === 'BreadcrumbList').itemListElement;
    assert.equal(crumbs[0].item, site + '/');
    assert.equal(crumbs.at(-1).item, url);
    assert.equal((html.match(/rel="stylesheet"/g) || []).length, 1);
  }
});

test('one home entry reaches all four evergreen guides within two clicks and each guide links to its siblings', () => {
  const home = links(read('index.html'));
  assert.deepEqual(home.filter(p => slugs.some(s => p === '/' + s + '/')), ['/krillion-unlimited/']);
  const graph = new Map([['/', home], ...slugs.map(s => ['/' + s + '/', links(read(s + '/index.html'))])]);
  const distance = new Map([['/', 0]]), queue = ['/'];
  while (queue.length) {
    const current = queue.shift();
    for (const next of graph.get(current) || []) if (!distance.has(next)) { distance.set(next, distance.get(current) + 1); queue.push(next); }
  }
  for (const slug of slugs) {
    assert.ok(distance.get('/' + slug + '/') <= 2, 'Guide unreachable within two clicks: ' + slug);
    const destinations = graph.get('/' + slug + '/');
    for (const other of slugs.filter(s => s !== slug)) assert.ok(destinations.includes('/' + other + '/'));
  }
});