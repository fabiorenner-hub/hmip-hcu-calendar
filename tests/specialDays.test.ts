import { describe, expect, it } from 'vitest';
import type { Calendar, SpecialDayRule } from '../src/shared/config.js';
import { bridgeDays, evaluateCalendar, matchRule } from '../src/engine/specialDays.js';
import { fromIso } from '../src/engine/dates.js';

function cal(partial: Partial<Calendar> & Pick<Calendar, 'rules'>): Calendar {
  return {
    id: '00000000-0000-4000-8000-000000000000',
    enabled: true,
    nameDe: 'Test',
    nameEn: 'Test',
    invert: false,
    leadDays: 0,
    trailDays: 0,
    ...partial,
  };
}

describe('matchRule', () => {
  it('matches weekends', () => {
    const rule: SpecialDayRule = { kind: 'weekend' };
    expect(matchRule(rule, fromIso('2026-06-27'))).not.toBeNull(); // Saturday
    expect(matchRule(rule, fromIso('2026-06-26'))).toBeNull(); // Friday
  });

  it('matches specific weekdays', () => {
    const rule: SpecialDayRule = { kind: 'weekday', weekdays: [1] }; // Monday
    expect(matchRule(rule, fromIso('2026-06-29'))).not.toBeNull();
    expect(matchRule(rule, fromIso('2026-06-30'))).toBeNull();
  });

  it('matches recurring annual dates', () => {
    const rule: SpecialDayRule = { kind: 'fixedDate', month: 12, day: 24 };
    expect(matchRule(rule, fromIso('2026-12-24'))).not.toBeNull();
    expect(matchRule(rule, fromIso('2027-12-24'))).not.toBeNull();
    expect(matchRule(rule, fromIso('2026-12-25'))).toBeNull();
  });

  it('matches single dates and ranges', () => {
    expect(matchRule({ kind: 'singleDate', date: '2026-07-01' }, fromIso('2026-07-01'))).not.toBeNull();
    const range: SpecialDayRule = { kind: 'dateRange', from: '2026-07-01', to: '2026-07-14' };
    expect(matchRule(range, fromIso('2026-07-10'))).not.toBeNull();
    expect(matchRule(range, fromIso('2026-07-15'))).toBeNull();
  });

  it('matches nth weekday of month (Muttertag)', () => {
    const rule: SpecialDayRule = { kind: 'nthWeekdayOfMonth', month: 5, weekday: 0, n: 2 };
    expect(matchRule(rule, fromIso('2026-05-10'))).not.toBeNull();
    expect(matchRule(rule, fromIso('2026-05-17'))).toBeNull();
  });

  it('matches a day relative to Easter', () => {
    // Rosenmontag = Easter - 48. Easter 2026 = Apr 5 -> Feb 16.
    const rule: SpecialDayRule = { kind: 'relativeToEaster', offset: -48 };
    expect(matchRule(rule, fromIso('2026-02-16'))).not.toBeNull();
  });

  it('matches German holidays for selected states', () => {
    const rule: SpecialDayRule = { kind: 'germanHolidays', states: ['BW'] };
    expect(matchRule(rule, fromIso('2026-01-06'))).not.toBeNull(); // Epiphany in BW
    const nationwide: SpecialDayRule = { kind: 'germanHolidays', states: [] };
    expect(matchRule(nationwide, fromIso('2026-01-06'))).toBeNull(); // not nationwide
    expect(matchRule(nationwide, fromIso('2026-01-01'))).not.toBeNull();
  });
});

describe('bridge days', () => {
  it('puts a bridge day after a Thursday holiday', () => {
    // Christi Himmelfahrt 2026 = Thu May 14 -> Friday May 15 is a bridge day.
    const days = bridgeDays(2026, []).map((d) => `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`);
    expect(days).toContain('2026-05-15');
  });
});

describe('evaluateCalendar', () => {
  it('turns on for a matching day and off otherwise', () => {
    const c = cal({ rules: [{ kind: 'weekend' }] });
    expect(evaluateCalendar(c, fromIso('2026-06-27')).on).toBe(true);
    expect(evaluateCalendar(c, fromIso('2026-06-26')).on).toBe(false);
  });

  it('honours lead days (eve of a holiday)', () => {
    const c = cal({ rules: [{ kind: 'fixedDate', month: 12, day: 25 }], leadDays: 1 });
    const eve = evaluateCalendar(c, fromIso('2026-12-24'));
    expect(eve.on).toBe(true);
    expect(eve.source).toBe('lead');
  });

  it('honours trail days', () => {
    const c = cal({ rules: [{ kind: 'fixedDate', month: 12, day: 25 }], trailDays: 1 });
    const after = evaluateCalendar(c, fromIso('2026-12-26'));
    expect(after.on).toBe(true);
    expect(after.source).toBe('trail');
  });

  it('inverts the result when requested', () => {
    const c = cal({ rules: [{ kind: 'weekend' }], invert: true });
    expect(evaluateCalendar(c, fromIso('2026-06-26')).on).toBe(true); // Friday -> on (not weekend)
    expect(evaluateCalendar(c, fromIso('2026-06-27')).on).toBe(false); // Saturday -> off
  });

  it('lets an active override win', () => {
    const c = cal({ rules: [{ kind: 'weekend' }], override: { on: true } });
    const r = evaluateCalendar(c, fromIso('2026-06-26'));
    expect(r.on).toBe(true);
    expect(r.source).toBe('override');
  });

  it('drops an override after its until date', () => {
    const c = cal({ rules: [{ kind: 'weekend' }], override: { on: true, until: '2026-06-25' } });
    // Friday after the override expired -> falls back to rules (no weekend).
    expect(evaluateCalendar(c, fromIso('2026-06-26')).on).toBe(false);
  });
});
