import { installCopy } from './copy-tools.mjs';
import { indexAnswers, findAnswers } from './search-core.mjs';
import { appendAnswerRows } from './answer-ui.mjs';

(() => {
  installCopy();
  const day = document.body.dataset.day;
  const storageKey = 'krillion_design_official_reviewed_' + day;
  let reviewed = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) reviewed = new Set(saved.filter(n => /^[1-7]$/.test(String(n))).map(String));
  } catch { /* Preview remains usable with blocked storage. */ }
  const reviewButtons = [...document.querySelectorAll('[data-review]')];
  function paintReviews() {
    for (const button of reviewButtons) {
      const active = reviewed.has(button.dataset.review);
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', `${active ? 'Unmark' : 'Mark'} prompt ${button.dataset.review} as reviewed`);
      button.closest('.prompt-card').classList.toggle('is-reviewed', active);
    }
    document.querySelector('#review-count').textContent = `${reviewed.size} of 7 reviewed`;
    document.querySelectorAll('.review-dots i').forEach((dot, i) => dot.classList.toggle('is-reviewed', reviewed.has(String(i + 1))));
  }
  for (const button of reviewButtons) button.addEventListener('click', () => {
    const id = button.dataset.review;
    if (reviewed.has(id)) reviewed.delete(id); else reviewed.add(id);
    try { localStorage.setItem(storageKey, JSON.stringify([...reviewed])); } catch { /* Keep in memory. */ }
    paintReviews();
  });
  paintReviews();
  const hintKey = 'krillion_design_official_hints_' + day;
  const details = [...document.querySelectorAll('.hint-stack details')];
  try {
    const opened = JSON.parse(localStorage.getItem(hintKey) || '[]');
    if (Array.isArray(opened)) for (const i of opened) if (Number.isInteger(i) && details[i]) details[i].open = true;
  } catch { /* Hints work without persistence. */ }
  details.forEach(detail => detail.addEventListener('toggle', () => {
    try { localStorage.setItem(hintKey, JSON.stringify(details.flatMap((node, i) => node.open ? [i] : []))); } catch { /* Keep the current choice. */ }
  }));
  for (const link of document.querySelectorAll('[data-dialog]')) link.addEventListener('click', event => {
    const dialog = document.getElementById(link.dataset.dialog);
    if (typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    dialog.showModal();
    document.documentElement.classList.add('dialog-open');
  });
  let snapshotPromise;
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('close', () => document.documentElement.classList.remove('dialog-open'));
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    } });
    let fullList, matches;
    let request = 0;
    const filterForm = dialog.querySelector('[data-list-search]');
    const loadMore = dialog.querySelector('[data-load-more]');
    async function renderList(reset) {
      const token = ++request;
      const options = { query: filterForm.elements.q.value, score: filterForm.elements.score.value };
      const message = dialog.querySelector('[data-list-message]');
      if (loadMore) { loadMore.disabled = true; loadMore.setAttribute('aria-busy', 'true'); loadMore.textContent = 'Loading…'; }
      message.textContent = '';
      try {
        if (!fullList) {
          snapshotPromise ||= fetch(new URL(document.body.dataset.snapshot, location.href)).then(response => {
            if (!response.ok) throw new Error('Snapshot unavailable');
            return response.json();
          }).then(snapshot => { if (snapshot.date !== day) throw new Error('Snapshot date changed'); return snapshot; }).catch(error => { snapshotPromise = null; throw error; });
          const snapshot = await snapshotPromise;
          const prompt = snapshot.prompts.find(p => p.id === dialog.dataset.promptId);
          if (!prompt) throw new Error('Prompt unavailable');
          fullList = indexAnswers({ prompts: [prompt] });
        }
        if (token !== request) return;
        const list = dialog.querySelector('.answer-list');
        if (!matches && (options.query || options.score)) reset = true;
        if (reset || !matches) matches = findAnswers(fullList, options);
        if (reset) list.replaceChildren();
        const offset = list.children.length;
        appendAnswerRows(list, matches.slice(offset, offset + 50));
        dialog.querySelector('[data-list-count]').textContent = `Showing ${list.children.length.toLocaleString('en-US')} of ${matches.length.toLocaleString('en-US')} matches`;
        if (!matches.length) message.textContent = 'No recorded match for these filters. Try another spelling or clear the rarity tier. This does not prove the live game rejects the answer.';
        if (loadMore) loadMore.hidden = list.children.length >= matches.length;
      } catch {
        if (token !== request) return;
        message.textContent = 'The recorded list could not be loaded. The answers above are still available. Try again.';
      } finally {
        if (token === request && loadMore) { loadMore.disabled = false; loadMore.removeAttribute('aria-busy'); loadMore.textContent = 'Show 50 more ↓'; }
      }
    }
    loadMore?.addEventListener('click', () => renderList(false));
    filterForm.addEventListener('submit', event => { event.preventDefault(); renderList(true); });
    filterForm.elements.score.addEventListener('change', () => renderList(true));
    filterForm.addEventListener('reset', () => setTimeout(() => renderList(true), 0));
  }
  const easternDay = time => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(time));
  const now = Date.now(), initialDay = easternDay(now);
  if (initialDay !== day && document.body.dataset.archive !== 'true') {
    document.title = document.title.replace('Krillion Answers Today', 'Latest Recorded Krillion Answers');
    const heading = document.getElementById('page-title');
    if (heading) heading.textContent = heading.textContent.replace('Krillion Answers Today', 'Latest Recorded Krillion Answers');
    document.querySelector('.status-availability .micro').textContent = 'Latest complete recorded reveal';
    document.querySelector('.status-availability strong').textContent = 'New reveal pending · previous edition shown';
  }
  let low = now, high = now + 27 * 3600000;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (easternDay(mid) === initialDay) low = mid; else high = mid;
  }
  const unlockAt = high;
  let countdownTimer;
  function tick() {
    const remaining = Math.max(0, Math.ceil((unlockAt - Date.now()) / 1000));
    const node = document.querySelector('#countdown');
    if (!remaining) {
      node.textContent = 'A new day has started';
      node.nextElementSibling.textContent = 'Refresh to check the latest available edition.';
      clearInterval(countdownTimer);
      return;
    }
    node.textContent = [Math.floor(remaining / 3600), Math.floor(remaining / 60) % 60, remaining % 60]
      .map(n => String(n).padStart(2, '0')).join(' : ');
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
})();
