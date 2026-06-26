import type { JSX } from 'preact';
import { signal } from '@preact/signals';
import { api, type Diagnostics } from '../api.js';
import { t } from '../i18n.js';
import { Button, Card, Chip, Empty, Metric, Panel } from '../components.js';

const diag = signal<Diagnostics | null>(null);

async function load(): Promise<void> {
  try {
    diag.value = await api.diagnostics();
  } catch {
    diag.value = null;
  }
}

function stateTone(state: string): 'success' | 'warn' | 'danger' | 'muted' {
  if (state === 'connected') return 'success';
  if (state === 'connecting') return 'warn';
  if (state === 'error') return 'danger';
  return 'muted';
}

export function DiagnosticsTab(): JSX.Element {
  if (diag.value === null) void load();
  const d = diag.value;
  return (
    <Panel title={t('Diagnose', 'Diagnostics')} badge={d ? <Chip tone={stateTone(d.connect.state)}>{d.connect.state}</Chip> : undefined}>
      <Card>
        <Button onClick={load}>{t('Aktualisieren', 'Refresh')}</Button>
      </Card>
      {!d ? (
        <Empty>{t('Lade…', 'Loading…')}</Empty>
      ) : (
        <div class="grid grid--metrics">
          <Card>
            <Metric label={t('Connect-API', 'Connect API')} value={d.connect.enabled ? d.connect.state : t('deaktiviert', 'disabled')} />
          </Card>
          <Card>
            <Metric label={t('Heute', 'Today')} value={d.todayIso} hint={d.timezone} />
          </Card>
          <Card>
            <Metric label="Build" value={d.buildId} hint={`Node ${d.node}`} />
          </Card>
          <Card>
            <Metric label="Plugin ID" value={d.pluginId} />
          </Card>
          <Card>
            <Metric label={t('Laufzeit', 'Uptime')} value={`${d.uptimeSeconds}s`} />
          </Card>
        </div>
      )}
    </Panel>
  );
}
