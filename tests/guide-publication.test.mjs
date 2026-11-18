import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { easternDate } from '../design/phase-one/date-core.mjs';
import { notifyFailure } from '../tools/notify-failure.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const site = 'https://getkrillion.xyz';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const release = JSON.parse(read('release.json'));
const snapshot = JSON.parse(read(`assets/guide/records/${release.latestDate}.json`));
const locs = [...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
const fileFor = url => new URL(url).pathname === '/' ? 'index.html' : new URL(url).pathname.slice(1) + 'index.html';

test('sitemap publishes complete real pages with unique titles and matching canonical URLs', () => {
  assert.equal(locs.length, release.indexedPages);
  const titles = new Set();
  for (const url of locs) {
    assert.ok(url.startsWith(site + '/'));
    assert.doesNotMatch(url, /\/design\/|\/search\/|\/unlimited\//);
    const html = read(fileFor(url));
    assert.ok(html.includes(`rel="canonical" href="${url}"`));
    assert.ok(html.includes('name="description"'));
    assert.doesNotMatch(html, /content="noindex|practice\.html|\/js\/main\.js|\{\{[A-Z_]+\}\}/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    const title = html.match(/<title>(.*?)<\/title>/s)[1];
    assert.ok(!titles.has(title), 'Duplicate page title: ' + title); titles.add(title);
    for (const date of url.match(/\d{4}-\d{2}-\d{2}/g) || []) assert.ok(date <= easternDate());
  }
});

test('public navigation and assets resolve without linking to previews or unavailable dates', () => {
  for (const url of [...locs, site + '/search/', site + '/privacy/']) {
    const html = read(fileFor(url));
    for (const match of html.matchAll(/\b(?:href|src|action|data-snapshot)="([^"]+)"/g)) {
      const target = new URL(match[1], url);
      if (target.origin !== site) continue;
      assert.ok(!target.pathname.startsWith('/design/'), 'Preview link on ' + url);
      const relative = target.pathname === '/' ? 'index.html' : target.pathname.slice(1) + (target.pathname.endsWith('/') ? 'index.html' : '');
      assert.ok(fs.existsSync(path.join(root, relative)), `${url} links to missing ${relative}`);
    }
  }
});

test('seven prompt details have crawlable answer rows and correctly scoped search data', () => {
  for (let i = 1; i <= 7; i++) {
    const html = read(`answers/${release.latestDate}/prompt-${i}/index.html`);
    const list = html.match(/<ol class="answer-list finder-list" id="question-answers">([\s\S]*?)<\/ol>/)[1];
    assert.ok((list.match(/<li>/g) || []).length >= 1);
    assert.ok((list.match(/<li>/g) || []).length <= 200);
    assert.ok(html.includes('data-prompt-id="' + snapshot.prompts[i - 1].id + '"'));
    assert.ok(html.includes(`data-snapshot="/assets/guide/records/${release.latestDate}.json"`));
  }
  assert.ok(read('search/index.html').includes('content="noindex,follow"'));
  assert.ok(read('_headers').includes('/search/*\n  X-Robots-Tag: noindex, follow'));
});

test('WeChat failure delivery includes stages and log link without exposing the webhook', async () => {
  let body;
  const delivered = await notifyFailure({ webhook: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test-only', report: { targetDate: '2026-11-18', capture: 'failed', httpStatus: 403 }, runUrl: 'https://github.com/example/repo/actions/runs/1', fetchImpl: async (url, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ errcode: 0 }) }; } });
  assert.equal(delivered, true); assert.equal(body.msgtype, 'text');
  assert.match(body.text.content, /2026-11-18|403/);
  assert.doesNotMatch(body.text.content, /test-only|key=/);
});

test('missing notification configuration and rejected delivery are failures', async () => {
  await assert.rejects(notifyFailure({}));
  await assert.rejects(notifyFailure({ webhook: 'https://example.com/?key=test-only' }));
  await assert.rejects(notifyFailure({ webhook: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test-only', fetchImpl: async () => ({ ok: true, json: async () => ({ errcode: 93000 }) }) }));
});
