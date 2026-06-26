import { describe, expect, it } from 'vitest';
import { defaultConfig, maskConfig, parseConfig } from '../src/shared/config.js';

describe('config schema', () => {
  it('seeds a dashboard enabled on port 8092 by default', () => {
    const cfg = defaultConfig();
    expect(cfg.dashboard.enabled).toBe(true);
    expect(cfg.dashboard.port).toBe(8092);
  });

  it('no longer seeds a Weekend device', () => {
    const cfg = defaultConfig();
    expect(cfg.calendars.some((c) => c.nameDe === 'Wochenende')).toBe(false);
    expect(cfg.calendars).toHaveLength(1);
  });

  it('applies dashboard defaults when omitted', () => {
    const cfg = parseConfig({ calendars: [] });
    expect(cfg.dashboard).toEqual({ enabled: true, port: 8092 });
  });

  it('accepts a custom dashboard port', () => {
    const cfg = parseConfig({ dashboard: { enabled: false, port: 9001 } });
    expect(cfg.dashboard.enabled).toBe(false);
    expect(cfg.dashboard.port).toBe(9001);
  });

  it('rejects an out-of-range port', () => {
    expect(() => parseConfig({ dashboard: { enabled: true, port: 70000 } })).toThrow();
  });

  it('masks the telegram bot token', () => {
    const cfg = parseConfig({ telegram: { enabled: true, botToken: 'secret', chatId: '1' } });
    expect(maskConfig(cfg).telegram.botToken).toBe('***');
  });
});
