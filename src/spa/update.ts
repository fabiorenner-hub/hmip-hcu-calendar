import { signal } from '@preact/signals';
import { APP_VERSION, GITHUB_URL } from './version.js';

/** Latest version string found on GitHub (without the leading "v"), or null. */
export const latestVersion = signal<string | null>(null);
/** True when the GitHub release is newer than the running version. */
export const updateAvailable = signal(false);

export const GITHUB_RELEASES_URL = `${GITHUB_URL}/releases`;

function parseRepo(url: string): { owner: string; repo: string } | null {
  const m = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url);
  return m && m[1] && m[2] ? { owner: m[1], repo: m[2] } : null;
}

/** Compare dotted numeric versions. Returns <0, 0 or >0. */
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Check GitHub for a newer release. Runs entirely in the browser (the HCU
 * itself needs no internet). Fails silently when offline or rate-limited so we
 * never show a false "update available".
 */
export async function checkForUpdate(): Promise<void> {
  const repo = parseRepo(GITHUB_URL);
  if (!repo) return;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo.owner}/${repo.repo}/releases/latest`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );
    if (!res.ok) return;
    const data = (await res.json()) as { tag_name?: string };
    const tag = (data.tag_name ?? '').replace(/^v/i, '').trim();
    if (!tag) return;
    latestVersion.value = tag;
    updateAvailable.value = compareSemver(APP_VERSION, tag) < 0;
  } catch {
    // Offline / blocked / rate-limited — skip quietly.
  }
}
