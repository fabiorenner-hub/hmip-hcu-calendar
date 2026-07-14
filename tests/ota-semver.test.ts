import { describe, expect, it } from 'vitest';
import { compareSemver, isAtLeast, isNewer, isNewerWithBuild } from '../src/plugin/ota/semver.js';

describe('semver', () => {
  it('compares core versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
    expect(isNewer('1.2.4', '1.2.3')).toBe(true);
    expect(isNewer('1.2.3', '1.2.4')).toBe(false);
    expect(isAtLeast('1.4.7', '1.4.7')).toBe(true);
    expect(isAtLeast('1.4.6', '1.4.7')).toBe(false);
  });

  it('isNewerWithBuild: same core → build stamp ordering, tail beats no-tail', () => {
    expect(isNewerWithBuild('0.1.2+exp.20260702-1200', '0.1.2')).toBe(true);
    expect(isNewerWithBuild('0.1.2+exp.20260702-1300', '0.1.2+exp.20260702-1200')).toBe(true);
    expect(isNewerWithBuild('0.1.2+exp.20260702-1200', '0.1.2+exp.20260702-1200')).toBe(false);
    expect(isNewerWithBuild('0.1.2', '0.1.2')).toBe(false);
    // Higher core always wins regardless of build tail.
    expect(isNewerWithBuild('0.1.3', '0.1.2+exp.99999999-2359')).toBe(true);
  });
});
