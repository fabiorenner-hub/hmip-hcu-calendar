import { describe, expect, it } from 'vitest';
import {
  fetchLatestPrerelease,
  findOtaAssets,
  parseRelease,
  type FetchLike,
} from '../src/plugin/ota/github.js';

function mkFetch(routes: Record<string, unknown>): FetchLike {
  return ((url: string) => {
    const body = routes[url];
    return Promise.resolve({
      ok: body !== undefined,
      status: body !== undefined ? 200 : 404,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });
  }) as FetchLike;
}

describe('github', () => {
  it('parseRelease extracts tag, prerelease and https assets', () => {
    const rel = parseRelease({
      tag_name: 'v0.1.3',
      html_url: 'https://github.com/x/y/releases/tag/v0.1.3',
      prerelease: false,
      assets: [
        { name: 'ota-manifest.json', browser_download_url: 'https://example.com/m.json' },
        { name: 'insecure', browser_download_url: 'http://example.com/x' },
      ],
    });
    expect(rel?.tagName).toBe('v0.1.3');
    expect(rel?.prerelease).toBe(false);
    expect(rel?.assets).toHaveLength(1); // http asset dropped
  });

  it('findOtaAssets classifies manifest, bundle and sha256', () => {
    const set = findOtaAssets({
      tagName: 'experimental',
      htmlUrl: 'https://x',
      prerelease: true,
      assets: [
        { name: 'ota-manifest-exp.json', url: 'https://x/m' },
        { name: 'calendar-ota-exp.json', url: 'https://x/b' },
        { name: 'calendar-ota-exp.json.sha256', url: 'https://x/s' },
      ],
    });
    expect(set.manifest?.url).toBe('https://x/m');
    expect(set.bundle?.url).toBe('https://x/b');
    expect(set.sha256?.url).toBe('https://x/s');
  });

  it('fetchLatestPrerelease returns the first prerelease in the list', async () => {
    const url = 'https://api.github.com/repos/fabiorenner-hub/hmip-hcu-calendar/releases?per_page=20';
    const f = mkFetch({
      [url]: [
        { tag_name: 'v0.1.3', prerelease: false, assets: [] },
        { tag_name: 'experimental', prerelease: true, assets: [] },
      ],
    });
    const rel = await fetchLatestPrerelease(f);
    expect(rel?.tagName).toBe('experimental');
    expect(rel?.prerelease).toBe(true);
  });
});
