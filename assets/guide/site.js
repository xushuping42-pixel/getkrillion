const track = (name, params = {}) => {
  if (typeof window.gtag === 'function') window.gtag('event', name, { day: document.body.dataset.day || '', ...params });
};
document.addEventListener('click', event => {
  const copy = event.target.closest('[data-copy]');
  if (copy) track('answer_copy');
  const link = event.target.closest('a');
  if (link?.href.startsWith('https://krillion.io/')) track('official_game_open');
});
document.addEventListener('toggle', event => {
  if (event.target.tagName !== 'DETAILS' || !event.target.open) return;
  const index = event.target.closest('.prompt-card')?.id.replace('prompt-', '');
  track(event.target.classList.contains('reveal') ? 'answer_reveal' : 'hint_open', index ? { prompt_index: Number(index) } : {});
}, true);
document.addEventListener('submit', event => {
  if (event.target.matches('#finder-form, #question-search, [data-list-search]')) track('answer_search');
});
