import { installCopy } from './copy-tools.mjs';

installCopy();
const view = document.body.dataset.view;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

if (view === 'hints') {
  const key = 'fieldnotes_hint_trail_' + document.body.dataset.day;
  const items = [...document.querySelectorAll('.hint-only-card details')];
  try { const saved = JSON.parse(localStorage.getItem(key) || '[]'); if (Array.isArray(saved)) saved.forEach(i => { if (Number.isInteger(i) && items[i]) items[i].open = true; }); } catch { /* Hints remain usable. */ }
  items.forEach(item => item.addEventListener('toggle', () => {
    try { localStorage.setItem(key, JSON.stringify(items.flatMap((node, i) => node.open ? [i] : []))); } catch { /* Keep the current selection. */ }
  }));
}

if (view === 'missing-answer') {
  const boxes = [...document.querySelectorAll('.answer-checklist input')];
  const key = 'fieldnotes_answer_check_' + document.body.dataset.day;
  try { const saved = JSON.parse(localStorage.getItem(key) || '[]'); if (Array.isArray(saved)) boxes.forEach((box, i) => { box.checked = saved[i] === true; }); } catch { /* Checklist still works. */ }
  boxes.forEach(box => box.addEventListener('change', () => { try { localStorage.setItem(key, JSON.stringify(boxes.map(node => node.checked))); } catch { /* Keep in memory. */ } }));
}

if (view === 'scoring') {
  const form = document.getElementById('score-planner');
  form.addEventListener('submit', event => event.preventDefault());
  const update = () => {
    const allowed = new Set([0, 10, 15, 30, 60, 85, 100]);
    const scores = [...form.querySelectorAll('select')].map(input => Number(input.value));
    const total = scores.reduce((sum, score) => sum + (allowed.has(score) ? score : 0), 0);
    document.getElementById('planned-score').textContent = total + ' / 700 points';
  };
  form.addEventListener('change', update); form.addEventListener('reset', () => setTimeout(update, 0)); update();
}

if (view === 'status') {
  const examples = {
    ready: ['Seven prompts, ready when you are.', 'The displayed edition is dated and checked. Open only as much help as you want.'],
    waiting: ['A new reveal is still being checked.', 'The previous complete edition keeps its real date. A reset clock does not guarantee that new answers are available.'],
    failed: ['We could not record the new reveal.', 'The last complete edition is still available. Check its date before comparing it with your live game.'],
    publishing: ['A snapshot is safe. Publication is still pending.', 'The saved record can be used to rebuild without requesting the official answers again. The live site may still show the previous edition.']
  };
  document.getElementById('status-scenario').addEventListener('change', event => {
    const [title, copy] = examples[event.target.value] || examples.ready;
    const panel = document.getElementById('reader-state'); panel.dataset.state = event.target.value;
    panel.querySelector('h3').textContent = title; panel.querySelector('p').textContent = copy;
  });
  fetch('./record-status.json').then(response => response.ok ? response.json() : null).then(report => {
    if (!report) return;
    const labels = { saved: 'Saved', 'already-recorded': 'Already recorded · no new request', passed: 'Passed', 'local-check-passed': 'Local HTTP check passed · production not verified', running: 'In progress', failed: 'Failed · previous edition retained', 'not-passed': 'Not passed', 'not-run': 'Not run', 'not-configured': 'Not configured', pending: 'Pending' };
    document.querySelectorAll('[data-stage]').forEach(node => { const value = report[node.dataset.stage]; node.textContent = labels[value] || 'Status unavailable'; node.dataset.result = value || 'unknown'; });
    document.getElementById('record-run-status').textContent = `Last run: ${report.runAt || 'unknown'} · Target game date: ${report.targetDate || 'unknown'}. Scheduled capture: ${report.schedule === 'enabled' ? 'enabled in this Actions run' : 'not confirmed by this local run'}. External alerts: ${report.notification === 'configured' ? 'configured' : 'not configured; GitHub failure emails depend on account settings'}.`;
  }).catch(() => { document.getElementById('record-run-status').textContent = 'The last run report could not be loaded. The recorded edition above is still available. Scheduling and external alerts are not confirmed.'; });
}

