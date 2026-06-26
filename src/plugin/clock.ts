import type { LocalDate } from '../engine/dates.js';

/**
 * Resolve the current wall-clock date in a given IANA timezone into a
 * timezone-free {@link LocalDate}. This is the impure boundary that converts
 * "now" into the value the pure engine consumes.
 */
export function localDateInTimezone(timezone: string, now: Date = new Date()): LocalDate {
  // en-CA formats as YYYY-MM-DD which is trivial to parse.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Milliseconds from `now` until the next local midnight in `timezone`. */
export function msUntilNextMidnight(timezone: string, now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  let h = get('hour');
  if (h === 24) h = 0; // some runtimes emit 24 at midnight
  const secondsIntoDay = h * 3600 + get('minute') * 60 + get('second');
  const remaining = 86_400 - secondsIntoDay;
  // Add a small guard so the timer fires just after midnight, never before.
  return remaining * 1000 + 1000;
}
