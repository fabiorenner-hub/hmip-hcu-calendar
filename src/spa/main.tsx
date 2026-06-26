import { render } from 'preact';
import { App } from './app.js';
import { startStream } from './api.js';
import { loadConfig } from './store.js';
import { lang } from './i18n.js';

// Sync <html lang> with the effective language on boot.
if (typeof document !== 'undefined') {
  document.documentElement.lang = lang.value;
}

startStream();
void loadConfig();

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
}

// Register the service worker for basic offline shell caching (best-effort).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
