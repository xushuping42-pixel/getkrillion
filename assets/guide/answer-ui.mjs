import { tierLabel } from './search-core.mjs';

export function appendAnswerRows(list, rows, { date = '', href = '' } = {}) {
  const fragment = document.createDocumentFragment();
  for (const answer of rows) {
    const row = document.createElement('li');
    const score = document.createElement('span'); score.className = 'list-rank'; score.textContent = String(answer.score);
    const points = document.createElement('small'); points.textContent = 'PTS'; score.appendChild(points);
    const label = document.createElement('div');
    const text = document.createElement('strong'); text.textContent = answer.answer;
    const tier = document.createElement('small'); tier.textContent = tierLabel(answer.tier) + (answer.aliasMatch ? ' · Matched an alternative spelling' : '');
    label.append(text, tier);
    if (answer.aliases?.length) { const aliases = document.createElement('small'); aliases.textContent = 'Also recorded as ' + answer.aliases.join(', '); label.appendChild(aliases); }
    if (answer.promptText && date) {
      const context = document.createElement('a'); context.className = 'result-context';
      context.href = href + '#prompt-' + answer.promptNumber; context.textContent = date + ' · ' + answer.promptText; label.appendChild(context);
    }
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'copy-button'; copy.dataset.copy = answer.answer;
    copy.textContent = 'Copy'; copy.setAttribute('aria-label', 'Copy ' + answer.answer);
    row.append(score, label, copy); fragment.appendChild(row);
  }
  list.appendChild(fragment);
}
