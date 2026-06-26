# Changelog

All notable changes to this project are documented here. Versions follow the
single source of truth in `package.json` and must stay in sync with the
Dockerfile (ARG + LABEL), `src/shared/version.ts` and `src/spa/version.ts`.

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
