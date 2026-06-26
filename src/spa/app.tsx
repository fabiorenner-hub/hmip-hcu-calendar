import type { JSX } from 'preact';
import { signal } from '@preact/signals';
import { langPref, setLangPref, t, type LangPref } from './i18n.js';
import { APP_VERSION } from './version.js';
import { snapshot } from './api.js';
import { DashboardTab } from './tabs/dashboard.js';
import { CalendarsTab } from './tabs/calendars.js';
import { HolidaysTab } from './tabs/holidays.js';
import { AppearanceTab } from './tabs/appearance.js';
import { NotificationsTab } from './tabs/notifications.js';
import { DiagnosticsTab } from './tabs/diagnostics.js';
import { LogsTab } from './tabs/logs.js';
import { UpdatesTab } from './tabs/updates.js';
import { HelpTab } from './tabs/help.js';

type Route =
  | 'dashboard'
  | 'calendars'
  | 'holidays'
  | 'appearance'
  | 'notifications'
  | 'diagnostics'
  | 'logs'
  | 'updates'
  | 'help';

const route = signal<Route>('dashboard');

interface NavItem {
  id: Route;
  de: string;
  en: string;
  icon: string;
}

const NAV: NavItem[] = [
  { id: 'dashboard', de: 'Übersicht', en: 'Overview', icon: '◫' },
  { id: 'calendars', de: 'Kalender', en: 'Calendars', icon: '🗓' },
  { id: 'holidays', de: 'Feiertage', en: 'Holidays', icon: '★' },
  { id: 'appearance', de: 'Darstellung', en: 'Appearance', icon: '🌓' },
  { id: 'notifications', de: 'Mitteilungen', en: 'Notifications', icon: '🔔' },
  { id: 'diagnostics', de: 'Diagnose', en: 'Diagnostics', icon: '🩺' },
  { id: 'logs', de: 'Logs', en: 'Logs', icon: '≣' },
  { id: 'updates', de: 'Updates', en: 'Updates', icon: '⬆' },
  { id: 'help', de: 'Hilfe', en: 'Help', icon: '?' },
];

function renderTab(): JSX.Element {
  switch (route.value) {
    case 'dashboard':
      return <DashboardTab />;
    case 'calendars':
      return <CalendarsTab />;
    case 'holidays':
      return <HolidaysTab />;
    case 'appearance':
      return <AppearanceTab />;
    case 'notifications':
      return <NotificationsTab />;
    case 'diagnostics':
      return <DiagnosticsTab />;
    case 'logs':
      return <LogsTab />;
    case 'updates':
      return <UpdatesTab />;
    case 'help':
      return <HelpTab />;
  }
}

export function App(): JSX.Element {
  const snap = snapshot.value;
  const activeCount = snap ? snap.devices.filter((d) => d.enabled && d.on).length : 0;

  return (
    <div class="app">
      <header class="app__header">
        <div class="brand">
          <img class="brand__mark" src="/icon.png" alt="" width="28" height="28" />
          <span class="brand__name">HmIP Kalender</span>
        </div>
        <div class="app__header-right">
          {snap && (
            <span class="header-status" title={t('Aktive Tage', 'Active days')}>
              {activeCount} {t('aktiv', 'active')}
            </span>
          )}
          <button class="version-badge" type="button" onClick={() => (route.value = 'updates')}>
            v{APP_VERSION}
          </button>
          <div class="lang-switch">
            {(['AUTO', 'de', 'en'] as LangPref[]).map((p) => (
              <button
                key={p}
                type="button"
                class={`lang-switch__btn ${langPref.value === p ? 'is-active' : ''}`}
                onClick={() => setLangPref(p)}
              >
                {p === 'AUTO' ? 'AUTO' : p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <nav class="app__nav" aria-label={t('Module', 'Modules')}>
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            class={`nav-item ${route.value === item.id ? 'is-active' : ''}`}
            onClick={() => (route.value = item.id)}
          >
            <span class="nav-item__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span class="nav-item__label">{t(item.de, item.en)}</span>
          </button>
        ))}
      </nav>

      <main class="app__main">{renderTab()}</main>
    </div>
  );
}
