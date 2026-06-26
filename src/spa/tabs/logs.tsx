import type { JSX } from 'preact';
import { signal } from '@preact/signals';
import { api, type ConnectLogEntry } from '../api.js';
import { t } from '../i18n.js';
import { Button, Card, Chip, Empty, Panel } from '../components.js';

const entries = signal<ConnectLogEntry[] | null>(null);

async function load(): Promise<void> {
  try {
    const res = await api.connectLog();
    entries.value = res.entries;
  } catch {
    entries.value = [];
  }
}

function dirTone(dir: string): 'info' | 'accent' | 'muted' {
  if (dir === 'in') return 'info';
  if (dir === 'out') return 'accent';
  return 'muted';
}

/** Build a single .txt with all /api/* responses + browser info (360° export). */
async function exportAll(): Promise<void> {
  const endpoints = ['state', 'config', 'diagnostics', 'connect/log', 'notifications'] as const;
  const lines: string[] = [];
  lines.push('# hmip-hcu-calendar — 360 export', new Date().toISOString(), '');
  for (const ep of endpoints) {
    lines.push(`## /api/${ep}`);
    try {
      const res = await fetch(`/api/${ep}`);
      lines.push(await res.text());
    } catch (err) {
      lines.push(`ERROR: ${String(err)}`);
    }
    lines.push('');
  }
  lines.push('## browser');
  lines.push(
    JSON.stringify(
      {
        userAgent: navigator.userAgent,
        language: navigator.language,
        languages: navigator.languages,
        platform: navigator.platform,
        screen: { w: screen.width, h: screen.height },
        viewport: { w: window.innerWidth, h: window.innerHeight },
        url: location.href,
      },
      null,
      2,
    ),
  );
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `calendar-debug-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function LogsTab(): JSX.Element {
  if (entries.value === null) void load();
  return (
    <Panel title={t('Logs & Debug', 'Logs & Debug')} intro={t('Connect-API-Nachrichtenverlauf und Komplett-Export.', 'Connect API message log and full export.')}>
      <Card>
        <div class="row">
          <Button onClick={load}>{t('Aktualisieren', 'Refresh')}</Button>
          <Button variant="primary" onClick={exportAll}>
            {t('Alle Informationen', 'All information')}
          </Button>
        </div>
      </Card>

      {entries.value && entries.value.length === 0 && <Empty>{t('Keine Einträge.', 'No entries.')}</Empty>}

      {entries.value && entries.value.length > 0 && (
        <Card>
          <div class="table-scroll">
            <table class="table table--log">
              <thead>
                <tr>
                  <th>{t('Zeit', 'Time')}</th>
                  <th>{t('Richtung', 'Dir')}</th>
                  <th>{t('Typ', 'Type')}</th>
                  <th>{t('Detail', 'Detail')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.value
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <tr key={i}>
                      <td class="tnum">{e.ts.slice(11, 19)}</td>
                      <td>
                        <Chip tone={dirTone(e.dir)}>{e.dir}</Chip>
                      </td>
                      <td>{e.type}</td>
                      <td class="muted">{e.detail ?? ''}</td>
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
