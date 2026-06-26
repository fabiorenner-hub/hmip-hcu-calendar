import type { JSX } from 'preact';
import { snapshot, api } from '../api.js';
import { fmtDate, t, tServer } from '../i18n.js';
import { Button, Card, Chip, Empty, Panel } from '../components.js';
import { loadConfig } from '../store.js';

function sourceTone(source: string): 'success' | 'info' | 'accent' | 'muted' {
  switch (source) {
    case 'rule':
      return 'success';
    case 'lead':
    case 'trail':
      return 'info';
    case 'override':
      return 'accent';
    default:
      return 'muted';
  }
}

export function DashboardTab(): JSX.Element {
  const snap = snapshot.value;
  if (!snap) {
    return (
      <Panel title={t('Übersicht', 'Overview')}>
        <Empty>{t('Lade Live-Status…', 'Loading live status…')}</Empty>
      </Panel>
    );
  }

  const activeCount = snap.devices.filter((d) => d.enabled && d.on).length;

  async function quickOverride(id: string, on: boolean): Promise<void> {
    await api.override(id, { on });
    await loadConfig();
  }

  async function clearOverride(id: string): Promise<void> {
    await api.override(id, { clear: true });
    await loadConfig();
  }

  return (
    <Panel
      title={t('Übersicht', 'Overview')}
      badge={`${activeCount}/${snap.devices.length} ${t('aktiv', 'active')}`}
      intro={t(
        `Heute ist ${fmtDate(snap.todayIso)}. Jeder Kalender steuert ein virtuelles An/Aus-Gerät in der HCU.`,
        `Today is ${fmtDate(snap.todayIso)}. Each calendar drives a virtual on/off device in the HCU.`,
      )}
    >
      {snap.devices.length === 0 && (
        <Empty>
          {t(
            'Noch keine Kalender angelegt. Lege im Tab „Kalender" einen an.',
            'No calendars yet. Create one in the "Calendars" tab.',
          )}
        </Empty>
      )}

      <div class="grid grid--cards">
        {snap.devices.map((dev) => (
          <Card key={dev.deviceId}>
            <div class="device__head">
              <span class="device__name">{t(dev.nameDe, dev.nameEn)}</span>
              <Chip tone={dev.on ? 'success' : 'muted'}>
                {dev.enabled ? (dev.on ? t('AN', 'ON') : t('AUS', 'OFF')) : t('deaktiviert', 'disabled')}
              </Chip>
            </div>
            <div class="device__reason">
              <Chip tone={sourceTone(dev.source)}>{tServer(dev.reasonDe)}</Chip>
              {dev.hasOverride && <Chip tone="warn">{t('Manuell', 'Override')}</Chip>}
            </div>

            {dev.upcoming.length > 0 && (
              <div class="device__upcoming">
                <span class="device__upcoming-label">{t('Demnächst', 'Upcoming')}</span>
                <ul>
                  {dev.upcoming.slice(0, 4).map((u) => (
                    <li key={u.dateIso}>
                      <span class="tnum">{fmtDate(u.dateIso)}</span>
                      <span class="muted"> · {tServer(u.labelDe) || t(u.labelDe, u.labelEn)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div class="device__actions">
              <Button variant="ghost" onClick={() => quickOverride(dev.deviceId, true)}>
                {t('An erzwingen', 'Force on')}
              </Button>
              <Button variant="ghost" onClick={() => quickOverride(dev.deviceId, false)}>
                {t('Aus erzwingen', 'Force off')}
              </Button>
              {dev.hasOverride && (
                <Button variant="danger" onClick={() => clearOverride(dev.deviceId)}>
                  {t('Override löschen', 'Clear override')}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </Panel>
  );
}
