import type { JSX } from 'preact';
import { signal } from '@preact/signals';
import { api, type NotificationMessage } from '../api.js';
import { config, patchConfig } from '../store.js';
import { lang, t } from '../i18n.js';
import { Button, Card, Chip, Empty, Field, Panel, Toggle } from '../components.js';

const messages = signal<NotificationMessage[] | null>(null);

async function loadMessages(): Promise<void> {
  try {
    const res = await api.notifications();
    messages.value = res.messages;
  } catch {
    messages.value = [];
  }
}

export function NotificationsTab(): JSX.Element {
  const cfg = config.value;
  if (messages.value === null) void loadMessages();

  return (
    <Panel
      title={t('Benachrichtigungen', 'Notifications')}
      intro={t('Optionaler Telegram-Versand bei Statuswechseln.', 'Optional Telegram delivery on state changes.')}
    >
      {!cfg ? (
        <Empty>{t('Lade…', 'Loading…')}</Empty>
      ) : (
        <>
          <Card title={t('Ereignisse', 'Events')}>
            <Toggle
              checked={cfg.notifyOn.dayStart}
              onChange={(v) => void patchConfig({ notifyOn: { ...cfg.notifyOn, dayStart: v } })}
              label={t('Wenn ein Tag aktiv wird', 'When a day becomes active')}
            />
            <Toggle
              checked={cfg.notifyOn.dayEnd}
              onChange={(v) => void patchConfig({ notifyOn: { ...cfg.notifyOn, dayEnd: v } })}
              label={t('Wenn ein Tag endet', 'When a day ends')}
            />
          </Card>

          <Card title="Telegram">
            <Toggle
              checked={cfg.telegram.enabled}
              onChange={(v) => void patchConfig({ telegram: { ...cfg.telegram, enabled: v } })}
              label={t('Telegram aktivieren', 'Enable Telegram')}
            />
            <Field label="Bot Token" hint={t('Wird maskiert gespeichert.', 'Stored masked.')}>
              <input
                type="password"
                value={cfg.telegram.botToken}
                onChange={(e) =>
                  void patchConfig({ telegram: { ...cfg.telegram, botToken: (e.target as HTMLInputElement).value } })
                }
              />
            </Field>
            <Field label="Chat ID">
              <input
                value={cfg.telegram.chatId}
                onChange={(e) =>
                  void patchConfig({ telegram: { ...cfg.telegram, chatId: (e.target as HTMLInputElement).value } })
                }
              />
            </Field>
          </Card>
        </>
      )}

      <Card title={t('Verlauf', 'History')}>
        <Button onClick={loadMessages}>{t('Aktualisieren', 'Refresh')}</Button>
        {messages.value && messages.value.length === 0 && (
          <Empty>{t('Noch keine Benachrichtigungen.', 'No notifications yet.')}</Empty>
        )}
        <ul class="msg-list">
          {messages.value?.map((m) => (
            <li key={m.id}>
              <div class="msg-list__head">
                <strong>{lang.value === 'de' ? m.titleDe : m.titleEn}</strong>
                <Chip tone={m.delivered ? 'success' : 'muted'}>
                  {m.delivered ? t('gesendet', 'sent') : t('lokal', 'local')}
                </Chip>
              </div>
              <span class="muted">{lang.value === 'de' ? m.bodyDe : m.bodyEn}</span>
            </li>
          ))}
        </ul>
      </Card>
    </Panel>
  );
}
