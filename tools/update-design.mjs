import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { recordReveal } from './record-reveal.mjs';
import { easternDate } from '../design/phase-one/date-core.mjs';

const directory = path.resolve('design/phase-one');
const mode = process.argv[2] || '--all';
if (!['--all', '--capture-only', '--build-only'].includes(mode)) throw new Error('Use --capture-only, --build-only, or no argument');
const statusFile = path.join(directory, 'record-status.json');
const report = { targetDate: easternDate(), runAt: new Date().toISOString(), capture: 'pending', validation: 'pending', build: 'not-run', deployment: 'not-configured', notification: 'not-configured', schedule: process.env.REVEAL_SCHEDULE === 'enabled' ? 'enabled' : 'not-enabled' };
if (process.env.REVEAL_NOTIFICATION_CONFIGURED === 'true') report.notification = 'configured';
if (mode === '--build-only' && fs.existsSync(statusFile)) {
  const previous = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
  if (previous.targetDate !== report.targetDate) throw new Error('Capture report belongs to a different Eastern date; start a new capture run');
  Object.assign(report, previous);
}
function save() {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'record-status.json');
  fs.writeFileSync(file + '.tmp', JSON.stringify(report, null, 2));
  fs.renameSync(file + '.tmp', file);
}
try {
  if (mode !== '--build-only') {
    const result = await recordReveal({ forceRefresh: process.env.REVEAL_REFRESH === 'true' });
    Object.assign(report, result); save();
  }
  if (mode !== '--capture-only') {
    report.build = 'running'; save();
    const builder = process.env.REVEAL_BUILD === 'production' ? 'tools/build-guide.mjs' : 'tools/build-design.mjs';
    const build = spawnSync(process.execPath, [builder], { cwd: process.cwd(), encoding: 'utf8' });
    if (build.status !== 0) { report.build = 'failed'; throw new Error('Guide build failed: ' + (build.stderr || build.error?.message || 'unknown build error')); }
    report.build = 'passed'; save(); process.stdout.write(build.stdout);
  }
  console.log(mode === '--capture-only' ? 'Validated snapshot saved; page build has not run.' : 'Guide built from recorded data. Deployment verification is a separate stage.');
} catch (error) {
  if (report.capture === 'pending') report.capture = 'failed';
  if (report.validation === 'pending') report.validation = 'not-passed';
  report.error = error.message;
  if (error.httpStatus) report.httpStatus = error.httpStatus;
  save(); console.error(error.message); process.exitCode = 1;
}
