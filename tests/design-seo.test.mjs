import test from 'node:test';
import assert from 'node:assert/strict';
import { editionSeo, hintSeo } from '../tools/design-seo.mjs';

test('today labels follow the actual recorded edition date', () => {
  const seo = editionSeo('2026-11-18', '2026-11-18', { home: true });
  assert.equal(seo.title, 'Krillion Answers Today — November 18, 2026: Hints & Rare Answers');
  assert.equal(seo.heading, 'Krillion Answers Today — November 18, 2026');
});

test('a missed capture retains its real date and stops claiming to be today', () => {
  const seo = editionSeo('2026-11-18', '2026-11-19', { home: true });
  assert.equal(seo.heading, 'Latest Recorded Krillion Answers — November 18, 2026');
  assert.doesNotMatch(seo.title, /Today|November 19/);
  assert.doesNotMatch(hintSeo('2026-11-18', '2026-11-19').title, /Today|November 19/);
});

test('dated page headings remain stable across later build days', () => {
  const first = editionSeo('2026-11-18', '2026-11-18');
  const later = editionSeo('2026-11-18', '2026-11-19');
  assert.equal(first.title, later.title);
  assert.equal(first.heading, later.heading);
  assert.doesNotMatch(first.title, /Today/);
});

test('future or invalid dates cannot produce search metadata', () => {
  assert.throws(() => editionSeo('2026-11-19', '2026-11-18', { home: true }));
  assert.throws(() => editionSeo('2026-02-31', '2026-11-18'));
});
