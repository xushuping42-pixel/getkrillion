import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { recordReveal } from '../tools/record-reveal.mjs';
import { easternDate, nextEasternMidnight } from '../design/phase-one/date-core.mjs';

function workspace(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fieldnotes-record-test-'));
  t.after(() => {
    const resolved = fs.realpathSync(root);
    if (path.dirname(resolved) !== fs.realpathSync(os.tmpdir()) || !path.basename(resolved).startsWith('fieldnotes-record-test-')) throw new Error('Unsafe temporary cleanup target');
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return root;
}
const reveal = date => ({ date, prompts: Array.from({ length: 7 }, (_, i) => ({ id: 'p' + (i + 1), text: 'Question ' + (i + 1), answers: [{ answer: 'Recorded answer ' + i, aliases: [], score: 100, tier: 'krillion' }] })) });
const response = data => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => data });
const snapshotPath = root => path.join(root, 'design/phase-one/reveal-snapshot.json');
const isolatedEnvironment = { ...process.env, REVEAL_REFRESH: 'false', REVEAL_BUILD: 'preview', REVEAL_NOTIFICATION_CONFIGURED: 'false' };

test('winter runs record different Eastern dates and never stop the later new-day run', async t => {
  const root = workspace(t), requested = [];
  const fetchImpl = async url => { const day = new URL(url).searchParams.get('date'); requested.push(day); return response(reveal(day)); };
  await recordReveal({ root, now: '2026-11-18T04:20:00Z', fetchImpl });
  await recordReveal({ root, now: '2026-11-18T05:20:00Z', fetchImpl });
  assert.deepEqual(requested, ['2026-11-17', '2026-11-18']);
  assert.equal(JSON.parse(fs.readFileSync(snapshotPath(root))).date, '2026-11-18');
  assert.ok(fs.existsSync(path.join(root, 'design/phase-one/records/2026-11-17.json')));
});
test('summer second run reuses its valid record without a second network request', async t => {
  const root = workspace(t); let calls = 0;
  const fetchImpl = async () => { calls++; return response(reveal('2026-07-18')); };
  await recordReveal({ root, now: '2026-07-18T04:20:00Z', fetchImpl });
  const second = await recordReveal({ root, now: '2026-07-18T05:20:00Z', fetchImpl });
  assert.equal(calls, 1); assert.equal(second.capture, 'already-recorded');
});
test('HTTP 403 preserves the previous snapshot and creates no replacement record', async t => {
  const root = workspace(t);
  await recordReveal({ root, now: '2026-11-18T05:20:00Z', fetchImpl: async () => response(reveal('2026-11-18')) });
  const before = fs.readFileSync(snapshotPath(root), 'utf8');
  await assert.rejects(recordReveal({ root, now: '2026-11-19T05:20:00Z', fetchImpl: async () => ({ ok: false, status: 403, headers: new Headers() }) }), error => error.httpStatus === 403);
  assert.equal(fs.readFileSync(snapshotPath(root), 'utf8'), before);
  assert.equal(fs.existsSync(path.join(root, 'design/phase-one/records/2026-11-19.json')), false);
});
test('a partial or wrong-date reveal never enters the dated archive', async t => {
  const root = workspace(t);
  await assert.rejects(recordReveal({ root, now: '2026-11-18T05:20:00Z', fetchImpl: async () => response(reveal('2026-11-17')) }));
  const incomplete = reveal('2026-11-18'); incomplete.prompts.pop();
  await assert.rejects(recordReveal({ root, now: '2026-11-18T05:20:00Z', fetchImpl: async () => response(incomplete) }));
  assert.equal(fs.existsSync(snapshotPath(root)), false);
});
test('a valid latest snapshot repairs a corrupt dated cache without requesting again', async t => {
  const root = workspace(t);
  await recordReveal({ root, now: '2026-11-18T05:20:00Z', fetchImpl: async () => response(reveal('2026-11-18')) });
  const record = path.join(root, 'design/phase-one/records/2026-11-18.json');
  fs.writeFileSync(record, 'corrupt');
  const result = await recordReveal({ root, now: '2026-11-18T06:20:00Z', fetchImpl: async () => { throw new Error('Unexpected request'); } });
  assert.equal(result.capture, 'already-recorded'); assert.equal(JSON.parse(fs.readFileSync(record)).date, '2026-11-18');
});
test('fetching an older edition never rolls the latest pointer backwards', async t => {
  const root = workspace(t);
  const fetchImpl = async url => response(reveal(new URL(url).searchParams.get('date')));
  await recordReveal({ root, now: '2026-11-18T05:20:00Z', fetchImpl });
  await recordReveal({ root, date: '2026-11-17', now: '2026-11-18T05:20:00Z', fetchImpl });
  assert.equal(JSON.parse(fs.readFileSync(snapshotPath(root))).date, '2026-11-18');
});
test('future and invalid calendar dates are rejected before any request', async t => {
  const root = workspace(t); let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('Unexpected request'); };
  await assert.rejects(recordReveal({ root, date: '2026-11-19', now: '2026-11-18T05:20:00Z', fetchImpl }));
  await assert.rejects(recordReveal({ root, date: '2026-02-31', now: '2026-11-18T05:20:00Z', fetchImpl }));
  assert.equal(calls, 0);
});

