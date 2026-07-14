# HMIP HCU Plugin: Kalender

[English version → `README.md`](README.md)

Ein [Homematic IP](https://www.homematic-ip.com/) Home Control Unit (HCU)
Plugin, das **Kalender-Spezialtage** — deutsche Feiertage, Brückentage,
Geburtstage, Urlaube und beliebige eigene Tage — als **virtuelle An/Aus-Geräte**
bereitstellt. In HCU-Automationen kannst du damit an bestimmten Tagen etwas
auslösen (oder bewusst *nicht* auslösen).

`pluginId: de.fr.renner.plugin.calendar`

> Beispiel: ein Gerät „Feiertag", das an jedem deutschen Feiertag **an** ist.
> Eine HCU-Automation kann dann z. B. das werktägliche Aufwachlicht
> überspringen, solange dieses Gerät an ist.

Das Plugin ist **rein lokal** (`scope: LOCAL`), speichert alles unter `/data`
und ist vollständig zweisprachig (DE/EN). Es folgt der offiziellen
[Connect-API](https://github.com/homematicip/connect-api) 1.0.1. Die einzige
Ausnahme von „keine Cloud" ist eine optionale, anonyme Nutzungsstatistik — siehe
[Datenschutz & Telemetrie](#datenschutz--telemetrie) unten.

> Hinweis: Dies ist ein privates, selbst gehostetes Hobby-Projekt, kein
> offizielles eQ-3-Produkt. Nutzung auf eigene Gefahr.

## Datenschutz & Telemetrie

Um zu verstehen, wie viele Installationen es gibt und welche Plugin-/HCU-
Versionen im Einsatz sind, sendet das Plugin eine **anonyme Nutzungsstatistik**
an einen zentralen Endpunkt (`https://hcu.fabiorenner.de/ingest.php`). Das ist
**standardmäßig aktiv** und kann jederzeit unter **Einstellungen → Darstellung &
Sprache → Anonyme Nutzungsstatistik** abgeschaltet werden.

Übertragen werden ausschließlich pseudonyme technische Metadaten: eine gehashte,
stabile Installations-ID (ein SHA-256-Wert — die HCU-Seriennummer/SGTIN wird
**niemals** übertragen), die Plugin-ID, die laufenden Core-/OTA-/Build-Versionen,
die CPU-Architektur und die aktive UI-Sprache. **Niemals gesendet:**
Seriennummern, IP-Adressen, Namen, E-Mail, Standort, Räume, Gerätenamen/-adressen,
Messwerte, Automationen, Zeitpläne, Konfigurationsinhalte oder Tokens. Der Button
„Was wird gesendet?" im Dashboard zeigt die exakte Nutzlast. Der Versand erfolgt
„best effort" und beeinträchtigt den Plugin-Betrieb nie.

## Support

Fehler gefunden oder eine Frage? Bitte [ein Issue eröffnen](../../issues). Bitte
**HCU-Firmware-Version**, **Plugin-Version** (Einstellungen → Updates) und die
relevanten Zeilen aus dem Plugin-Log (HCUweb-Plugin-Panel bzw. Einstellungen →
Logs & Debug → Connect-Protokoll) angeben. Schau zuerst in
[`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) — dort stehen die häufigen
Fälle auf Deutsch und Englisch.

## Was es macht

Jeder **Kalender**, den du anlegst, wird ein virtuelles `SWITCH`-Gerät in der
HCU. Ein Kalender enthält eine oder mehrere **Regeln**; das Gerät ist **an**,
wenn der heutige Tag zu einer Regel passt (ODER-Verknüpfung). Optionale
Modifikatoren pro Kalender:

- **Tage davor/danach** — schaltet auch N Tage vor/nach einem Treffer an
  (z. B. der Abend vor Heiligabend).
- **Invertieren** — an, wenn der Tag **nicht** passt (z. B. „kein Feiertag").
- **Manueller Override** — im Dashboard oder in der HMIP-App an/aus erzwingen;
  endet automatisch zur nächsten lokalen Mitternacht.

Die Engine ist **rein und deterministisch** (Ostern, Feiertagstabellen und
Regel-Auswertung sind seiteneffektfrei und per Unit-/Property-Tests abgesichert)
— gleicher Tag, gleiches Ergebnis. Das Plugin wertet zu jeder lokalen
Mitternacht, bei Konfigurationsänderungen und bei manuellen Overrides neu aus —
und sendet ein `STATUS_EVENT` nur für **tatsächlich beobachtete** Änderungen
(nie als optimistisches Echo eines HCU-Befehls).

## Unterstützte Spezialtag-Typen

| Typ | Beschreibung |
| --- | --- |
| **Deutsche Feiertage** | Gesetzliche Feiertage, optional je Bundesland. Leere Auswahl = nur bundesweit. Jahresabhängig korrekt (z. B. Reformationstag in den Nordländern ab 2018, Frauentag BE 2019 / MV 2023, Buß- und Bettag in Sachsen). |
| **Brückentage** | Werktage zwischen Feiertag und Wochenende (Mo nach einem Di-Feiertag, Fr nach einem Do-Feiertag). |
| **Wochentage** | Beliebige Auswahl von Wochentagen. |
| **Jährliches Datum** | Wiederkehrend nach Monat/Tag, z. B. Geburtstage. |
| **Einzeltermin** | Ein konkretes Datum. |
| **Zeitraum** | Inklusiver Bereich, z. B. ein Urlaub. |
| **n-ter Wochentag im Monat** | z. B. 2. Sonntag im Mai (Muttertag), letzter Montag, … |
| **Relativ zu Ostern** | Vorzeichenbehafteter Tagesversatz zum Ostersonntag (Rosenmontag −48, Karfreitag −2, …). |
| **Schulferien** | Manuell gepflegte Zeiträume (KMK-Daten sind nicht berechenbar). |

> Wochenenden sind bewusst **kein** eingebautes Gerät — die HCU kann
> Wochenend-Bedingungen bereits nativ in Automationen.

Beim ersten Start wird ein Kalender angelegt: **Feiertag** (bundesweite
deutsche Feiertage). Eigene legst du im Dashboard an.

## Installation auf der HCU

1. Lade die neueste `hmip-hcu-calendar-<version>-arm64.tar.gz` von der
   [Releases](../../releases)-Seite (oder baue sie selbst, siehe unten).
2. Lade die `.tar.gz` unter **HCUweb → Plugins** hoch. Die HCU installiert und
   startet sie automatisch (Developer-Mode muss aktiv sein).
3. Starte die **Geräte-Suche** des Plugins in HCUweb, um die Kalender-Geräte
   (z. B. „Feiertag") aufzunehmen.
4. Das Dashboard ist dann unter `http://<deine-hcu>.local:8092/` erreichbar.

> Das Plugin nutzt Port **8092**, damit es nicht mit anderen Plugins
> kollidiert. Wenn du mehrere Plugins betreibst, achte darauf, dass jedes einen
> eindeutigen Port verwendet.

## Konfiguration

Alles wird im eigenen Web-UI des Plugins konfiguriert (keine Cloud, kein Konto):

- **Kalender** — Geräte und ihre Regeln anlegen/bearbeiten; kommende Treffer als
  Vorschau.
- **Feiertage** — Vorschau der berechneten deutschen Feiertage für ein
  beliebiges Jahr und eine Bundesland-Auswahl.
- **Darstellung & Sprache** — UI-Sprache (AUTO/DE/EN), Benachrichtigungssprache,
  Zeitzone (Default `Europe/Berlin`) und Standard-Bundesländer für neue
  Feiertags-Regeln.
- **Benachrichtigungen** — optionaler Telegram-Versand bei Tagesbeginn/-ende.

Über die HCU-Konfigseite lässt sich das Dashboard aktivieren/deaktivieren und der
Port ändern; die Änderung wird live übernommen.

## Dashboard

Ein selbst gehostetes Dashboard auf der HCU (`http://<deine-hcu>.local:8092/`)
mit Live-Übersicht aller Kalender-Geräte (Status, Begründungs-Chips, kommende
Treffer, schneller Override), Feiertags-Vorschau, Diagnose, Logs-Panel mit
„Alle Informationen"-Export per Klick, Benachrichtigungen, Updates und Hilfe.
Dark-Glass-Theme, responsiv, automatisch Hell/Dunkel, vollständige
Tastatur-Fokus-Stile, Live-Updates per SSE.

## Selbst bauen

Voraussetzungen: Node.js ≥ 20, Docker mit buildx (für das arm64-Image).

```bash
npm install
npm run typecheck      # tsc für Server + SPA
npm run lint           # eslint --max-warnings=0
npm test               # vitest (Unit- + fast-check-Property-Tests)
npm run build          # Server kompilieren + SPA bündeln
npm run build:image    # arm64-Image -> hmip-hcu-calendar-<version>-arm64.tar.gz

# Dashboard lokal ohne HCU starten:
CALENDAR_NO_CONNECT=1 CALENDAR_DATA_DIR=./data node dist/plugin/index.js
# http://localhost:8092 öffnen
```

### Umgebungsvariablen

| Variable | Default | Zweck |
| --- | --- | --- |
| `CALENDAR_DATA_DIR` | `/data` | Persistenz-Verzeichnis. |
| `CALENDAR_DASHBOARD_PORT` | `8092` | Dashboard-/REST-Port. |
| `CALENDAR_NO_CONNECT` | – | `1` = nur Dashboard (kein WebSocket). |
| `CALENDAR_NO_DASHBOARD` | – | `1` = nur Verbindung (kein HTTP-Server). |
| `CALENDAR_CONNECT_URL` | `wss://host.containers.internal:9001` | HCU-Endpunkt überschreiben. |
| `CALENDAR_HCU_HOST` | – | Remote-Dev: baut `wss://<host>:9001`. |
| `CALENDAR_AUTH_TOKEN` | – | Roh-Token (sonst aus `CALENDAR_TOKEN_PATH` oder `/TOKEN`). |
| `CALENDAR_TOKEN_PATH` | – | Pfad zu einer Token-Datei. |

## Architektur

```
src/
  engine/        Reine, deterministische Logik (Ostern, Feiertage, Regel-Auswertung)
  connect/       Connect-API-WebSocket-Client + Envelope-/Feature-Helfer
  dashboard/     Fastify-Server: /api/* + SSE + SPA-Fallback
  notifications/ Nachrichten-Store + optionaler Telegram-Versand
  persistence/   Atomarer Config-Store unter /data
  plugin/        Boot, Env, Clock, Orchestrator (die I/O-Grenze)
  shared/        Zod-Config-Schema + Version
  spa/           Preact + Signals Dashboard (mit esbuild gebündelt, ohne CDN)
public/          index.html, styles.css (Dark-Glass-Tokens), icon.png, sw.js
tests/           Vitest Unit- + fast-check-Property-Tests für die Engine
```

Das Runtime-Image basiert auf `ghcr.io/homematicip/alpine-node-simple` und
liefert nur die geprunten `node_modules`, `dist` und `public` aus.

## Hinweise zur Connect-API-Nutzung

- Geräte nutzen den `SWITCH`-Archetyp mit dem `switchState`-Feature
  (`{ type: "switchState", on }`), gemäß Spec §6.6.5 / §6.7.36.
- `deviceId` entspricht der stabilen Kalender-ID und ist über
  DISCOVER / STATUS / CONTROL konsistent.
- `STATUS_EVENT` wird nur für **beobachtete** Statusänderungen gesendet
  (Tageswechsel, Override-Änderung) — nie als optimistisches Echo eines
  HCU-`CONTROL_REQUEST`.

## Lizenz

[Apache License 2.0](LICENSE) © Fabio Renner. Homematic IP ist eine Marke der
eQ-3 AG; dieses Projekt steht in keiner Verbindung zu eQ-3 AG und wird nicht von
eQ-3 AG unterstützt.
