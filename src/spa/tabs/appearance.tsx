import type { JSX } from 'preact';
import { signal } from '@preact/signals';
import { config, patchConfig } from '../store.js';
import { api } from '../api.js';
import { langPref, setLangPref, t, type LangPref } from '../i18n.js';
import { Button, Card, Empty, Field, Hint, Panel, Segment, Toggle } from '../components.js';
import { BUNDESLAENDER } from '../constants.js';

const analyticsPreview = signal<string | null>(null);

/** Opt-in, anonymous usage statistics with full transparency of what is sent. */
function AnalyticsCard(): JSX.Element {
  const cfg = config.value!;
  const a = cfg.analytics;
  return (
    <Card title={t('Anonyme Nutzungsstatistik (Datenschutz)', 'Anonymous usage statistics (privacy)')}>
      <Hint>
        {t(
          'Sendet ausschließlich pseudonyme technische Informationen wie Plugin-Version, HCU-Firmware, Architektur und Sprache. Es werden keine Geräte-, Raum-, Mess- oder Konfigurationsdaten übertragen. Standardmäßig AN — hier jederzeit abschaltbar.',
          'Sends only pseudonymous technical information such as plugin version, HCU firmware, architecture and language. No device, room, measurement or configuration data is transmitted. On by default — can be switched off here any time.',
        )}
      </Hint>
      <Toggle
        checked={a.enabled}
        onChange={(v) => void patchConfig({ analytics: { ...a, enabled: v } })}
        label={t('Anonyme Nutzungsstatistik senden', 'Send anonymous usage statistics')}
      />
      <Button
        onClick={() => {
          void api
            .analyticsPreview()
            .then((r) => (analyticsPreview.value = JSON.stringify(r.payload, null, 2)))
            .catch(() => (analyticsPreview.value = '—'));
        }}
      >
        {t('Was wird gesendet?', 'What is sent?')}
      </Button>
      {analyticsPreview.value && (
        <pre class="code-preview">{analyticsPreview.value}</pre>
      )}
    </Card>
  );
}

export function AppearanceTab(): JSX.Element {
  const cfg = config.value;
  return (
    <Panel
      title={t('Darstellung & Sprache', 'Appearance & Language')}
      intro={t('Sprache der Oberfläche und allgemeine Einstellungen.', 'Interface language and general settings.')}
    >
      <Card title={t('Anzeige-Sprache', 'Display language')}>
        <Segment<LangPref>
          value={langPref.value}
          onChange={setLangPref}
          options={[
            { value: 'AUTO', label: 'AUTO' },
            { value: 'de', label: 'DE' },
            { value: 'en', label: 'EN' },
          ]}
        />
        <p class="muted">
          {t(
            'AUTO nutzt die Browsersprache mit Deutsch als Rückfall. Die Wahl gilt pro Gerät.',
            'AUTO uses the browser language with German as fallback. The choice is per device.',
          )}
        </p>
      </Card>

      {!cfg ? (
        <Empty>{t('Lade…', 'Loading…')}</Empty>
      ) : (
        <>
          <Card title={t('Benachrichtigungssprache', 'Notification language')}>
            <Segment<'de' | 'en'>
              value={cfg.notificationLanguage}
              onChange={(v) => void patchConfig({ notificationLanguage: v })}
              options={[
                { value: 'de', label: 'DE' },
                { value: 'en', label: 'EN' },
              ]}
            />
            <p class="muted">
              {t(
                'Installationsweite Sprache für Telegram-/App-Benachrichtigungen.',
                'Installation-wide language for Telegram / app notifications.',
              )}
            </p>
          </Card>

          <Card title={t('Zeitzone', 'Timezone')}>
            <Field label={t('IANA-Zeitzone', 'IANA timezone')} hint="Europe/Berlin">
              <input
                value={cfg.timezone}
                onChange={(e) => void patchConfig({ timezone: (e.target as HTMLInputElement).value })}
              />
            </Field>
          </Card>

          <Card title="Dashboard">
            <p class="muted">
              {t(
                'Auch auf der HCU-Plugin-Konfigseite einstellbar. Der Port muss eindeutig sein und darf nicht mit anderen Plugins kollidieren.',
                'Also configurable on the HCU plugin config page. The port must be unique and must not collide with other plugins.',
              )}
            </p>
            <Toggle
              checked={cfg.dashboard.enabled}
              onChange={(v) => void patchConfig({ dashboard: { ...cfg.dashboard, enabled: v } })}
              label={t('Dashboard aktiviert', 'Dashboard enabled')}
            />
            <Field
              label={t('Port', 'Port')}
              hint={t(
                'Änderung startet das Dashboard neu — danach unter dem neuen Port erreichbar.',
                'Changing this restarts the dashboard — reachable under the new port afterwards.',
              )}
            >
              <input
                type="number"
                min={1}
                max={65535}
                value={cfg.dashboard.port}
                onChange={(e) => {
                  const p = Number((e.target as HTMLInputElement).value);
                  if (Number.isInteger(p) && p >= 1 && p <= 65535) {
                    void patchConfig({ dashboard: { ...cfg.dashboard, port: p } });
                  }
                }}
              />
            </Field>
          </Card>

          <AnalyticsCard />

          <Card title={t('Standard-Bundesländer', 'Default states')}>
            <p class="muted">
              {t(
                'Vorauswahl für neue Feiertags-Regeln.',
                'Pre-selected states for new holiday rules.',
              )}
            </p>
            <div class="states-grid">
              {BUNDESLAENDER.map((b) => {
                const on = cfg.defaultStates.includes(b.code as never);
                return (
                  <label key={b.code} class={`state-pill ${on ? 'is-on' : ''}`} title={t(b.de, b.en)}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        const next = on
                          ? cfg.defaultStates.filter((c) => c !== b.code)
                          : [...cfg.defaultStates, b.code as never];
                        void patchConfig({ defaultStates: next });
                      }}
                    />
                    {b.code}
                  </label>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </Panel>
  );
}
