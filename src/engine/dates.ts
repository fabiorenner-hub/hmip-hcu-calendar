/**
 * Pure, timezone-free calendar date helpers used by the engine.
 *
 * A {@link LocalDate} is a plain year/month/day triple. All arithmetic is done
 * via UTC epoch math so it is fully deterministic and side-effect free; no
 * timezone or locale is involved. The adapter layer is responsible for turning
 * a wall-clock instant in a configured timezone into a LocalDate.
 */
export interface LocalDate {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
}

/** Convert a LocalDate to a UTC-midnight epoch millisecond value. */
export function toEpoch(d: LocalDate): number {
  return Date.UTC(d.year, d.month - 1, d.day);
}

/** Convert a UTC-midnight epoch back into a LocalDate. */
export function fromEpoch(ms: number): LocalDate {
  const dt = new Date(ms);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

/** Day of week: 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(d: LocalDate): number {
  return new Date(toEpoch(d)).getUTCDay();
}

/** Add (or subtract) a number of days, normalising month/year overflow. */
export function addDays(d: LocalDate, days: number): LocalDate {
  return fromEpoch(toEpoch(d) + days * 86_400_000);
}

/** Whole-day difference a - b (positive when a is after b). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((toEpoch(a) - toEpoch(b)) / 86_400_000);
}

export function isSameDate(a: LocalDate, b: LocalDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Inclusive range check. */
export function isWithin(d: LocalDate, from: LocalDate, to: LocalDate): boolean {
  const t = toEpoch(d);
  const lo = Math.min(toEpoch(from), toEpoch(to));
  const hi = Math.max(toEpoch(from), toEpoch(to));
  return t >= lo && t <= hi;
}

export function toIso(d: LocalDate): string {
  const mm = String(d.month).padStart(2, '0');
  const dd = String(d.day).padStart(2, '0');
  return `${d.year}-${mm}-${dd}`;
}

/** Parse a strict YYYY-MM-DD string. Throws on malformed input. */
export function fromIso(iso: string): LocalDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`invalid ISO date: ${iso}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`out-of-range ISO date: ${iso}`);
  }
  return { year, month, day };
}

/**
 * Resolve the nth weekday of a month. weekday: 0=Sun..6=Sat. n: 1..5 counts
 * from the start, n=-1 means the last such weekday in the month.
 */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number,
): LocalDate | null {
  if (n === -1) {
    // Walk back from the last day of the month.
    const lastDay = fromEpoch(toEpoch({ year, month: month + 1, day: 1 }) - 86_400_000);
    let cursor = lastDay;
    while (dayOfWeek(cursor) !== weekday) {
      cursor = addDays(cursor, -1);
    }
    return cursor;
  }
  const first: LocalDate = { year, month, day: 1 };
  const firstDow = dayOfWeek(first);
  const offset = (weekday - firstDow + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  const candidate = addDays(first, offset + (n - 1) * 7);
  // Guard against overflowing into the following month (e.g. 5th Monday).
  if (candidate.month !== month) return null;
  void day;
  return candidate;
}
