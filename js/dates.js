export const TZ = 'America/New_York';

export function dayAt(date = new Date(), tz = TZ) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).map(p => [p.type, p.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export function shiftDay(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

export function validDay(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && shiftDay(key, 0) === key;
}

// Search real instants so both 23-hour and 25-hour DST days work.
export function nextReset(now = new Date(), tz = TZ) {
  const day = dayAt(now, tz);
  let lo = now.getTime(), hi = lo + 27 * 3600000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (dayAt(new Date(mid), tz) === day) lo = mid;
    else hi = mid;
  }
  return hi;
}
