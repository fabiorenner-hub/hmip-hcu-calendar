import type { JSX } from 'preact';
import { signal } from '@preact/signals';
import { api, type HolidayPreview } from '../api.js';
import { fmtDate, t } from '../i18n.js';
import { Button, Card, Chip, Empty, Field, Panel } from '../components.js';
import { BUNDESLAENDER } from '../constants.js';

const year = signal(new Date().getFullYear());
const states = signal<string[]>([]);
const result = signal<HolidayPreview[] | null>(null);
const loading = signal(false);
const error = signal<string | null>(null);

async function run(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.holidays(year.value, states.value);
    result.value = res.holidays;
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

export function HolidaysTab(): JSX.Element {
  if (result.value === null && !loading.value && !error.value) void run();

  return (
    <Panel
      title={t('Feiertage', 'Public holidays')}
      intro={t(
        'Vorschau der berechneten deutschen Feiertage. Bundesländer leer lassen für bundesweite Feiertage.',
        'Preview of the computed German public holidays. Leave states empty for nationwide holidays.',
      )}
    >
      <Card>
        <div class="row">
          <Field label={t('Jahr', 'Year')}>
            <input
              type="number"
              min={1900}
              max={2100}
              value={year.value}
              onInput={(e) => (year.value = Number((e.target as HTMLInputElement).value))}
            />
          </Field>
          <Button variant="primary" onClick={run}>
            {t('Aktualisieren', 'Refresh')}
          </Button>
        </div>
        <Field label={t('Bundesländer', 'States')}>
          <div class="states-grid">
            {BUNDESLAENDER.map((b) => {
              const on = states.value.includes(b.code);
              return (
                <label key={b.code} class={`state-pill ${on ? 'is-on' : ''}`} title={t(b.de, b.en)}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      states.value = on
                        ? states.value.filter((c) => c !== b.code)
                        : [...states.value, b.code];
                      void run();
                    }}
                  />
                  {b.code}
                </label>
              );
            })}
          </div>
        </Field>
      </Card>

      {loading.value && <Empty>{t('Lade…', 'Loading…')}</Empty>}
      {error.value && <Empty>{error.value}</Empty>}

      {result.value && result.value.length > 0 && (
        <Card title={`${result.value.length} ${t('Feiertage', 'holidays')} ${year.value}`}>
          <div class="table-scroll">
            <table class="table">
              <thead>
                <tr>
                  <th>{t('Datum', 'Date')}</th>
                  <th>{t('Name', 'Name')}</th>
                  <th>{t('Geltung', 'Scope')}</th>
                </tr>
              </thead>
              <tbody>
                {result.value.map((h) => (
                  <tr key={h.id + h.date}>
                    <td class="tnum">{fmtDate(h.date)}</td>
                    <td>{t(h.nameDe, h.nameEn)}</td>
                    <td>
                      {h.nationwide ? (
                        <Chip tone="success">{t('bundesweit', 'nationwide')}</Chip>
                      ) : (
                        <span class="muted">{h.states.join(', ')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Panel>
  );
}