test('an explicit cloud source recheck replaces cached data only after validation', async t => {
  const root = workspace(t), day = easternDate();
  await recordReveal({ root, fetchImpl: async () => response(reveal(day)) });
  const before = fs.readFileSync(snapshotPath(root), 'utf8');
  await assert.rejects(recordReveal({ root, forceRefresh: true, fetchImpl: async () => response({ date: day, prompts: [] }) }));
  assert.equal(fs.readFileSync(snapshotPath(root), 'utf8'), before);
  let calls = 0;
  const result = await recordReveal({ root, forceRefresh: true, fetchImpl: async () => { calls++; return response(reveal(day)); } });
  assert.equal(calls, 1); assert.equal(result.capture, 'saved');
});
test('a build failure is reported separately from successful capture', async t => {
  const root = workspace(t), day = easternDate();
  await recordReveal({ root, fetchImpl: async () => response(reveal(day)) });
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/update-design.mjs', import.meta.url))], { cwd: root, encoding: 'utf8', env: isolatedEnvironment });
  assert.equal(result.status, 1);
  const report = JSON.parse(fs.readFileSync(path.join(root, 'design/phase-one/record-status.json')));
  assert.equal(report.capture, 'already-recorded'); assert.equal(report.validation, 'passed'); assert.equal(report.build, 'failed');
  assert.equal(report.deployment, 'not-configured'); assert.equal(report.notification, 'not-configured');
});
test('Eastern midnight calculations respect 23-hour and 25-hour days', () => {
  assert.equal(nextEasternMidnight(Date.parse('2026-03-08T05:00:00Z')), Date.parse('2026-03-09T04:00:00Z'));
  assert.equal(nextEasternMidnight(Date.parse('2026-11-01T04:00:00Z')), Date.parse('2026-11-02T05:00:00Z'));
});

test('capture-only persists a validated record before any build runs', async t => {
  const root = workspace(t);
  await recordReveal({ root, fetchImpl: async () => response(reveal(easternDate())) });
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/update-design.mjs', import.meta.url)), '--capture-only'], { cwd: root, encoding: 'utf8', env: isolatedEnvironment });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(fs.readFileSync(path.join(root, 'design/phase-one/record-status.json')));
  assert.equal(report.capture, 'already-recorded');
  assert.equal(report.validation, 'passed');
  assert.equal(report.build, 'not-run');
});

test('build-only uses the last saved edition after capture failure without another request', async t => {
  const root = workspace(t), day = easternDate();
  const yesterday = new Date(Date.parse(day + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
  await recordReveal({ root, date: yesterday, fetchImpl: async () => response(reveal(yesterday)) });
  const directory = path.join(root, 'design/phase-one');
  fs.writeFileSync(path.join(directory, 'record-status.json'), JSON.stringify({ targetDate: day, capture: 'failed', validation: 'not-passed', error: 'Official reveal unavailable: HTTP 403', build: 'not-run' }));
  fs.mkdirSync(path.join(root, 'tools'));
  fs.writeFileSync(path.join(root, 'tools/build-design.mjs'), 'console.log("Saved edition rebuild completed");');
  fs.writeFileSync(path.join(root, 'no-network.mjs'), 'globalThis.fetch = () => { throw new Error("Unexpected network request during build"); };');
  const result = spawnSync(process.execPath, ['--import', pathToFileURL(path.join(root, 'no-network.mjs')).href, fileURLToPath(new URL('../tools/update-design.mjs', import.meta.url)), '--build-only'], { cwd: root, encoding: 'utf8', env: isolatedEnvironment });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(fs.readFileSync(path.join(directory, 'record-status.json')));
  assert.equal(report.capture, 'failed'); assert.equal(report.build, 'passed');
  assert.equal(JSON.parse(fs.readFileSync(snapshotPath(root))).date, yesterday);
  assert.equal(fs.existsSync(path.join(directory, 'records', day + '.json')), false);
});
