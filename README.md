# HMIP HCU Plugin: Calendar

[Deutsche Version → `README.de.md`](README.de.md)

A [Homematic IP](https://www.homematic-ip.com/) Home Control Unit (HCU) plugin
that turns **calendar special days** — German public holidays, bridge days,
birthdays, vacations and any custom day you define — into **virtual on/off
devices**. Use them in HCU automations to make things happen (or *not* happen)
on those days.

`pluginId: de.fr.renner.plugin.calendar`

> Example: a "Public holiday" device that is **on** on every German public
> holiday. An HCU automation can then skip the workday wake-up light whenever
> that device is on.

The plugin is **local only** (`scope: LOCAL`), stores everything under `/data`,
and is fully bilingual (DE/EN). It follows the official
[Connect API](https://github.com/homematicip/connect-api) 1.0.1 specification.
The one exception to "no cloud" is optional, anonymous usage statistics — see
[Privacy & telemetry](#privacy--telemetry) below.

> Heads-up: this is a personal, self-hosted hobby project, not an official
> eQ-3 product. Use at your own risk.

## Privacy & telemetry

To understand how many installations exist and which plugin/HCU versions are in
use, the plugin sends **anonymous usage statistics** to a central endpoint
(`https://hcu.fabiorenner.de/ingest.php`). This is **on by default** and can be
switched off any time under **Settings → Appearance & Language → Anonymous usage
statistics**.

Only pseudonymous technical metadata is sent: a hashed, stable install id (a
SHA-256 value — your HCU serial/SGTIN is **never** transmitted), the plugin id,
the running core/OTA/build versions, the CPU architecture and the active UI
language. **Never sent:** serial numbers, IP addresses, names, e-mail,
location, rooms, device names/addresses, measurements, automations, schedules,
config contents or tokens. The dashboard's "What is sent?" button shows the
exact payload. Delivery is best-effort and never affects plugin operation.

## Support

Found a bug or have a question? Please [open an issue](../../issues). Include
your **HCU firmware version**, the **plugin version** (Settings → Updates), and
the relevant lines from the plugin log (HCUweb plugin panel, or Settings →
Logs & Debug → Connect log). See [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)
first — it covers the common cases in English and German.

## What it does

Each **calendar** you create becomes one virtual `SWITCH` device exposed to the
HCU. A calendar holds one or more **rules**; the device is **on** when today
matches any rule (OR logic). Optional modifiers per calendar:

- **Lead / trail days** — also switch on N days before/after a match (e.g. the
  eve of Christmas).
- **Invert** — on when the day does *not* match (e.g. "not a holiday").
- **Manual override** — force on/off from the dashboard or the HMIP app; the
  override clears automatically at the next local midnight.

The engine is **pure and deterministic** (Easter, holiday tables and rule
evaluation are side-effect free and unit/property tested), so the same day
always yields the same result. The plugin re-evaluates at every local midnight,
on configuration changes, and on manual overrides — and only emits a
`STATUS_EVENT` for changes it actually observes (never an optimistic echo of an
HCU command).

## Supported special-day types

| Type | Description |
| --- | --- |
| **German public holidays** | Statutory holidays, optionally per federal state. Empty selection = nationwide only. Year-aware (e.g. Reformationstag in the northern states from 2018, Frauentag BE 2019 / MV 2023, Buß- und Bettag in Saxony). |
| **Bridge days** (Brückentage) | Working days bridging a public holiday and the weekend (Mon after a Tue holiday, Fri after a Thu holiday). |
| **Weekdays** | Any selection of weekdays. |
| **Annual date** | Recurring month/day, e.g. birthdays. |
| **Single date** | One specific calendar date. |
| **Date range** | Inclusive range, e.g. a vacation. |
| **Nth weekday of month** | e.g. 2nd Sunday in May (Mother's Day), last Monday, … |
| **Relative to Easter** | Signed day offset from Easter Sunday (Rose Monday −48, Good Friday −2, …). |
| **School holidays** | Manually maintained date ranges (KMK data is not computable). |

> Weekends are intentionally **not** a built-in device — the HCU already handles
> weekend conditions natively in automations.

On first start one calendar is seeded: **Public holiday** (nationwide German
holidays). Add your own from the dashboard.

## Install on your HCU

1. Download the latest `hmip-hcu-calendar-<version>-arm64.tar.gz` from the
   [Releases](../../releases) page (or build it yourself, see below).
2. In **HCUweb → Plugins**, upload the `.tar.gz`. The HCU installs and starts it
   automatically (developer mode must be enabled).
3. Run the plugin's **device discovery** in HCUweb to include the calendar
   devices (e.g. "Public holiday").
4. The self-hosted dashboard is reachable at `http://<your-hcu>.local:8092/`.

> The plugin uses port **8092** for its dashboard so it does not collide with
> other plugins. If you run several plugins, make sure each one uses a unique
> port.

## Configuration

Everything is configured in the plugin's own web UI (no cloud, no account):

- **Calendars** — create/edit calendar devices and their rules; preview the
  upcoming matches.
- **Holidays** — preview the computed German public holidays for any year and
  state selection.
- **Appearance & Language** — UI language (AUTO/DE/EN), notification language,
  timezone (default `Europe/Berlin`) and default states for new holiday rules.
- **Notifications** — optional Telegram delivery on day start/end.

The HCU config page can enable/disable the dashboard and change its port; the
change is applied live.

## Dashboard

A self-hosted dashboard on the HCU (`http://<your-hcu>.local:8092/`) with a live
overview of every calendar device (state, reason chips, upcoming matches, quick
override), a holiday preview, diagnostics, a logs panel with a one-click "all
information" export, notifications, updates and help. Dark-glass theme,
responsive, automatic light/dark, full keyboard focus styles, live updates via
SSE.

## Build it yourself

Requirements: Node.js ≥ 20, Docker with buildx (for the arm64 image).

```bash
npm install
npm run typecheck      # tsc for server + SPA
npm run lint           # eslint --max-warnings=0
npm test               # vitest (unit + fast-check property tests)
npm run build          # compile server + bundle the SPA
npm run build:image    # arm64 image -> hmip-hcu-calendar-<version>-arm64.tar.gz

# Run the dashboard locally without an HCU:
CALENDAR_NO_CONNECT=1 CALENDAR_DATA_DIR=./data node dist/plugin/index.js
# open http://localhost:8092
```

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `CALENDAR_DATA_DIR` | `/data` | Persistence directory. |
| `CALENDAR_DASHBOARD_PORT` | `8092` | Dashboard / REST port. |
| `CALENDAR_NO_CONNECT` | – | `1` to run dashboard-only (no WebSocket). |
| `CALENDAR_NO_DASHBOARD` | – | `1` to run connection-only (no HTTP server). |
| `CALENDAR_CONNECT_URL` | `wss://host.containers.internal:9001` | Override the HCU endpoint. |
| `CALENDAR_HCU_HOST` | – | Remote dev convenience: builds `wss://<host>:9001`. |
| `CALENDAR_AUTH_TOKEN` | – | Raw auth token (else read from `CALENDAR_TOKEN_PATH` or `/TOKEN`). |
| `CALENDAR_TOKEN_PATH` | – | Path to a token file. |

## Architecture

```
src/
  engine/        Pure, deterministic logic (Easter, holidays, rule evaluation)
  connect/       Connect API WebSocket client + envelope/feature helpers
  dashboard/     Fastify server: /api/* + SSE + SPA fallback
  notifications/ Message store + optional Telegram delivery
  persistence/   Atomic config store under /data
  plugin/        Boot, env, clock, orchestrator (the I/O boundary)
  shared/        Zod config schema + version
  spa/           Preact + Signals dashboard (bundled with esbuild, no CDN)
public/          index.html, styles.css (dark-glass tokens), icon.png, sw.js
tests/           Vitest unit + fast-check property tests for the engine
```

The runtime image is built from `ghcr.io/homematicip/alpine-node-simple` and
ships only pruned `node_modules`, `dist` and `public`.

## Notes on Connect API usage

- Devices use the `SWITCH` archetype with the `switchState` feature
  (`{ type: "switchState", on }`), per spec §6.6.5 / §6.7.36.
- `deviceId` equals the stable calendar id and is consistent across
  DISCOVER / STATUS / CONTROL.
- `STATUS_EVENT` is only emitted for **observed** state changes (day boundary,
  override change) — never as an optimistic echo of an HCU `CONTROL_REQUEST`.

## License

[Apache License 2.0](LICENSE) © Fabio Renner. Homematic IP is a trademark of
eQ-3 AG; this project is not affiliated with or endorsed by eQ-3 AG.
