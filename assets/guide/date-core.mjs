export function easternDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}

export function nextEasternMidnight(now = Date.now()) {
  let low = Number(new Date(now)), high = low + 27 * 3600000;
  const day = easternDate(low);
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (easternDate(middle) === day) low = middle; else high = middle;
  }
  return high;
}
