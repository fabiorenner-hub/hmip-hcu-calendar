import type { JSX } from 'preact';
import { t } from '../i18n.js';
import { Button, Card, Chip, Hint, Metric, Panel, Segment } from '../components.js';
import { APP_VERSION, CHANGELOG, GITHUB_URL } from '../version.js';
import { GITHUB_RELEASES_URL, checkForUpdate, latestVersion, updateAvailable } from '../update.js';
import { config, patchConfig } from '../store.js';
import {
  loadOtaStatus,
  otaBusy,
  otaCheck,
  otaInstall,
  otaProgress,
  otaStatus,
  otaStep,
} from '../otaState.js';

/** Automatic OTA updates (expert). Hidden when the backend reports no OTA (503). */
function OtaCard(): JSX.Element | null {
  if (otaStatus.value === undefined) void loadOtaStatus();
  const s = otaStatus.value;
  const cfg = config.value;
  if (!s || !cfg) return null;

  const setUpdates = (patch: Partial<typeof cfg.updates>): void => {
    void patchConfig({ updates: { ...cfg.updates, ...patch } });
  };

  return (
    <Card title={t('Automatische Updates (Experte)', 'Automatic updates (expert)')}>
      <div class="grid grid--metrics">
        <Metric label={t('Kern (Image)', 'Core (image)')} value={`v${s.coreVersion}`} />
        <Metric label="OTA" value={s.otaActive ? `v${s.otaVersion}` : t('inaktiv', 'inactive')} />
        <Metric
          label={t('Neueste im Kanal', 'Latest in channel')}
          value={s.latest ? `v${s.latest}` : '—'}
        />
      </div>

      <div class="row row--opts">
        <label class="field">
          <span class="field__label">{t('Modus', 'Mode')}</span>
          <Segment<'manual' | 'auto'>
            value={cfg.updates.mode}
            onChange={(mode) => setUpdates({ mode })}
            options={[
              { value: 'manual', label: t('Manuell', 'Manual') },
              { value: 'auto', label: t('Automatisch', 'Automatic') },
            ]}
          />
        </label>
        <label class="field">
          <span class="field__label">{t('Kanal', 'Channel')}</span>
          <Segment<'stable' | 'experimental'>
            value={cfg.updates.channel}
            onChange={(channel) => setUpdates({ channel })}
            options={[
              { value: 'stable', label: t('Stabil', 'Stable') },
              { value: 'experimental', label: t('Experimentell', 'Experimental') },
            ]}
          />
        </label>
      </div>

      {cfg.updates.channel === 'experimental' && (
        <Hint>
          {t(
            'Experimentell: Vorabversionen zum Testen — können instabil sein. Für den Alltag „Stabil" wählen.',
            'Experimental: pre-release builds for testing — may be unstable. Use "Stable" for daily use.',
          )}
        </Hint>
      )}

      <div class="device__actions">
        <Button onClick={otaCheck} disabled={otaBusy.value || otaStep.value !== 'idle'}>
          {otaBusy.value ? t('Prüfe…', 'Checking…') : t('Jetzt prüfen', 'Check now')}
        </Button>
        {s.updateAvailable && otaStep.value === 'idle' && (
          <Button variant="primary" onClick={otaInstall}>
            {t('Jetzt aktualisieren', 'Update now')}
          </Button>
        )}
      </div>

      {otaStep.value !== 'idle' && (
        <div class="ota-progress" role="status" aria-live="polite">
          <div class="ota-progress__label">
            {otaStep.value === 'installing' && t('Installiere Update…', 'Installing update…')}
            {otaStep.value === 'restarting' && t('Plugin startet neu…', 'Restarting the plugin…')}
            {otaStep.value === 'verifying' && t('Prüfe neue Version…', 'Verifying new version…')}
            {otaStep.value === 'done' && t('Fertig — Seite wird neu geladen…', 'Done — reloading…')}
            {otaStep.value === 'timeout' &&
              t(
                'Der Neustart dauert länger als erwartet.',
                'The restart is taking longer than expected.',
              )}
          </div>
          {otaStep.value === 'timeout' ? (
            <Button variant="primary" onClick={() => location.reload()}>
              {t('Seite neu laden', 'Reload page')}
            </Button>
          ) : (
            <div class="progress" aria-hidden="true">
              <div
                class={`progress__bar ${otaStep.value === 'restarting' ? 'progress__bar--pulse' : ''}`}
                style={`width:${Math.round(otaProgress.value)}%`}
              />
            </div>
          )}
        </div>
      )}

      {s.requiresCore && otaStep.value === 'idle' && (
        <Hint>
          {t(
            'Kern-Update nötig: bitte die neue .tar.gz über HCUweb installieren.',
            'Core update required: please install the new .tar.gz via HCUweb.',
          )}
        </Hint>
      )}
    </Card>
  );
}

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

      <OtaCard />

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
