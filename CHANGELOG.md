# Changelog

All notable changes to this project are documented here. Versions follow the
single source of truth in `package.json` and must stay in sync with the
Dockerfile (ARG + LABEL), `src/shared/version.ts` and `src/spa/version.ts`.

## 0.2.2

- Internal maintenance and minor cleanups.

## 0.2.1

- Stability and robustness improvements to background tasks and the update flow
  (smarter retry/backoff, no unnecessary repeats).

## 0.2.0

- Automatic over-the-air (OTA) updates with two channels (stable and
  experimental). OTA is on by default on the stable channel, so stable releases
  install automatically; the experimental channel is opt-in.
- New install experience: a clear progress bar and step-by-step status while the
  plugin downloads, verifies, restarts and comes back on the new version. The
  browser reloads automatically once the new version is live, and the button is
  locked during an install so a stray second click can no longer break the flow.
- OTA payloads are verified (sha256 + core-version compatibility) before they
  are activated; the image-baked bundle stays as a safe fallback.

## 0.1.3

- Version badge moved next to the title (top-left). It links to the GitHub
  releases page and shows an update notification (dot + pill) when a newer
  release is available. The check runs client-side; the HCU needs no internet.

## 0.1.2

- Dashboard can be enabled/disabled and its port changed from the HCU plugin
  config page (CONFIG_TEMPLATE/CONFIG_UPDATE), applied live at runtime.
- Healthcheck follows the active dashboard port (and passes when the dashboard
  is intentionally disabled).
- Removed the seeded "Weekend" device (the HCU handles weekends natively).
- Applied the dark-glass visual spec (glass cards, ambient background, themed
  scrollbars, reduced-motion support).

## 0.1.1

- New, cleaner app icon (rendered at 256px with anti-aliasing).

## 0.1.0

- Initial release.
- Virtual `SWITCH` devices driven by calendar rules: German public holidays
  (per federal state), bridge days, weekends, weekdays, annual dates, single
  dates, date ranges, nth weekday of month, days relative to Easter and
  manually maintained school-holiday ranges.
- Lead/trail days, rule inversion and manual overrides (auto-expiring at the
  next local midnight).
- Dark-glass Preact dashboard with live SSE updates, holiday preview, bilingual
  (DE/EN) UI, diagnostics, logs with 360° export, notifications (optional
  Telegram), updates and help tabs.
- Spec-compliant Connect API client (handshake headers, four-field envelope,
  `switchState` feature, `SWITCH` device type) per Connect API 1.0.1.
