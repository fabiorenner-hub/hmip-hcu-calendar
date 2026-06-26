import { signal } from '@preact/signals';

export type LangPref = 'AUTO' | 'de' | 'en';
export type Lang = 'de' | 'en';

const STORAGE_KEY = 'calendar.langPref';

function readPref(): LangPref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'de' || v === 'en' || v === 'AUTO') return v;
  } catch {
    // localStorage may be unavailable; fall back to AUTO.
  }
  return 'AUTO';
}

export const langPref = signal<LangPref>(readPref());

function resolve(pref: LangPref): Lang {
  if (pref === 'de' || pref === 'en') return pref;
  // AUTO: browser language with German as fallback.
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'de';
  return nav.toLowerCase().startsWith('en') ? 'en' : 'de';
}

/** The effective language, reactive to langPref. */
export const lang = signal<Lang>(resolve(langPref.value));

export function setLangPref(pref: LangPref): void {
  langPref.value = pref;
  lang.value = resolve(pref);
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Ignore persistence failures.
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang.value;
  }
}

/** Inline translation pair. Reactive via the lang signal. */
export function t(de: string, en: string): string {
  return lang.value === 'de' ? de : en;
}

/** Format a number using the active locale (DE comma / EN dot). */
export function fmtNum(n: number, digits = 0): string {
  return new Intl.NumberFormat(lang.value === 'de' ? 'de-DE' : 'en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** Format an ISO date string (YYYY-MM-DD) for display in 24h/locale style. */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat(lang.value === 'de' ? 'de-DE' : 'en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Translate a small set of server/engine strings at the render edge. */
const SERVER_MAP: Record<string, string> = {
  'Kein besonderer Tag': 'No special day',
  'Manuell eingeschaltet': 'Manually switched on',
  'Manuell ausgeschaltet': 'Manually switched off',
  'Invertiert: kein Treffer': 'Inverted: no match',
};

export function tServer(germanString: string): string {
  if (lang.value === 'de') return germanString;
  if (SERVER_MAP[germanString]) return SERVER_MAP[germanString]!;
  // Parametric: "N Tag(e) vor: X" / "N Tag(e) nach: X"
  const lead = /^(\d+) Tag\(e\) vor: (.*)$/.exec(germanString);
  if (lead) return `${lead[1]} day(s) before: ${lead[2]}`;
  const trail = /^(\d+) Tag\(e\) nach: (.*)$/.exec(germanString);
  if (trail) return `${trail[1]} day(s) after: ${trail[2]}`;
  return germanString;
}
