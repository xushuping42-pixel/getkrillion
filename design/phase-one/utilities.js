import { indexAnswers, findAnswers, findPrompts, normalize } from './search-core.mjs';
import { appendAnswerRows } from './answer-ui.mjs';
import { installCopy } from './copy-tools.mjs';
installCopy();
const editions = JSON.parse(document.getElementById('edition-data').textContent);
const format = n => n.toLocaleString('en-US');
const resolveLink = file => new URL(file, location.href).href;

if (document.body.dataset.view === 'archive') {
  const date = document.getElementById('archive-date'), query = document.getElementById('archive-query');
  const cards = [...document.querySelectorAll('.archive-card')];
  const apply = () => {
    const q = normalize(query.value);
    cards.forEach(card => { card.hidden = !!date.value && card.dataset.date !== date.value || !!q && !normalize(card.dataset.questions).includes(q); });
    let visible = 0;
    document.querySelectorAll('.archive-month').forEach(month => { month.hidden = ![...month.querySelectorAll('.archive-card')].some(card => !card.hidden); });
    visible = cards.filter(card => !card.hidden).length;
    document.getElementById('archive-count').textContent = `${visible} recorded ${visible === 1 ? 'edition' : 'editions'} shown · Only dates we actually hold.`;
    document.getElementById('archive-empty').hidden = visible !== 0;
  };
  date.addEventListener('change', apply); query.addEventListener('input', apply);
  document.getElementById('archive-reset').addEventListener('click', () => { date.value = ''; query.value = ''; apply(); });
}

