// Operator helper: reuse Git Credential Manager in memory; never print or save tokens.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const repository = 'xushuping42-pixel/getkrillion';
const command = process.argv[2] || 'status';
const credential = spawnSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\npath=' + repository + '.git\n\n', encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } });
const token = credential.stdout?.split(/\r?\n/).find(line => line.startsWith('password='))?.slice(9);
if (!token) throw new Error('No existing GitHub credential is available through Git Credential Manager');
const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
async function api(endpoint, options = {}) {
  const response = await fetch('https://api.github.com/repos/' + repository + endpoint, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`GitHub API returned HTTP ${response.status} for ${endpoint.split('?')[0]}`);
  return response.status === 204 ? null : response.json();
}
if (command === 'status') {
  const repo = await api('');
  const runs = await api('/actions/runs?per_page=4');
  const secrets = await api('/actions/secrets');
  const workflows = await api('/actions/workflows');
  const permissions = await api('/actions/permissions');
  console.log(JSON.stringify({ defaultBranch: repo.default_branch, private: repo.private, actions: permissions, workflows: workflows.workflows.map(w => ({ name: w.name, state: w.state, path: w.path })), wechatSecretPresent: secrets.secrets.some(s => s.name === 'WECHAT_WEBHOOK'), runs: runs.workflow_runs.map(r => ({ id: r.id, name: r.name, status: r.status, conclusion: r.conclusion, url: r.html_url, sha: r.head_sha })) }, null, 2));
} else if (command === 'dispatch') {
  await api('/actions/workflows/record-answers.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'main', inputs: { notification_test: process.argv.includes('--notification-test'), refresh_source: process.argv.includes('--refresh-source') } }) });
  console.log('Requested the official-answer workflow on main.');
} else if (command === 'run') {
  if (!/^\d+$/.test(process.argv[3] || '')) throw new Error('Supply a numeric run ID');
  const run = await api('/actions/runs/' + process.argv[3]);
  const jobs = await api('/actions/runs/' + process.argv[3] + '/jobs');
  console.log(JSON.stringify({ id: run.id, status: run.status, conclusion: run.conclusion, url: run.html_url, jobs: jobs.jobs.map(j => ({ name: j.name, status: j.status, conclusion: j.conclusion, steps: j.steps.map(s => ({ name: s.name, status: s.status, conclusion: s.conclusion })) })) }, null, 2));
} else if (command === 'logs') {
  if (!/^\d+$/.test(process.argv[3] || '')) throw new Error('Supply a numeric run ID');
  const jobs = await api('/actions/runs/' + process.argv[3] + '/jobs');
  for (const job of jobs.jobs.filter(j => j.conclusion === 'failure')) {
    const result = await fetch(`https://api.github.com/repos/${repository}/actions/jobs/${job.id}/logs`, { headers, signal: AbortSignal.timeout(30000) });
    if (!result.ok) throw new Error('GitHub job logs unavailable');
    const lines = (await result.text()).split('\n');
    const selected = new Set();
    lines.forEach((line, i) => { if (/not ok|AssertionError|ERR_ASSERTION|Error:|✖|error:/.test(line)) for (let n = Math.max(0, i - 2); n <= Math.min(lines.length - 1, i + 10); n++) selected.add(n); });
    console.log([...selected].sort((a, b) => a - b).map(i => lines[i]).join('\n').slice(0, 16000));
  }
} else if (command === 'secret') {
  console.log('Waiting for one secret value on stdin (not echoed or logged).');
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  const lines = createInterface({ input: process.stdin, terminal: false });
  const value = await new Promise(resolve => lines.once('line', line => { lines.close(); if (process.stdin.isTTY) process.stdin.setRawMode(false); process.stdin.pause(); resolve(line.trim()); }));
  const endpoint = new URL(value);
  if (endpoint.hostname !== 'qyapi.weixin.qq.com' || endpoint.protocol !== 'https:') throw new Error('Unexpected webhook service');
  const latest = await fetch('https://api.github.com/repos/cli/cli/releases/latest', { headers: { Accept: 'application/vnd.github+json' } }).then(r => r.json());
  const asset = latest.assets.find(a => /_windows_amd64\.zip$/.test(a.name));
  const checksums = latest.assets.find(a => /checksums\.txt$/.test(a.name));
  if (!asset || !checksums) throw new Error('Official GitHub CLI Windows release was not found');
  const directory = path.join(os.tmpdir(), 'krillion-gh-' + latest.tag_name.replace(/[^a-zA-Z0-9.-]/g, ''));
  fs.mkdirSync(directory, { recursive: true });
  const zip = path.join(directory, asset.name);
  const data = Buffer.from(await fetch(asset.browser_download_url).then(r => { if (!r.ok) throw new Error('GitHub CLI download failed'); return r.arrayBuffer(); }));
  const sum = createHash('sha256').update(data).digest('hex');
  const sums = await fetch(checksums.browser_download_url).then(r => r.text());
  if (!sums.split('\n').some(line => line.includes(asset.name) && line.startsWith(sum))) throw new Error('GitHub CLI checksum mismatch');
  fs.writeFileSync(zip, data);
  const unpack = spawnSync('C:\\Windows\\System32\\tar.exe', ['-xf', zip, '-C', directory], { encoding: 'utf8' });
  if (unpack.status !== 0) throw new Error('Could not unpack the official GitHub CLI');
  const find = (dir, depth = 0) => depth > 3 ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? find(path.join(dir, e.name), depth + 1) : e.name === 'gh.exe' ? [path.join(dir, e.name)] : []);
  const executable = find(directory)[0];
  if (!executable) throw new Error('GitHub CLI executable missing');
  const result = spawnSync(executable, ['secret', 'set', 'WECHAT_WEBHOOK', '--repo', repository], { input: value, encoding: 'utf8', env: { ...process.env, GH_TOKEN: token } });
  if (result.status !== 0) throw new Error('GitHub could not save the webhook Secret');
  console.log('WECHAT_WEBHOOK saved as a GitHub Actions Secret; its value was not written to the repository.');
} else throw new Error('Use status, run, dispatch, or secret');
