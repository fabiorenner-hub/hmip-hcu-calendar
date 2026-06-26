import { describe, expect, it } from 'vitest';
import { easterSunday } from '../src/engine/easter.js';
import { germanHolidays, holidaysForStates } from '../src/engine/holidays.js';
import { toIso } from '../src/engine/dates.js';

describe('Easter', () => {
  it('matches known Easter Sundays', () => {
    expect(toIso(easterSunday(2025))).toBe('2025-04-20');
    expect(toIso(easterSunday(2026))).toBe('2026-04-05');
    expect(toIso(easterSunday(2027))).toBe('2027-03-28');
  });
});

describe('German holidays', () => {
  const find = (year: number, id: string) => germanHolidays(year).find((h) => h.id === id);

  it('has the nationwide holidays on fixed dates', () => {
    expect(toIso(find(2026, 'neujahr')!.date)).toBe('2026-01-01');
    expect(toIso(find(2026, 'tagDerArbeit')!.date)).toBe('2026-05-01');
    expect(toIso(find(2026, 'tagDerDeutschenEinheit')!.date)).toBe('2026-10-03');
    expect(toIso(find(2026, 'ersterWeihnachtstag')!.date)).toBe('2026-12-25');
  });

  it('computes Easter-derived holidays', () => {
    // Easter 2026 = Apr 5. Karfreitag -2, Ostermontag +1, Himmelfahrt +39.
    expect(toIso(find(2026, 'karfreitag')!.date)).toBe('2026-04-03');
    expect(toIso(find(2026, 'ostermontag')!.date)).toBe('2026-04-06');
    expect(toIso(find(2026, 'christiHimmelfahrt')!.date)).toBe('2026-05-14');
    expect(toIso(find(2026, 'fronleichnam')!.date)).toBe('2026-06-04');
  });

  it('marks nationwide holidays for all 16 states', () => {
    expect(find(2026, 'neujahr')!.nationwide).toBe(true);
    expect(find(2026, 'neujahr')!.states).toHaveLength(16);
  });

  it('restricts regional holidays to their states', () => {
    expect(find(2026, 'fronleichnam')!.states.sort()).toEqual(
      ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'].sort(),
    );
    expect(find(2026, 'allerheiligen')!.nationwide).toBe(false);
  });

  it('applies year conditions for Reformationstag (northern states from 2018)', () => {
    expect(find(2017, 'reformationstag')!.states).not.toContain('HH');
    expect(find(2018, 'reformationstag')!.states).toContain('HH');
  });

  it('applies year conditions for Frauentag', () => {
    expect(find(2018, 'frauentag')).toBeUndefined();
    expect(find(2019, 'frauentag')!.states).toEqual(['BE']);
    expect(find(2023, 'frauentag')!.states.sort()).toEqual(['BE', 'MV']);
  });

  it('computes Buß- und Bettag as the Wednesday before Nov 23', () => {
    // 2026: Nov 23 is a Monday, so Buß- und Bettag is Nov 18.
    expect(toIso(find(2026, 'bussUndBettag')!.date)).toBe('2026-11-18');
  });

  it('filters holidays for a given state including nationwide ones', () => {
    const bw = holidaysForStates(2026, ['BW']);
    expect(bw.some((h) => h.id === 'neujahr')).toBe(true); // nationwide
    expect(bw.some((h) => h.id === 'heiligeDreiKoenige')).toBe(true); // BW
    expect(bw.some((h) => h.id === 'mariaeHimmelfahrt')).toBe(false); // SL only
  });

  it('nationwide-only selection excludes regional holidays', () => {
    const nationwide = holidaysForStates(2026, []);
    expect(nationwide.every((h) => h.nationwide)).toBe(true);
  });
});