if (document.body.dataset.view === 'search') {
  const form = document.getElementById('finder-form'), list = document.getElementById('finder-list');
  const empty = document.getElementById('result-empty'), more = document.getElementById('finder-more');
  const title = document.getElementById('result-title'), summary = document.getElementById('result-summary');
  const count = document.getElementById('finder-count'), results = document.querySelector('.finder-results');
  const snapshotCache = new Map();
  let request = 0, matches = [], shown = 0, mode = 'answers', edition;
  const currentMode = () => form.elements.mode.value;
  const currentEdition = () => editions.find(e => e.date === form.elements.date.value) || (form.elements.date.value ? null : editions[0]);
  function updatePrompts() {
    const selected = form.elements.prompt.value, e = currentEdition();
    form.elements.prompt.replaceChildren(new Option('All seven prompts', ''));
    if (e) e.prompts.forEach((p, i) => form.elements.prompt.add(new Option(`${i + 1}. ${p.text}`, p.id)));
    if (e?.prompts.some(p => p.id === selected)) form.elements.prompt.value = selected;
  }
  function setEmpty(heading, message) {
    empty.hidden = false; empty.querySelector('h3').textContent = heading; empty.querySelector('p').textContent = message;
  }
  function showNext() {
    const batch = matches.slice(shown, shown + 50);
    if (mode === 'answers') appendAnswerRows(list, batch, { date: edition.date, href: resolveLink(edition.href) });
    else for (const prompt of batch) {
      const row = document.createElement('li'); row.className = 'question-result';
      const link = document.createElement('a'); link.href = resolveLink(prompt.href); link.textContent = prompt.text;
      const meta = document.createElement('small'); meta.textContent = prompt.label + ' · ' + format(prompt.count) + ' recorded answers';
      row.append(link, meta); list.appendChild(row);
    }
    shown += batch.length;
    count.textContent = matches.length ? `Showing ${format(shown)} of ${format(matches.length)}` : '';
    more.hidden = shown >= matches.length;
  }
  async function search(updateURL = true) {
    const token = ++request;
    mode = currentMode(); edition = currentEdition();
    const q = form.elements.q.value.trim();
    const selectedEdition = edition;
    const options = { query: q, prompt: form.elements.prompt.value, score: form.elements.score.value, sort: form.elements.sort.value };
    if (updateURL) {
      const params = new URLSearchParams();
      for (const [key, value] of new FormData(form)) if (value && !(key === 'mode' && value === 'answers') && !(key === 'sort' && value === 'score')) params.set(key, value);
      history.replaceState(null, '', location.pathname + (params.size ? '?' + params : ''));
    }
    list.replaceChildren(); more.hidden = true; count.textContent = ''; shown = 0;
    empty.hidden = true; results.setAttribute('aria-busy', 'true');
    summary.textContent = 'Looking through the recorded answers…';
    try {
      if (!edition) throw new Error('unrecorded-date');
      if (mode === 'questions') {
        matches = findPrompts(editions, q, form.elements.date.value);
      } else {
        if (!snapshotCache.has(edition.file)) snapshotCache.set(edition.file, fetch(resolveLink(edition.file)).then(r => {
          if (!r.ok) throw new Error('unavailable'); return r.json();
        }).then(s => { if (s.date !== selectedEdition.date) throw new Error('date-mismatch'); return indexAnswers(s); }).catch(error => { snapshotCache.delete(selectedEdition.file); throw error; }));
        const index = await snapshotCache.get(edition.file);
        if (token !== request) return;
        matches = findAnswers(index, options);
      }
      if (token !== request) return;
      title.textContent = matches.length ? 'A few things worth finding.' : 'Not in this record.';
      summary.textContent = `${format(matches.length)} ${mode === 'answers' ? 'answer' : 'question'} ${matches.length === 1 ? 'match' : 'matches'}${mode === 'answers' ? ' · ' + edition.label : ' across recorded dates'}`;
      if (!matches.length) setEmpty('Nothing recorded for that combination.', 'Try a shorter phrase, another spelling, or clear the rarity filter. A missing result does not prove the live game rejects it.');
      else showNext();
    } catch (error) {
      if (token !== request) return;
      title.textContent = 'A small pause in the search.';
      summary.textContent = error.message === 'unrecorded-date' ? 'That date is not in our local archive.' : 'The recorded data could not be loaded.';
      setEmpty('Your question is still a good one.', 'Choose an available date or try searching again. We won’t replace a missing edition with answers from a different day.');
    } finally { if (token === request) results.setAttribute('aria-busy', 'false'); }
  }
  function updateMode() {
    const questions = currentMode() === 'questions';
    for (const name of ['prompt', 'score', 'sort']) form.elements[name].disabled = questions;
    document.getElementById('search-scope').textContent = questions ? 'Question wording is searched across all recorded dates. Choose a date to narrow the search.' : 'Answers and aliases are searched within the selected recorded date. Scores belong to that exact prompt.';
  }
  form.addEventListener('submit', event => { event.preventDefault(); search(); });
  form.elements.date.addEventListener('change', updatePrompts);
  form.querySelectorAll('[name=mode]').forEach(radio => radio.addEventListener('change', updateMode));
  form.addEventListener('reset', () => { request++; setTimeout(() => {
    updatePrompts(); updateMode(); list.replaceChildren(); more.hidden = true; count.textContent = ''; matches = []; shown = 0;
    results.setAttribute('aria-busy', 'false'); title.textContent = 'A good place to start.'; summary.textContent = `${format(editions[0].answerCount)} answers in the latest recorded edition.`;
    setEmpty('Your next discovery starts here.', 'Type an answer or choose a rarity tier, then search. Answers stay out of sight until you ask.');
    history.replaceState(null, '', location.pathname);
  }, 0); });
  more.addEventListener('click', showNext);
  document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => { form.elements.q.value = button.dataset.example; search(); }));
  const params = new URLSearchParams(location.search);
  for (const name of ['q', 'date', 'score', 'sort']) if (params.has(name)) {
    const value = params.get(name);
    if (name === 'date' && value && !editions.some(e => e.date === value)) form.elements.date.add(new Option(value + ' · not recorded', value));
    form.elements[name].value = value;
  }
  if (params.get('mode') === 'questions') form.querySelector('[value=questions]').checked = true;
  updatePrompts();
  if (params.has('prompt')) form.elements.prompt.value = params.get('prompt');
  updateMode(); if (params.size) search(false);
}
