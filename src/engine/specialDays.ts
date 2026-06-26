import type { Bundesland, Calendar, SpecialDayRule } from '../shared/config.js';
import {
  addDays,
  dayOfWeek,
  diffDays,
  fromIso,
  isSameDate,
  isWithin,
  nthWeekdayOfMonth,
  toIso,
  type LocalDate,
} from './dates.js';
import { easterSunday } from './easter.js';
import { holidaysForStates } from './holidays.js';

/**
 * Brückentage for a year: working days (Mon-Fri) bridging a public holiday and
 * the weekend. A holiday on Tuesday makes the preceding Monday a bridge day; a
 * holiday on Thursday makes the following Friday a bridge day. Bridge days that
 * are themselves holidays are excluded.
 */
export function bridgeDays(year: number, states: readonly Bundesland[]): LocalDate[] {
  const holidays = holidaysForStates(year, states);
  const holidaySet = new Set(holidays.map((h) => toIso(h.date)));
  const out: LocalDate[] = [];
  for (const h of holidays) {
    const dow = dayOfWeek(h.date);
    if (dow === 2 /* Tue */) {
      const candidate = addDays(h.date, -1); // Monday
      if (!holidaySet.has(toIso(candidate))) out.push(candidate);
    } else if (dow === 4 /* Thu */) {
      const candidate = addDays(h.date, 1); // Friday
      if (!holidaySet.has(toIso(candidate))) out.push(candidate);
    }
  }
  // De-duplicate.
  const seen = new Set<string>();
  return out.filter((d) => {
    const k = toIso(d);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface RuleMatch {
  kind: SpecialDayRule['kind'];
  labelDe: string;
  labelEn: string;
}

const KIND_LABELS: Record<SpecialDayRule['kind'], { de: string; en: string }> = {
  germanHolidays: { de: 'Feiertag', en: 'Public holiday' },
  bridgeDays: { de: 'Brückentag', en: 'Bridge day' },
  weekend: { de: 'Wochenende', en: 'Weekend' },
  weekday: { de: 'Wochentag', en: 'Weekday' },
  fixedDate: { de: 'Jährliches Datum', en: 'Annual date' },
  singleDate: { de: 'Einzeltermin', en: 'Single date' },
  dateRange: { de: 'Zeitraum', en: 'Date range' },
  nthWeekdayOfMonth: { de: 'Wochentag im Monat', en: 'Weekday of month' },
  relativeToEaster: { de: 'Relativ zu Ostern', en: 'Relative to Easter' },
  schoolHolidays: { de: 'Schulferien', en: 'School holidays' },
};

/** Evaluate a single rule against a date, returning a match descriptor or null. */
export function matchRule(rule: SpecialDayRule, date: LocalDate): RuleMatch | null {
  const label = KIND_LABELS[rule.kind];
  const ok = (de = label.de, en = label.en): RuleMatch => ({ kind: rule.kind, labelDe: de, labelEn: en });

  switch (rule.kind) {
    case 'germanHolidays': {
      const hit = holidaysForStates(date.year, rule.states).find((h) => isSameDate(h.date, date));
      return hit ? ok(hit.nameDe, hit.nameEn) : null;
    }
    case 'bridgeDays': {
      const hit = bridgeDays(date.year, rule.states).some((d) => isSameDate(d, date));
      return hit ? ok() : null;
    }
    case 'weekend': {
      const dow = dayOfWeek(date);
      return dow === 0 || dow === 6 ? ok() : null;
    }
    case 'weekday': {
      return rule.weekdays.includes(dayOfWeek(date)) ? ok() : null;
    }
    case 'fixedDate': {
      return date.month === rule.month && date.day === rule.day ? ok() : null;
    }
    case 'singleDate': {
      return isSameDate(fromIso(rule.date), date) ? ok() : null;
    }
    case 'dateRange': {
      return isWithin(date, fromIso(rule.from), fromIso(rule.to)) ? ok() : null;
    }
    case 'nthWeekdayOfMonth': {
      if (date.month !== rule.month) return null;
      const target = nthWeekdayOfMonth(date.year, rule.month, rule.weekday, rule.n);
      return target && isSameDate(target, date) ? ok() : null;
    }
    case 'relativeToEaster': {
      const target = addDays(easterSunday(date.year), rule.offset);
      return isSameDate(target, date) ? ok() : null;
    }
    case 'schoolHolidays': {
      const hit = rule.ranges.some((r) => isWithin(date, fromIso(r.from), fromIso(r.to)));
      return hit ? ok() : null;
    }
    default: {
      // Exhaustiveness guard.
      const _never: never = rule;
      return _never;
    }
  }
}

/** First matching rule for a date, or null. */
export function matchAny(rules: SpecialDayRule[], date: LocalDate): RuleMatch | null {
  for (const rule of rules) {
    const m = matchRule(rule, date);
    if (m) return m;
  }
  return null;
}

export type EvaluationSource = 'override' | 'rule' | 'lead' | 'trail' | 'inverted' | 'none';

export interface CalendarEvaluation {
  /** Final on/off state of the virtual device. */
  on: boolean;
  /** Whether a rule matches the evaluated day directly (ignoring lead/trail/invert). */
  matchedToday: boolean;
  source: EvaluationSource;
  reasonDe: string;
  reasonEn: string;
}

function overrideActive(cal: Calendar, date: LocalDate): boolean {
  if (!cal.override) return false;
  if (!cal.override.until) return true;
  return diffDays(fromIso(cal.override.until), date) >= 0;
}

/**
 * Evaluate a calendar for a date, honouring manual overrides, lead/trail days
 * and inversion. Returns the resulting device state plus a localized reason
 * for transparency in the UI.
 */
export function evaluateCalendar(cal: Calendar, date: LocalDate): CalendarEvaluation {
  if (overrideActive(cal, date)) {
    return {
      on: cal.override!.on,
      matchedToday: false,
      source: 'override',
      reasonDe: cal.override!.on ? 'Manuell eingeschaltet' : 'Manuell ausgeschaltet',
      reasonEn: cal.override!.on ? 'Manually switched on' : 'Manually switched off',
    };
  }

  const today = matchAny(cal.rules, date);
  let source: EvaluationSource = 'none';
  let reasonDe = 'Kein besonderer Tag';
  let reasonEn = 'No special day';

  if (today) {
    source = 'rule';
    reasonDe = today.labelDe;
    reasonEn = today.labelEn;
  } else {
    // Lead: a matching day lies within the next `leadDays` days.
    for (let k = 1; k <= cal.leadDays && source === 'none'; k++) {
      const m = matchAny(cal.rules, addDays(date, k));
      if (m) {
        source = 'lead';
        reasonDe = `${k} Tag(e) vor: ${m.labelDe}`;
        reasonEn = `${k} day(s) before: ${m.labelEn}`;
      }
    }
    // Trail: a matching day lies within the previous `trailDays` days.
    for (let k = 1; k <= cal.trailDays && source === 'none'; k++) {
      const m = matchAny(cal.rules, addDays(date, -k));
      if (m) {
        source = 'trail';
        reasonDe = `${k} Tag(e) nach: ${m.labelDe}`;
        reasonEn = `${k} day(s) after: ${m.labelEn}`;
      }
    }
  }

  const matched = source !== 'none';
  let on = matched;
  if (cal.invert) {
    on = !matched;
    if (!matched) {
      source = 'inverted';
      reasonDe = 'Invertiert: kein Treffer';
      reasonEn = 'Inverted: no match';
    }
  }

  return { on, matchedToday: today !== null, source, reasonDe, reasonEn };
}
