import fs from 'node:fs';
import path from 'node:path';
import { validateReveal } from './reveal-data.mjs';
import { easternDate } from '../design/phase-one/date-core.mjs';

function readSnapshot(file, day) {
  const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
  validateReveal(snapshot, day);
  if (snapshot.source !== 'https://krillion.io/api/reveal?date=' + day || !Number.isFinite(Date.parse(snapshot.fetchedAt))) throw new Error('Invalid snapshot provenance');
  return snapshot;
}

function atomicSnapshot(file, snapshot) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(snapshot));
  readSnapshot(temporary, snapshot.date);
  fs.renameSync(temporary, file);
}

export async function recordReveal({ root = process.cwd(), now = new Date(), date = easternDate(now), fetchImpl = fetch, forceRefresh = false } = {}) {
  const today = easternDate(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > today) throw new Error('Use an available Eastern calendar date');
  const directory = path.resolve(root, 'design/phase-one');
  const record = path.join(directory, 'records', date + '.json');
  const latest = path.join(directory, 'reveal-snapshot.json');
  let snapshot, current, selectedFile;
  if (fs.existsSync(latest)) {
    try { const day = JSON.parse(fs.readFileSync(latest, 'utf8')).date; current = readSnapshot(latest, day); }
    catch { /* A corrupt latest pointer must not hide a valid dated record. */ }
  }
  for (const file of forceRefresh ? [] : [record, ...(current?.date === date ? [latest] : [])]) {
    if (!fs.existsSync(file)) continue;
    try { snapshot = readSnapshot(file, date); selectedFile = file; break; } catch { /* Refetch a corrupt cache once. */ }
  }
  const cached = !!snapshot;
  if (!snapshot) {
    const source = 'https://krillion.io/api/reveal?date=' + date;
    let response;
    try { response = await fetchImpl(source, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } }); }
    catch (cause) { throw new Error('Official reveal request failed', { cause }); }
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      const error = new Error('Official reveal unavailable: HTTP ' + response.status); error.httpStatus = response.status; throw error;
    }
    const prompts = validateReveal(await response.json(), date);
    snapshot = { date, source, fetchedAt: new Date(now).toISOString(), prompts };
  }
  if (current && current.date !== date) {
    const previous = path.join(directory, 'records', current.date + '.json');
    if (!fs.existsSync(previous)) atomicSnapshot(previous, current);
  }
  if (selectedFile !== record || !cached) atomicSnapshot(record, snapshot);
  else readSnapshot(record, date);
  if (!current || date > current.date || (date === current.date && !cached)) atomicSnapshot(latest, snapshot);
  return { date, capture: cached ? 'already-recorded' : 'saved', validation: 'passed', fetchedAt: snapshot.fetchedAt, prompts: 7, answers: snapshot.prompts.reduce((sum, p) => sum + p.answers.length, 0) };
}
