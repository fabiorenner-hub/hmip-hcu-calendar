// Static, dependency-free copies used by the UI (avoids bundling zod).

export const BUNDESLAENDER: { code: string; de: string; en: string }[] = [
  { code: 'BW', de: 'Baden-Württemberg', en: 'Baden-Württemberg' },
  { code: 'BY', de: 'Bayern', en: 'Bavaria' },
  { code: 'BE', de: 'Berlin', en: 'Berlin' },
  { code: 'BB', de: 'Brandenburg', en: 'Brandenburg' },
  { code: 'HB', de: 'Bremen', en: 'Bremen' },
  { code: 'HH', de: 'Hamburg', en: 'Hamburg' },
  { code: 'HE', de: 'Hessen', en: 'Hesse' },
  { code: 'MV', de: 'Mecklenburg-Vorpommern', en: 'Mecklenburg-Vorpommern' },
  { code: 'NI', de: 'Niedersachsen', en: 'Lower Saxony' },
  { code: 'NW', de: 'Nordrhein-Westfalen', en: 'North Rhine-Westphalia' },
  { code: 'RP', de: 'Rheinland-Pfalz', en: 'Rhineland-Palatinate' },
  { code: 'SL', de: 'Saarland', en: 'Saarland' },
  { code: 'SN', de: 'Sachsen', en: 'Saxony' },
  { code: 'ST', de: 'Sachsen-Anhalt', en: 'Saxony-Anhalt' },
  { code: 'SH', de: 'Schleswig-Holstein', en: 'Schleswig-Holstein' },
  { code: 'TH', de: 'Thüringen', en: 'Thuringia' },
];

export const WEEKDAYS: { value: number; de: string; en: string }[] = [
  { value: 1, de: 'Mo', en: 'Mon' },
  { value: 2, de: 'Di', en: 'Tue' },
  { value: 3, de: 'Mi', en: 'Wed' },
  { value: 4, de: 'Do', en: 'Thu' },
  { value: 5, de: 'Fr', en: 'Fri' },
  { value: 6, de: 'Sa', en: 'Sat' },
  { value: 0, de: 'So', en: 'Sun' },
];

export type RuleKind =
  | 'germanHolidays'
  | 'bridgeDays'
  | 'weekend'
  | 'weekday'
  | 'fixedDate'
  | 'singleDate'
  | 'dateRange'
  | 'nthWeekdayOfMonth'
  | 'relativeToEaster'
  | 'schoolHolidays';

export const RULE_KINDS: { kind: RuleKind; de: string; en: string }[] = [
  { kind: 'germanHolidays', de: 'Feiertage (DE)', en: 'Public holidays (DE)' },
  { kind: 'bridgeDays', de: 'Brückentage', en: 'Bridge days' },
  { kind: 'weekday', de: 'Wochentage', en: 'Weekdays' },
  { kind: 'fixedDate', de: 'Jährliches Datum', en: 'Annual date' },
  { kind: 'singleDate', de: 'Einzeltermin', en: 'Single date' },
  { kind: 'dateRange', de: 'Zeitraum', en: 'Date range' },
  { kind: 'nthWeekdayOfMonth', de: 'n-ter Wochentag im Monat', en: 'Nth weekday of month' },
  { kind: 'relativeToEaster', de: 'Relativ zu Ostern', en: 'Relative to Easter' },
  { kind: 'schoolHolidays', de: 'Schulferien (manuell)', en: 'School holidays (manual)' },
];

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback for very old browsers.
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/[x]/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}
