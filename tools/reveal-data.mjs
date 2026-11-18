export function validateReveal(data, expectedDate) {
  if (!data || data.date !== expectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !Number.isFinite(Date.parse(data.date)) || new Date(data.date).toISOString().slice(0, 10) !== data.date) throw new Error('Reveal date does not match requested date');
  if (!Array.isArray(data.prompts) || data.prompts.length !== 7) throw new Error('Reveal must contain seven complete prompts');
  const ids = new Set();
  return data.prompts.map(prompt => {
    if (!prompt || typeof prompt.id !== 'string' || ids.has(prompt.id) || typeof prompt.text !== 'string' || !prompt.text.trim() || !Array.isArray(prompt.answers) || !prompt.answers.length) throw new Error('Invalid or duplicate prompt');
    ids.add(prompt.id);
    const answers = new Map();
    for (const row of prompt.answers) {
      if (typeof row.answer !== 'string' || !row.answer.trim() || typeof row.tier !== 'string' || !row.tier || ![10, 15, 30, 60, 85, 100].includes(row.score) || (row.aliases !== undefined && (!Array.isArray(row.aliases) || row.aliases.some(a => typeof a !== 'string')))) throw new Error('Invalid answer or score in ' + prompt.id);
      const scores = { krillion: 100, deepcut: 85, deep_cut: 85, rare: 60, schooler: 30, tooclever: 15, too_clever: 15, 'too-clever': 15, plankton: 10 };
      if (scores[row.tier] !== row.score) throw new Error('Unknown tier or mismatched tier score in ' + prompt.id);
      const key = row.answer.trim();
      const previous = answers.get(key);
      if (previous && (previous.score !== row.score || previous.tier !== row.tier)) throw new Error('Conflicting duplicate answer in ' + prompt.id);
      answers.set(key, { answer: key, aliases: [...new Set([...(previous?.aliases || []), ...(row.aliases || [])])], tier: row.tier, score: row.score });
    }
    return { id: prompt.id, text: prompt.text.trim(), answers: [...answers.values()] };
  });
}
