import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  addDays,
  dayOfWeek,
  diffDays,
  fromIso,
  nthWeekdayOfMonth,
  toIso,
  type LocalDate,
} from '../src/engine/dates.js';

describe('date helpers', () => {
  it('round-trips ISO strings', () => {
    expect(toIso(fromIso('2026-06-26'))).toBe('2026-06-26');
  });

  it('computes day of week (2026-06-26 is a Friday)', () => {
    expect(dayOfWeek({ year: 2026, month: 6, day: 26 })).toBe(5);
  });

  it('addDays crosses month and year boundaries', () => {
    expect(toIso(addDays({ year: 2025, month: 12, day: 31 }, 1))).toBe('2026-01-01');
    expect(toIso(addDays({ year: 2026, month: 3, day: 1 }, -1))).toBe('2026-02-28');
  });

  it('resolves nth weekday of month (Muttertag = 2nd Sunday in May)', () => {
    expect(toIso(nthWeekdayOfMonth(2026, 5, 0, 2)!)).toBe('2026-05-10');
  });

  it('resolves last weekday of month', () => {
    // Last Monday of May 2026.
    expect(toIso(nthWeekdayOfMonth(2026, 5, 1, -1)!)).toBe('2026-05-25');
  });

  it('returns null when the nth weekday overflows the month', () => {
    // There is no 5th Friday in February 2026.
    expect(nthWeekdayOfMonth(2026, 2, 5, 5)).toBeNull();
  });

  it('property: addDays and diffDays are inverse', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1900, max: 2100 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: -1000, max: 1000 }),
        (year, month, day, delta) => {
          const base: LocalDate = { year, month, day };
          expect(diffDays(addDays(base, delta), base)).toBe(delta);
        },
      ),
    );
  });
});
