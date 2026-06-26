import type { JSX } from 'preact';
import { t } from '../i18n.js';
import { Button, Card, Chip, Metric, Panel } from '../components.js';
import { APP_VERSION, CHANGELOG, GITHUB_URL } from '../version.js';
import { GITHUB_RELEASES_URL, checkForUpdate, latestVersion, updateAvailable } from '../update.js';

export function UpdatesTab(): JSX.Element {
  return (
    <Panel
      title={t('Updates', 'Updates')}
      badge={
        updateAvailable.value ? (
          <Chip tone="accent">{t('Update verfügbar', 'Update available')}</Chip>
        ) : undefined
      }
    >
      {updateAvailable.value && (
        <Card>
          <div class="update-banner">
            <span>
              {t(
                `Neue Version v${latestVersion.value} verfügbar (installiert: v${APP_VERSION}).`,
                `New version v${latestVersion.value} available (installed: v${APP_VERSION}).`,
              )}
            </span>
            <a class="btn btn--primary" href={GITHUB_RELEASES_URL} target="_blank" rel="noopener noreferrer">
              {t('Zur Release-Seite', 'Go to releases')}
            </a>
          </div>
        </Card>
      )}

      <div class="grid grid--metrics">
        <Card>
          <Metric label={t('Installierte Version', 'Installed version')} value={`v${APP_VERSION}`} />
        </Card>
        <Card>
          <Metric
            label={t('Neueste auf GitHub', 'Latest on GitHub')}
            value={latestVersion.value ? `v${latestVersion.value}` : '—'}
            hint={updateAvailable.value ? t('Update verfügbar', 'Update available') : t('aktuell', 'up to date')}
          />
        </Card>
        <Card>
          <Metric
            label="GitHub"
            value={
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                {t('Projekt öffnen', 'Open project')}
              </a>
            }
          />
        </Card>
      </div>

      <Card>
        <Button onClick={checkForUpdate}>{t('Auf Updates prüfen', 'Check for updates')}</Button>
      </Card>

      <Card title={t('Änderungsverlauf', 'Changelog')}>
        <ul class="changelog">
          {CHANGELOG.map((c) => (
            <li key={c.version}>
              <strong>{c.version}</strong>
              <span class="muted"> — {t(c.de, c.en)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </Panel>
  );
}
