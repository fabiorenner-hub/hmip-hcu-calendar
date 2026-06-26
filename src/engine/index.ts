import type { Calendar, Config } from '../shared/config.js';
import { addDays, toIso, type LocalDate } from './dates.js';
import { evaluateCalendar, matchAny, type EvaluationSource } from './specialDays.js';

export * from './dates.js';
export * from './easter.js';
export * from './holidays.js';
export * from './specialDays.js';

export interface UpcomingMatch {
  dateIso: string;
  labelDe: string;
  labelEn: string;
  daysAway: number;
}

export interface DeviceSnapshot {
  deviceId: string;
  nameDe: string;
  nameEn: string;
  enabled: boolean;
  on: boolean;
  source: EvaluationSource;
  reasonDe: string;
  reasonEn: string;
  hasOverride: boolean;
  upcoming: UpcomingMatch[];
}

export interface Snapshot {
  version: number;
  todayIso: string;
  timezone: string;
  devices: DeviceSnapshot[];
}

/** Look ahead this many days when computing the "upcoming matches" preview. */
const DEFAULT_HORIZON_DAYS = 90;

function upcomingMatches(cal: Calendar, today: LocalDate, horizon: number): UpcomingMatch[] {
  const out: UpcomingMatch[] = [];
  for (let k = 0; k <= horizon && out.length < 8; k++) {
    const date = addDays(today, k);
    const m = matchAny(cal.rules, date);
    if (m) {
      out.push({ dateIso: toIso(date), labelDe: m.labelDe, labelEn: m.labelEn, daysAway: k });
    }
  }
  return out;
}

/**
 * Build a deterministic, versioned snapshot of every calendar device for the
 * given local date. Pure: identical inputs yield identical output.
 */
export function buildSnapshot(
  config: Config,
  today: LocalDate,
  version: number,
  horizon: number = DEFAULT_HORIZON_DAYS,
): Snapshot {
  const devices: DeviceSnapshot[] = config.calendars.map((cal) => {
    const evalResult = evaluateCalendar(cal, today);
    return {
      deviceId: cal.id,
      nameDe: cal.nameDe,
      nameEn: cal.nameEn,
      enabled: cal.enabled,
      on: cal.enabled ? evalResult.on : false,
      source: evalResult.source,
      reasonDe: evalResult.reasonDe,
      reasonEn: evalResult.reasonEn,
      hasOverride: cal.override !== undefined,
      upcoming: upcomingMatches(cal, today, horizon),
    };
  });

  return {
    version,
    todayIso: toIso(today),
    timezone: config.timezone,
    devices,
  };
}
