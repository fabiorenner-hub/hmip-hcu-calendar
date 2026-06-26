# Troubleshooting / Fehlerbehebung

Bilingual guide. English first, **Deutsch darunter**.

When reporting a bug, please include: HCU firmware version, plugin version
(Settings → Updates), the running build stamp, and the relevant lines from the
plugin log (HCUweb plugin panel / Settings → Logs & Debug → Connect log + the
`State` / `Diagnostics` endpoint output).

---

## English

### Installation fails / "an error occurred" / never completes

The HCU only finishes installing once the plugin container reports Docker
**healthy**. Almost all install failures come down to one of these:

- **Port collision.** Each installed plugin must use a **unique** dashboard
  port. This plugin defaults to **8092**. If another plugin already uses 8092,
  change this plugin's port (HCU config page) so no two plugins share a port.
- **Health check can't reach the dashboard.** The container's health check must
  reach the dashboard on `127.0.0.1` (IPv4). If you build a custom image, do not
  use `localhost` in the health check — it can resolve to IPv6 `::1` while the
  server binds IPv4, so the check fails forever and the install hangs.
- **Stale/half-installed entry.** If a previous attempt left a broken plugin
  entry, remove it in HCUweb and reload the plugin page before reinstalling.
- **Architecture / image format.** The image must be **arm64**. Build with the
  provided `npm run build:image` (it produces the correct `.tar.gz`).

### The plugin doesn't connect to the HCU (Connect API)

- The plugin connects from inside its container to
  `wss://host.containers.internal:9001` using the token at `/TOKEN`.
- In the plugin log look for `connect: WebSocket OPEN` followed by
  `sending PLUGIN_STATE_RESPONSE READY`. If `OPEN` never appears, the Connect
  WebSocket has not been exposed in HCUweb developer mode, or the token is
  missing.
- `connect: ERROR ...` lines show the cause (e.g. `ENOTFOUND`, a TLS error, or
  an auth rejection).

### No calendar devices appear in the HMIP app

- After installing, run the plugin's **device discovery** in HCUweb. New
  calendar devices are only included after a discovery run.
- Make sure the calendar is **enabled** and has at least one rule (Dashboard →
  Calendars).
- Newly added calendars require another discovery run to appear.

### A device is on/off on the "wrong" day

- Check the **timezone** (Settings → Appearance & Language, default
  `Europe/Berlin`). "Today" is determined in that timezone.
- Public holidays are **per federal state**. An empty state selection means
  *nationwide only*, so regional holidays (e.g. Epiphany, Corpus Christi) will
  not switch on. Select the right state(s).
- Use the **Holidays** tab to preview exactly which holidays are computed for a
  year and state selection.
- Remember **lead/trail days** and **invert** — they shift or flip the result on
  purpose.

### A device is stuck on/off

- You may have a **manual override** active (a "Override" chip is shown on the
  device card). Clear it from the dashboard; otherwise it auto-clears at the
  next local midnight.
- Toggling the switch from the HMIP app sets a one-day override by design;
  rule-based evaluation resumes the next day.

### The dashboard isn't reachable

- The default URL is `http://<your-hcu>.local:8092/`. Confirm the port (it can
  be changed on the HCU config page).
- The dashboard can be disabled on the HCU config page; if so, only the Connect
  integration runs (devices still work).

### School holidays don't switch

- School-holiday dates are **not computable** and must be entered manually as
  date ranges in the calendar's rule (Dashboard → Calendars → School holidays).

### Notifications don't arrive (Telegram)

- Enable Telegram and set the bot token and chat id (Notifications tab). The bot
  token is stored masked; re-enter it if you change it.
- The device showing/serving the notification needs outbound internet to reach
  the Telegram API.

---

## Deutsch

### Installation schlägt fehl / „Fehler aufgetreten" / wird nie fertig

Die HCU schließt die Installation erst ab, wenn der Plugin-Container Docker-
**healthy** meldet. Fast alle Fehlschläge haben eine dieser Ursachen:

- **Port-Kollision.** Jedes installierte Plugin braucht einen **eindeutigen**
  Dashboard-Port. Dieses Plugin nutzt standardmäßig **8092**. Belegt ein anderes
  Plugin bereits 8092, ändere den Port dieses Plugins (HCU-Konfigseite), damit
  sich keine zwei Plugins einen Port teilen.
