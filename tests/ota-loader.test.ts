import { describe, expect, it } from 'vitest';
import { decideBundle, type DecideInput } from '../src/bootstrap/loader.js';

const base: DecideInput = {
  coreVersion: '0.1.3',
  hasActiveBundle: true,
  manifest: { version: '0.1.4', minCoreVersion: '0.1.0', sha256: 'a'.repeat(64) },
  sha256Match: true,
  bootAttempts: 0,
  maxBootAttempts: 3,
};

describe('decideBundle', () => {
  it('no bundle → image, no quarantine', () => {
    expect(decideBundle({ ...base, hasActiveBundle: false })).toEqual({
      kind: 'image',
      quarantineDir: false,
      reason: 'no-ota',
    });
  });

  it('invalid manifest → image + quarantine', () => {
    const c = decideBundle({ ...base, manifest: null });
    expect(c).toMatchObject({ kind: 'image', quarantineDir: true, reason: 'manifest-invalid' });
  });

  it('sha mismatch → image + quarantine', () => {
    const c = decideBundle({ ...base, sha256Match: false });
    expect(c).toMatchObject({ kind: 'image', quarantineDir: true, reason: 'sha256-mismatch' });
  });

  it('requires-core → image WITHOUT quarantine', () => {
    const c = decideBundle({
      ...base,
      coreVersion: '0.1.0',
      manifest: { version: '0.2.0', minCoreVersion: '0.2.0', sha256: 'a'.repeat(64) },
    });
    expect(c).toMatchObject({ kind: 'image', quarantineDir: false, reason: 'requires-core' });
  });

  it('crash-loop → image + quarantine', () => {
    const c = decideBundle({ ...base, bootAttempts: 3 });
    expect(c).toMatchObject({ kind: 'image', quarantineDir: true, reason: 'crash-loop' });
  });

  it('healthy compatible bundle → ota', () => {
    expect(decideBundle(base)).toEqual({ kind: 'ota', version: '0.1.4' });
  });
});
