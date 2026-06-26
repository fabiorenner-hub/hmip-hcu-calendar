import type { TelegramConfig } from '../shared/config.js';

export interface NotificationMessage {
  id: string;
  ts: string;
  titleDe: string;
  titleEn: string;
  bodyDe: string;
  bodyEn: string;
  delivered: boolean;
}

export interface NotificationInput {
  titleDe: string;
  titleEn: string;
  bodyDe: string;
  bodyEn: string;
  /** Stable key used to suppress duplicate notifications. */
  dedupeKey: string;
}

const MAX_MESSAGES = 100;

/**
 * Stores recent notifications and optionally forwards them to Telegram in the
 * installation-wide notification language. De-duplicates by key so the same
 * day transition is never reported twice.
 */
export class NotificationService {
  private readonly messages: NotificationMessage[] = [];
  private readonly seen = new Set<string>();

  constructor(
    private getLanguage: () => 'de' | 'en',
    private getTelegram: () => TelegramConfig,
  ) {}

  getMessages(): NotificationMessage[] {
    return [...this.messages].reverse();
  }

  /** Emit a notification unless an identical one was already sent. */
  async notify(input: NotificationInput): Promise<void> {
    if (this.seen.has(input.dedupeKey)) return;
    this.seen.add(input.dedupeKey);
    // Bound the dedupe set so it cannot grow without limit.
    if (this.seen.size > 500) {
      this.seen.clear();
      this.seen.add(input.dedupeKey);
    }

    const msg: NotificationMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      titleDe: input.titleDe,
      titleEn: input.titleEn,
      bodyDe: input.bodyDe,
      bodyEn: input.bodyEn,
      delivered: false,
    };
    this.messages.push(msg);
    if (this.messages.length > MAX_MESSAGES) {
      this.messages.splice(0, this.messages.length - MAX_MESSAGES);
    }

    msg.delivered = await this.sendTelegram(msg);
  }

  private async sendTelegram(msg: NotificationMessage): Promise<boolean> {
    const cfg = this.getTelegram();
    if (!cfg.enabled || !cfg.botToken || !cfg.chatId) return false;
    const lang = this.getLanguage();
    const title = lang === 'de' ? msg.titleDe : msg.titleEn;
    const body = lang === 'de' ? msg.bodyDe : msg.bodyEn;
    const text = `${title}\n${body}`;
    try {
      const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: cfg.chatId, text }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