- **Health-Check erreicht das Dashboard nicht.** Der Health-Check des Containers
  muss das Dashboard über `127.0.0.1` (IPv4) erreichen. Wenn du ein eigenes
  Image baust, nutze im Health-Check **nicht** `localhost` — das kann zu IPv6
  `::1` auflösen, während der Server auf IPv4 lauscht; dann scheitert der Check
  dauerhaft und die Installation hängt.
- **Alter/halb installierter Eintrag.** Hat ein früherer Versuch einen kaputten
  Plugin-Eintrag hinterlassen, entferne ihn in HCUweb und lade die Plugin-Seite
  neu, bevor du neu installierst.
- **Architektur / Image-Format.** Das Image muss **arm64** sein. Baue mit dem
  mitgelieferten `npm run build:image` (erzeugt die korrekte `.tar.gz`).

### Das Plugin verbindet sich nicht mit der HCU (Connect-API)

- Das Plugin verbindet sich aus seinem Container zu
  `wss://host.containers.internal:9001` mit dem Token unter `/TOKEN`.
- Suche im Plugin-Log nach `connect: WebSocket OPEN` gefolgt von
  `sending PLUGIN_STATE_RESPONSE READY`. Erscheint `OPEN` nie, wurde die
  Connect-WebSocket im HCUweb-Developer-Mode nicht freigegeben, oder das Token
  fehlt.
- `connect: ERROR ...`-Zeilen zeigen die Ursache (z. B. `ENOTFOUND`, ein
  TLS-Fehler oder eine abgelehnte Authentifizierung).

### Es erscheinen keine Kalender-Geräte in der HMIP-App

- Starte nach der Installation die **Geräte-Suche** des Plugins in HCUweb. Neue
  Kalender-Geräte werden erst nach einer Suche aufgenommen.
- Stelle sicher, dass der Kalender **aktiv** ist und mindestens eine Regel hat
  (Dashboard → Kalender).
- Neu angelegte Kalender brauchen eine erneute Geräte-Suche.

### Ein Gerät ist am „falschen" Tag an/aus

- Prüfe die **Zeitzone** (Einstellungen → Darstellung & Sprache, Default
  `Europe/Berlin`). „Heute" wird in dieser Zeitzone bestimmt.
- Feiertage sind **je Bundesland**. Eine leere Bundesland-Auswahl bedeutet *nur
  bundesweit* — regionale Feiertage (z. B. Heilige Drei Könige, Fronleichnam)
  schalten dann nicht. Wähle das/die richtige(n) Bundesland/-länder.
- Nutze den **Feiertage**-Tab, um exakt zu sehen, welche Feiertage für ein Jahr
  und eine Bundesland-Auswahl berechnet werden.
- Denk an **Tage davor/danach** und **Invertieren** — sie verschieben bzw.
  kehren das Ergebnis bewusst um.

### Ein Gerät hängt an/aus

- Vermutlich ist ein **manueller Override** aktiv (ein „Override"-Chip auf der
  Gerätekarte). Lösche ihn im Dashboard; sonst endet er automatisch zur nächsten
  lokalen Mitternacht.
- Schaltest du den Schalter in der HMIP-App, wird absichtlich ein Tages-Override
  gesetzt; die regelbasierte Auswertung läuft am nächsten Tag weiter.

### Das Dashboard ist nicht erreichbar

- Standard-URL ist `http://<deine-hcu>.local:8092/`. Prüfe den Port (über die
  HCU-Konfigseite änderbar).
- Das Dashboard lässt sich auf der HCU-Konfigseite deaktivieren; dann läuft nur
  die Connect-Integration (Geräte funktionieren weiterhin).

### Schulferien schalten nicht

- Schulferien-Daten sind **nicht berechenbar** und müssen als Zeiträume manuell
  in der Regel des Kalenders eingetragen werden (Dashboard → Kalender →
  Schulferien).

### Benachrichtigungen kommen nicht an (Telegram)

- Aktiviere Telegram und hinterlege Bot-Token und Chat-ID (Tab
  Benachrichtigungen). Das Bot-Token wird maskiert gespeichert; bei Änderung neu
  eingeben.
- Das Gerät, das die Benachrichtigung versendet, braucht ausgehenden
  Internetzugang zur Telegram-API.
