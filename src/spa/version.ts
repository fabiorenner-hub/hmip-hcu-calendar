// Keep in sync with package.json / Dockerfile / CHANGELOG.md / src/shared/version.ts.
export const APP_VERSION = '0.2.1';

export const GITHUB_URL = 'https://github.com/fabiorenner-hub/hmip-hcu-calendar';

/** Changelog shown in the Updates tab. Newest entry first. */
export const CHANGELOG: { version: string; de: string; en: string }[] = [
  {
    version: '0.2.1',
    de: 'Stabilitäts- und Robustheitsverbesserungen bei Hintergrundaufgaben und im Update-Ablauf.',
    en: 'Stability and robustness improvements to background tasks and the update flow.',
  },
  {
    version: '0.2.0',
    de: 'Automatische Over-the-Air-Updates (Kanäle Stabil + Experimentell), standardmäßig an im Kanal Stabil, mit klarer Fortschrittsanzeige während der Installation.',
    en: 'Automatic over-the-air updates (stable + experimental channels), on by default on stable, with a clear install progress UI.',
  },
  {
    version: '0.1.3',
    de: 'Versions-Badge oben links neben dem Titel: verlinkt auf GitHub und zeigt eine Update-Benachrichtigung, wenn eine neuere Version verfügbar ist.',
    en: 'Version badge top-left next to the title: links to GitHub and shows an update notification when a newer release is available.',
  },
  {
    version: '0.1.2',
    de: 'Dashboard auf der HCU-Konfigseite aktivierbar; Port änderbar.',
    en: 'Dashboard can be enabled on the HCU config page; port is configurable.',
  },
  {
    version: '0.1.1',
    de: 'Neues, klareres App-Icon.',
    en: 'New, cleaner app icon.',
  },
  {
    version: '0.1.0',
    de: 'Erste Veröffentlichung: virtuelle Schalter für Feiertage, Wochenende, Brückentage und eigene Spezialtage.',
    en: 'Initial release: virtual switches for public holidays, weekends, bridge days and custom special days.',
  },
];
