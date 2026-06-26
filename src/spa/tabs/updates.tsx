import type { JSX } from 'preact';
import { t } from '../i18n.js';
import { Card, Metric, Panel } from '../components.js';
import { APP_VERSION, CHANGELOG, GITHUB_URL } from '../version.js';

export function UpdatesTab(): JSX.Element {
  return (
    <Panel title={t('Updates', 'Updates')}>
      <div class="grid grid--metrics">
        <Card>
          <Metric label={t('Version', 'Version')} value={APP_VERSION} />
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
