import { installCopy } from './copy-tools.mjs';
import { indexAnswers, findAnswers } from './search-core.mjs';
import { appendAnswerRows } from './answer-ui.mjs';

installCopy();
const form = document.getElementById('question-search');
const list = document.getElementById('question-answers');
const more = document.getElementById('question-more');
const count = document.getElementById('question-count');
let promise, matches, request = 0;
async function show(reset) {
  const token = ++request;
  const options = { query: form.elements.q.value, score: form.elements.score.value };
  more.disabled = true;
  try {
    promise ||= fetch(new URL(document.body.dataset.snapshot, location.href)).then(r => {
      if (!r.ok) throw new Error('Data unavailable'); return r.json();
    }).then(snapshot => {
      if (snapshot.date !== document.body.dataset.day) throw new Error('Date mismatch');
      const prompt = snapshot.prompts.find(p => p.id === document.body.dataset.promptId);
      if (!prompt) throw new Error('Prompt missing'); return indexAnswers({ prompts: [prompt] });
    }).catch(error => { promise = null; throw error; });
    const index = await promise;
    if (token !== request) return;
    if (reset || !matches) matches = findAnswers(index, options);
    if (reset) list.replaceChildren();
    const offset = list.children.length;
    appendAnswerRows(list, matches.slice(offset, offset + 100));
    count.textContent = matches.length ? `Showing ${list.children.length.toLocaleString('en-US')} of ${matches.length.toLocaleString('en-US')} matches` : 'No match in this dated record. Try another spelling or clear the filters.';
    more.hidden = list.children.length >= matches.length;
  } catch {
    if (token === request) count.textContent = 'The full record could not be loaded. The answers already shown remain available; try again.';
  } finally { if (token === request) more.disabled = false; }
}
form.addEventListener('submit', event => { event.preventDefault(); show(true); });
form.elements.score.addEventListener('change', () => show(true));
form.addEventListener('reset', () => setTimeout(() => show(true), 0));
more.addEventListener('click', () => show(false));
