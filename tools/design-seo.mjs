export function editionSeo(day, today, { home = false } = {}) {
  for (const date of [day, today]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Invalid edition calendar date');
  }
  if (day > today) throw new Error('Cannot label a future edition');
  const label = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z'));
  const heading = home ? (day === today ? 'Krillion Answers Today' : 'Latest Recorded Krillion Answers') : 'Krillion Answers';
  return {
    title: home ? `${heading} — ${label}: Hints & Rare Answers` : `Krillion Answers for ${label} — All 7 Prompts`,
    heading: `${home ? heading : 'Krillion Answers for'}${home ? ' — ' : ' '}${label}`,
    label,
    current: day === today
  };
}

export function hintSeo(day, today) {
  const edition = editionSeo(day, today);
  const heading = edition.current ? 'Krillion Hints Today' : 'Latest Recorded Krillion Hints';
  return { title: `${heading} — ${edition.label}`, heading: `${heading} — ${edition.label}` };
}
