export const tierLabel = value => ({ krillion: 'One in a Krillion', deepcut: 'Deep Cut', deep_cut: 'Deep Cut', rare: 'Rare', schooler: 'Schooler', tooclever: 'Too Clever', too_clever: 'Too Clever', 'too-clever': 'Too Clever', plankton: 'Plankton' }[value] || value.replaceAll('_', ' '));

export function normalize(value) {
  return String(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function indexAnswers(snapshot) {
  return snapshot.prompts.flatMap((prompt, i) => prompt.answers.map(answer => ({
    ...answer, promptId: prompt.id, promptNumber: i + 1, promptText: prompt.text,
    normalized: normalize(answer.answer), normalizedAliases: answer.aliases.map(normalize)
  })));
}

export function findAnswers(index, { query = '', prompt = '', score = '', sort = 'score' } = {}) {
  const q = normalize(query);
  return index.filter(row => (!prompt || row.promptId === prompt) &&
    (score === '' || row.score === Number(score)) &&
    (!q || row.normalized.includes(q) || row.normalizedAliases.some(alias => alias.includes(q))))
    .map(row => ({ ...row, aliasMatch: !!q && !row.normalized.includes(q), exact: !!q && (row.normalized === q || row.normalizedAliases.includes(q)) }))
    .sort((a, b) => Number(b.exact) - Number(a.exact) || (sort === 'alphabetical'
      ? a.answer.localeCompare(b.answer, 'en') || b.score - a.score
      : b.score - a.score || a.answer.localeCompare(b.answer, 'en')));
}

export function findPrompts(editions, query = '', date = '') {
  const q = normalize(query);
  return editions.filter(edition => !date || edition.date === date).flatMap(edition => edition.prompts
    .filter(prompt => !q || normalize(prompt.text).includes(q))
    .map(prompt => ({ ...prompt, date: edition.date, label: edition.label, href: edition.href + '#prompt-' + (edition.prompts.indexOf(prompt) + 1) })));
}
