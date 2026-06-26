import type { Bundesland } from '../shared/config.js';
import { addDays, dayOfWeek, type LocalDate } from './dates.js';
import { easterSunday } from './easter.js';

export interface Holiday {
  /** Stable identifier of the holiday. */
  id: string;
  nameDe: string;
  nameEn: string;
  date: LocalDate;
  /** true when observed in every federal state. */
  nationwide: boolean;
  /** States observing this holiday (always all 16 when nationwide). */
  states: Bundesland[];
}

const ALL_STATES: Bundesland[] = [
  'BW',
  'BY',
  'BE',
  'BB',
  'HB',
  'HH',
  'HE',
  'MV',
  'NI',
  'NW',
  'RP',
  'SL',
  'SN',
  'ST',
  'SH',
  'TH',
];

/** Wednesday before Nov 23rd (Buß- und Bettag, observed in Saxony). */
function bussUndBettag(year: number): LocalDate {
  let cursor: LocalDate = { year, month: 11, day: 22 };
  while (dayOfWeek(cursor) !== 3 /* Wednesday */) {
    cursor = addDays(cursor, -1);
  }
  return cursor;
}

type DateFn = (year: number) => LocalDate;
type StatesFn = (year: number) => Bundesland[];

interface HolidayDef {
  id: string;
  nameDe: string;
  nameEn: string;
  date: DateFn;
  states: StatesFn;
}

const fixed = (month: number, day: number): DateFn => (year) => ({ year, month, day });
const easterOffset = (offset: number): DateFn => (year) => addDays(easterSunday(year), offset);
const allStates: StatesFn = () => ALL_STATES;
const fixedStates =
  (...states: Bundesland[]): StatesFn =>
  () => states;

/**
 * Definitions of German public holidays. Region specific entries encode the
 * year in which they became statutory where relevant. Statewide observance
 * only; municipality-level holidays (e.g. Mariä Himmelfahrt in parts of
 * Bavaria, Fronleichnam in parts of Saxony/Thuringia) are intentionally
 * excluded because they cannot be expressed by a single statewide flag.
 */
const HOLIDAY_DEFS: HolidayDef[] = [
  { id: 'neujahr', nameDe: 'Neujahr', nameEn: "New Year's Day", date: fixed(1, 1), states: allStates },
  {
    id: 'heiligeDreiKoenige',
    nameDe: 'Heilige Drei Könige',
    nameEn: 'Epiphany',
    date: fixed(1, 6),
    states: fixedStates('BW', 'BY', 'ST'),
  },
  {
    id: 'frauentag',
    nameDe: 'Internationaler Frauentag',
    nameEn: "International Women's Day",
    date: fixed(3, 8),
    states: (year) => {
      const out: Bundesland[] = [];
      if (year >= 2019) out.push('BE');
      if (year >= 2023) out.push('MV');
      return out;
    },
  },
  { id: 'karfreitag', nameDe: 'Karfreitag', nameEn: 'Good Friday', date: easterOffset(-2), states: allStates },
  {
    id: 'ostersonntag',
    nameDe: 'Ostersonntag',
    nameEn: 'Easter Sunday',
    date: easterOffset(0),
    states: fixedStates('BB'),
  },
  { id: 'ostermontag', nameDe: 'Ostermontag', nameEn: 'Easter Monday', date: easterOffset(1), states: allStates },
  { id: 'tagDerArbeit', nameDe: 'Tag der Arbeit', nameEn: 'Labour Day', date: fixed(5, 1), states: allStates },
  {
    id: 'christiHimmelfahrt',
    nameDe: 'Christi Himmelfahrt',
    nameEn: 'Ascension Day',
    date: easterOffset(39),
    states: allStates,
  },
  {
    id: 'pfingstsonntag',
    nameDe: 'Pfingstsonntag',
    nameEn: 'Whit Sunday',
    date: easterOffset(49),
    states: fixedStates('BB'),
  },
  {
    id: 'pfingstmontag',
    nameDe: 'Pfingstmontag',
    nameEn: 'Whit Monday',
    date: easterOffset(50),
    states: allStates,
  },
  {
    id: 'fronleichnam',
    nameDe: 'Fronleichnam',
    nameEn: 'Corpus Christi',
    date: easterOffset(60),
    states: fixedStates('BW', 'BY', 'HE', 'NW', 'RP', 'SL'),
  },
  {
    id: 'mariaeHimmelfahrt',
    nameDe: 'Mariä Himmelfahrt',
    nameEn: 'Assumption Day',
    date: fixed(8, 15),
    states: fixedStates('SL'),
  },
  {
    id: 'weltkindertag',
    nameDe: 'Weltkindertag',
    nameEn: "World Children's Day",
    date: fixed(9, 20),
    states: (year) => (year >= 2019 ? ['TH'] : []),
  },
  {
    id: 'tagDerDeutschenEinheit',
    nameDe: 'Tag der Deutschen Einheit',
    nameEn: 'German Unity Day',
    date: fixed(10, 3),
    states: allStates,
  },
  {
    id: 'reformationstag',
    nameDe: 'Reformationstag',
    nameEn: 'Reformation Day',
    date: fixed(10, 31),
    states: (year) => {
      const base: Bundesland[] = ['BB', 'MV', 'SN', 'ST', 'TH'];
      if (year >= 2018) base.push('HB', 'HH', 'NI', 'SH');
      return base;
    },
  },
  {
    id: 'allerheiligen',
    nameDe: 'Allerheiligen',
    nameEn: "All Saints' Day",
    date: fixed(11, 1),
    states: fixedStates('BW', 'BY', 'NW', 'RP', 'SL'),
  },
  {
    id: 'bussUndBettag',
    nameDe: 'Buß- und Bettag',
    nameEn: 'Day of Repentance and Prayer',
    date: bussUndBettag,
    states: fixedStates('SN'),
  },
  {
    id: 'ersterWeihnachtstag',
    nameDe: '1. Weihnachtstag',
    nameEn: 'Christmas Day',
    date: fixed(12, 25),
    states: allStates,
  },
  {
    id: 'zweiterWeihnachtstag',
    nameDe: '2. Weihnachtstag',
    nameEn: 'Boxing Day',
    date: fixed(12, 26),
    states: allStates,
  },
];

/** All German public holidays for a year, with per-state observance. */
export function germanHolidays(year: number): Holiday[] {
  return HOLIDAY_DEFS.map((def) => {
    const states = def.states(year);
    const nationwide = states.length === ALL_STATES.length;
    return {
      id: def.id,
      nameDe: def.nameDe,
      nameEn: def.nameEn,
      date: def.date(year),
      nationwide,
      states: nationwide ? [...ALL_STATES] : states,
    };
  }).filter((h) => h.states.length > 0);
}

/**
 * Holidays that apply for the given set of states. Nationwide holidays are
 * always included. An empty `states` array yields nationwide holidays only.
 */
export function holidaysForStates(year: number, states: readonly Bundesland[]): Holiday[] {
  const selected = new Set(states);
  return germanHolidays(year).filter(
    (h) => h.nationwide || h.states.some((s) => selected.has(s)),
  );
}
