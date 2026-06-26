// Keep in sync with package.json / Dockerfile / CHANGELOG.md / src/shared/version.ts.
export const APP_VERSION = '0.1.2';

export const GITHUB_URL = 'https://github.com/fabiorenner-hub/hmip-hcu-calendar';

/** Changelog shown in the Updates tab. Newest entry first. */
export const CHANGELOG: { version: string; de: string; en: string }[] = [
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
