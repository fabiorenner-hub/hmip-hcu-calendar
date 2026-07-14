# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM --platform=linux/arm64 ghcr.io/homematicip/alpine-node-simple:0.0.1 AS build
WORKDIR /app

# Install all dependencies (including dev) for compiling and bundling.
COPY package.json package-lock.json* ./
RUN npm ci

# Compile the server, type-check + bundle the SPA.
COPY tsconfig.json tsconfig.spa.json esbuild.mjs ./
COPY src ./src
COPY public ./public
RUN npm run build:server && npm run build:spa

# Drop dev dependencies so only runtime modules are shipped.
RUN npm prune --omit=dev

# ---------- Runtime stage ----------
FROM --platform=linux/arm64 ghcr.io/homematicip/alpine-node-simple:0.0.1 AS runtime
WORKDIR /app
ENV NODE_ENV=production

ARG CALENDAR_VERSION=0.2.0
# Expose the core version to the runtime so the OTA loader knows the image
# version (used for minCoreVersion compatibility checks).
ENV CALENDAR_VERSION=${CALENDAR_VERSION}
LABEL de.eq3.hmip.plugin.metadata='{"pluginId":"de.fr.renner.plugin.calendar","version":"0.2.0","issuer":"Fabio Renner","hcuMinVersion":"1.4.7","scope":"LOCAL","friendlyName":{"de":"Kalender","en":"Calendar"},"description":{"de":"Erkennt Feiertage und besondere Tage und stellt sie als virtuelle An/Aus-Geraete bereit. Konfiguration ueber das Web-Dashboard des Plugins (auf der HCU-Konfigseite aktivierbar).","en":"Detects public holidays and special days and exposes them as virtual on/off devices. Configured via the plugin web dashboard (enable it on the HCU config page)."},"image":"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","changelog":"0.2.0 - Automatische Over-the-Air-Updates (Kanaele Stabil + Experimentell), standardmaessig an im Kanal Stabil, mit klarer Fortschrittsanzeige. 0.1.3 - Versions-Badge mit GitHub-Link und Update-Hinweis. 0.1.2 - Dashboard ueber HCU-Konfigseite aktivierbar, Port aenderbar. 0.1.1 - Neues, klareres Icon. 0.1.0 - Erste Version: Feiertage, Brueckentage und eigene Spezialtage als virtuelle Schalter.","logsEnabled":true}'

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY package.json ./

EXPOSE 8092

# Report container health to the HCU (installation completes once healthy).
# The active dashboard port (or "disabled") is written to /tmp/calendar-dashport
# by the plugin, so the healthcheck follows runtime port changes from the HCU
# config page. Probe 127.0.0.1 (IPv4) - `localhost` resolves to ::1 while the
# server binds IPv4, which would always fail.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 \
  CMD sh -c 'P=$(cat /tmp/calendar-dashport 2>/dev/null || echo 8092); [ "$P" = disabled ] && exit 0; wget --quiet --spider "http://127.0.0.1:$P/api/state" || exit 1'

# Boot via the IMAGE-only OTA loader: it runs a verified OTA payload from
# /data/ota/active when present, else the image-baked bundle (dist/plugin/index.js).
ENTRYPOINT ["node", "dist/bootstrap/loader.js"]
