import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '../src/engine/index.js';
import { defaultConfig } from '../src/shared/config.js';
import { fromIso } from '../src/engine/dates.js';

describe('buildSnapshot', () => {
  it('is deterministic for identical inputs', () => {
    const cfg = defaultConfig();
    const a = buildSnapshot(cfg, fromIso('2026-12-25'), 1);
    const b = buildSnapshot(cfg, fromIso('2026-12-25'), 1);
    expect(a).toEqual(b);
  });

  it('switches the holiday device on for Christmas Day', () => {
    const cfg = defaultConfig();
    const snap = buildSnapshot(cfg, fromIso('2026-12-25'), 1);
    const holiday = snap.devices.find((d) => d.nameDe === 'Feiertag');
    expect(holiday?.on).toBe(true);
  });

  it('switches a weekend rule on for a Sunday', () => {
    const cfg = defaultConfig();
    cfg.calendars.push({
      id: '99999999-9999-4999-8999-999999999999',
      enabled: true,
      nameDe: 'WE',
      nameEn: 'WE',
      rules: [{ kind: 'weekend' }],
      invert: false,
      leadDays: 0,
      trailDays: 0,
    });
    const snap = buildSnapshot(cfg, fromIso('2026-06-28'), 1);
    const weekend = snap.devices.find((d) => d.nameDe === 'WE');
    expect(weekend?.on).toBe(true);
  });

  it('reports a disabled device as off', () => {
    const cfg = defaultConfig();
    cfg.calendars[0]!.enabled = false;
    const snap = buildSnapshot(cfg, fromIso('2026-12-25'), 1);
    expect(snap.devices[0]!.on).toBe(false);
  });

  it('includes upcoming matches for preview', () => {
    const cfg = defaultConfig();
    const snap = buildSnapshot(cfg, fromIso('2026-12-20'), 1);
    const holiday = snap.devices.find((d) => d.nameDe === 'Feiertag');
    expect(holiday?.upcoming.some((u) => u.dateIso === '2026-12-25')).toBe(true);
  });
});
