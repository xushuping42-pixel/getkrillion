import fs from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const expected = JSON.parse(fs.readFileSync('release.json', 'utf8'));
const base = process.env.GUIDE_VERIFY_URL || 'https://getkrillion.xyz';
const local = ['127.0.0.1', 'localhost'].includes(new URL(base).hostname);
const limit = Date.now() + Number(process.env.GUIDE_VERIFY_TIMEOUT || 480000);
const reportFile = 'design/phase-one/record-status.json';
const report = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : {};
function save(state) { report.deployment = state; fs.writeFileSync(reportFile, JSON.stringify(report, null, 2)); }
const read = async path => {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000), headers: { 'Cache-Control': 'no-cache' } });
  return { response, text: await response.text() };
};
save('pending');
try {
  let ready = false;
  console.log(`Waiting for guide release ${expected.id} at ${base}`);
  do {
    try {
      const { response, text } = await read('/release.json?verify=' + expected.id);
      if (response.ok && JSON.parse(text).id === expected.id) { ready = true; break; }
    } catch { /* Allow the external Pages deployment to finish. */ }
    if (Date.now() < limit) await delay(Number(process.env.GUIDE_VERIFY_INTERVAL || 15000));
  } while (Date.now() < limit);
  if (!ready) throw new Error('Cloudflare did not publish the expected guide release before the verification deadline');
  for (const path of ['/', '/hints/', '/archive/', '/how-to-play/', '/scoring/', '/score-calculator/', '/why-answer-not-accepted/', `/answers/${expected.latestDate}/`, `/answers/${expected.latestDate}/prompt-1/`]) {
    const { response, text } = await read(path);
    if (!response.ok || /<meta name="robots" content="[^"]*noindex/.test(text) || response.headers.get('x-robots-tag')?.includes('noindex') || !text.includes(`rel="canonical" href="https://getkrillion.xyz${path}"`)) throw new Error('Indexable page verification failed: ' + path);
  }
  const { response, text } = await read('/sitemap.xml');
  const locs = [...text.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  if (!response.ok || locs.length !== expected.indexedPages || locs.some(loc => /\/search\/|\/design\/|\/unlimited\//.test(loc))) throw new Error('Published sitemap does not match the release');
  const future = new Date(Date.parse(expected.latestDate + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  if ((await read(`/answers/${future}/`)).response.status !== 404) throw new Error('An unrecorded future edition is not returning 404');
  const search = await read('/search/?q=verification');
  if (!search.response.ok || !search.text.includes('noindex,follow')) throw new Error('Search result indexing guard is missing');
  save(local ? 'local-check-passed' : 'passed'); console.log(`Verified ${local ? 'local' : 'production'} release ${expected.id}: ${expected.indexedPages} indexable pages, dated answers, future 404 and search noindex.`);
} catch (error) { save('failed'); throw error; }
