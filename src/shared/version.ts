/**
 * Single source of truth for the app version is package.json.
 * This constant MUST be kept in sync with package.json, the Dockerfile
 * (ARG + LABEL), CHANGELOG.md and the SPA version.ts (src/spa/version.ts).
 */
export const APP_VERSION = '0.2.3';

/**
 * Build identifier, injected at runtime via env (CALENDAR_BUILD_ID) when
 * available. Format: <version>+<utc-stamp>[.<git-sha>]. Falls back to the
 * plain version when no build stamp is provided.
 */
export function buildId(): string {
  const fromEnv = process.env.CALENDAR_BUILD_ID;
  return fromEnv && fromEnv.trim().length > 0 ? fromEnv.trim() : APP_VERSION;
}
