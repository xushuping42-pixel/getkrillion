import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { choosePractice, restorePractice } from '../design/phase-one/practice-core.mjs';

const answerSource = fs.readFileSync(new URL('../js/answer.js', import.meta.url), 'utf8');
const answerURL = 'data:text/javascript;base64,' + Buffer.from(answerSource).toString('base64');
const gameSource = fs.readFileSync(new URL('../js/game.js', import.meta.url), 'utf8').replace("from './answer.js'", `from '${answerURL}'`);
const Game = await import('data:text/javascript;base64,' + Buffer.from(gameSource).toString('base64'));
const bank = JSON.parse(fs.readFileSync(new URL('../data/prompts.json', import.meta.url), 'utf8')).prompts;
const save = game => ({ version: 1, ids: game.ids, attempts: Array.from({ length: 7 }, (_, i) => (game.attempts[i] || []).map(a => a.text)) });

test('practice rounds have seven distinct wordings and avoid the previous round', () => {
  const first = choosePractice(bank, [], () => .99), second = choosePractice(bank, first.map(p => p.id), () => .99);
  assert.equal(new Set(first.map(p => p.p.toLowerCase())).size, 7);
  assert.ok(second.every(p => !first.some(old => old.p.toLowerCase() === p.p.toLowerCase())));
});
test('restored practice rebuilds duplicate sets and scores from recorded guesses', () => {
  const game = Game.createGame(choosePractice(bank));
  const answer = game.prompt.a[0][0];
  assert.equal(game.guess(answer).points, 99);
  assert.equal(game.guess(answer).duplicate, true);
  const restored = restorePractice(bank, save(game), Game.createGame);
  assert.ok(restored); assert.equal(restored.total, 99); assert.equal(restored.tries.length, 1);
  assert.equal(restored.guess(answer).duplicate, true);
});
test('seven complete practice prompts produce a replayable seven-row review', () => {
  const game = Game.createGame(choosePractice(bank));
  for (let i = 0; i < 21; i++) game.guess('qa-unlisted-328947');
  assert.equal(game.done, true); assert.equal(game.scores.length, 7);
  assert.equal(Object.keys(game.attempts).length, 7);
  const restored = restorePractice(bank, save(game), Game.createGame);
  assert.equal(restored.done, true); assert.equal(restored.total, game.total);
});
test('tampered practice progress cannot skip unfinished prompts', () => {
  const game = Game.createGame(choosePractice(bank));
  const saved = save(game); saved.attempts[2] = ['qa-unlisted-328947'];
  assert.equal(restorePractice(bank, saved, Game.createGame), null);
});
