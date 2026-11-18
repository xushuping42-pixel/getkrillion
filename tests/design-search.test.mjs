import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { indexAnswers, findAnswers, findPrompts, normalize } from '../design/phase-one/search-core.mjs';
import { validateReveal } from '../tools/reveal-data.mjs';

const recorded = new URL('../design/phase-one/records/2026-11-18.json', import.meta.url);
const snapshot = JSON.parse(fs.readFileSync(fs.existsSync(recorded) ? recorded : new URL('../design/phase-one/reveal-snapshot.json', import.meta.url), 'utf8'));
const index = indexAnswers(snapshot);
test('official aliases return the canonical recorded answer and correct prompt', () => {
  const matches = findAnswers(index, { query: 'schmoo' });
  assert.equal(matches[0].answer, 'Shmoo');
  assert.equal(matches[0].score, 100);
  assert.equal(matches[0].promptId, 'p1');
  assert.equal(matches[0].aliasMatch, true);
});
test('prompt and score filters combine rather than replacing one another', () => {
  const matches = findAnswers(index, { prompt: 'p4', score: '100', query: 'Dinosaur' });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].answer, 'Dinosaur');
  assert.equal(findAnswers(index, { prompt: 'p1', score: '100', query: 'Dinosaur' }).length, 0);
  assert.equal(findAnswers(index, { query: 'Dinosaur', score: '10' }).some(a => a.answer === 'Dinosaur'), false);
});
test('default ordering follows scores; alphabetical ordering is reproducible', () => {
  const scores = findAnswers(index, { prompt: 'p2' });
  assert.ok(scores.every((r, i) => !i || scores[i - 1].score >= r.score));
  const alphabet = findAnswers(index, { prompt: 'p2', sort: 'alphabetical' });
  assert.ok(alphabet.every((r, i) => !i || alphabet[i - 1].answer.localeCompare(r.answer, 'en') <= 0));
});
test('case, accents and punctuation do not require exact typing', () => {
  assert.equal(normalize('  Café—AU-LAIT! '), 'cafe au lait');
  assert.equal(findAnswers(index, { query: ' SHMOO ' })[0].answer, 'Shmoo');
  assert.equal(findAnswers(index, { query: 'qa-unlisted-answer-928347' }).length, 0);
});
test('historical question lookup never invents a date', () => {
  const editions = [{ date: snapshot.date, label: 'Recorded day', href: 'edition-' + snapshot.date + '.html', prompts: snapshot.prompts.map(p => ({ id: p.id, text: p.text, count: p.answers.length })) }];
  assert.equal(findPrompts(editions, 'helmet').length, 1);
  assert.equal(findPrompts(editions, 'helmet')[0].href.endsWith('#prompt-3'), true);
  assert.equal(findPrompts(editions, '', '2026-11-16').length, 0);
});
test('publication guard rejects partial dates, conflicting duplicates and inconsistent tiers', () => {
  assert.equal(validateReveal(snapshot, snapshot.date).length, 7);
  assert.throws(() => validateReveal(snapshot, '2026-11-17'));
  assert.throws(() => validateReveal({ ...snapshot, prompts: snapshot.prompts.slice(0, 6) }, snapshot.date));
  const broken = structuredClone(snapshot);
  broken.prompts[0].answers[0].score = 10;
  assert.throws(() => validateReveal(broken, broken.date), /mismatched/);
});
