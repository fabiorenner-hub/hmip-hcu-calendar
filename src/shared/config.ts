import { z } from 'zod';

/**
 * The 16 German federal states (Bundesländer), ISO 3166-2:DE codes without
 * the "DE-" prefix. Used to select region specific public holidays.
 */
export const BUNDESLAND_CODES = [
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
] as const;

export const BundeslandSchema = z.enum(BUNDESLAND_CODES);
export type Bundesland = z.infer<typeof BundeslandSchema>;

/** A calendar date without time/zone, used by the pure engine. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

const dateRange = z.object({
  from: isoDate,
  to: isoDate,
});

/**
 * A single rule describing which calendar days should make a virtual device
 * switch "on". A calendar device is on when ANY of its rules match the day.
 */
export const SpecialDayRuleSchema = z.discriminatedUnion('kind', [
  // German public holidays for the selected states (nationwide holidays are
  // always included). states=[] means nationwide-only.
  z.object({
    kind: z.literal('germanHolidays'),
    states: z.array(BundeslandSchema).default([]),
  }),
  // Brückentage: a workday (Mon-Fri) sitting between a public holiday and the
  // weekend, computed from the holidays of the selected states.
  z.object({
    kind: z.literal('bridgeDays'),
    states: z.array(BundeslandSchema).default([]),
  }),
  // Saturdays and Sundays.
  z.object({ kind: z.literal('weekend') }),
  // Specific weekdays. 0 = Sunday ... 6 = Saturday.
  z.object({
    kind: z.literal('weekday'),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  }),
  // A recurring annual date, e.g. month=12 day=24 for every Dec 24th.
  z.object({
    kind: z.literal('fixedDate'),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  }),
  // A single, non-recurring calendar date.
  z.object({ kind: z.literal('singleDate'), date: isoDate }),
  // An inclusive date range, e.g. a vacation.
  z.object({ kind: z.literal('dateRange'), from: isoDate, to: isoDate }),
  // Nth weekday of a month, e.g. 2nd Sunday in May (Muttertag). n=-1 = last.
  z.object({
    kind: z.literal('nthWeekdayOfMonth'),
    month: z.number().int().min(1).max(12),
    weekday: z.number().int().min(0).max(6),
    n: z.number().int().min(-1).max(5).refine((v) => v !== 0, 'n must not be 0'),
  }),
  // A day relative to Easter Sunday, given as a signed offset in days.
  z.object({
    kind: z.literal('relativeToEaster'),
    offset: z.number().int().min(-200).max(200),
  }),
  // Manually maintained school holiday ranges (KMK data is not computable).
  z.object({
    kind: z.literal('schoolHolidays'),
    ranges: z.array(dateRange).default([]),
  }),
]);

export type SpecialDayRule = z.infer<typeof SpecialDayRuleSchema>;

/** Manual override forcing a device on/off, optionally until a given date. */
export const OverrideSchema = z.object({
  on: z.boolean(),
  /** ISO date (YYYY-MM-DD) after which the override is dropped. */
  until: isoDate.optional(),
});
export type Override = z.infer<typeof OverrideSchema>;

/**
 * A calendar maps to exactly one virtual SWITCH device exposed to the HCU.
 * Its `id` is stable and reused verbatim as the Connect API `deviceId`.
 */
export const CalendarSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean().default(true),
  nameDe: z.string().min(1),
  nameEn: z.string().min(1),
  rules: z.array(SpecialDayRuleSchema).default([]),
  /** When true the device is on when the day does NOT match any rule. */
  invert: z.boolean().default(false),
  /** Also switch on this many days before a matching day (e.g. eve of). */
  leadDays: z.number().int().min(0).max(31).default(0),
  /** Also switch on this many days after a matching day. */
  trailDays: z.number().int().min(0).max(31).default(0),
  /** Optional manual override that takes precedence over rule evaluation. */
  override: OverrideSchema.optional(),
});
export type Calendar = z.infer<typeof CalendarSchema>;

export const TelegramSchema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string().default(''),
  chatId: z.string().default(''),
});
export type TelegramConfig = z.infer<typeof TelegramSchema>;

export const UpdatesConfigSchema = z
  .object({
    // OTA is ON by default on the stable channel (auto-installs stable releases).
    mode: z.enum(['manual', 'auto']).default('auto'),
    channel: z.enum(['stable', 'experimental']).default('stable'),
    checkIntervalHours: z.number().int().min(1).max(168).default(6),
  })
  .default({});
export type UpdatesConfig = z.infer<typeof UpdatesConfigSchema>;

/** Central "HCU Plugin Analytics" endpoint used by default. */
export const DEFAULT_ANALYTICS_ENDPOINT = 'https://hcu.fabiorenner.de/ingest.php';

export const AnalyticsConfigSchema = z
  .object({
    // Anonymous usage statistics. ON by default, with a visible toggle in the
    // dashboard so users can switch it off at any time. Only pseudonymous
    // technical metadata is sent (see callHome.ts) — never PII.
    enabled: z.boolean().default(true),
    // Central analytics endpoint (self-hostable / overridable); empty → nothing is sent.
    endpoint: z.union([z.literal(''), z.string().url()]).default(DEFAULT_ANALYTICS_ENDPOINT),
    intervalHours: z.number().int().min(1).max(168).default(24),
    // Optional simple spam hurdle sent as the X-HPA-Ping-Secret header.
    pingSecret: z.string().optional(),
  })
  .default({});
export type AnalyticsConfig = z.infer<typeof AnalyticsConfigSchema>;

export const ConfigSchema = z.object({
  /** IANA timezone used to determine the local "today". */
  timezone: z.string().min(1).default('Europe/Berlin'),
  /** Installation-wide language used for outgoing notifications. */
  notificationLanguage: z.enum(['de', 'en']).default('de'),
  /** Convenience default used when creating new holiday calendars. */
  defaultStates: z.array(BundeslandSchema).default([]),
  calendars: z.array(CalendarSchema).default([]),
  /** Web dashboard settings, configurable from the HCU plugin config page. */
  dashboard: z
    .object({
      enabled: z.boolean().default(true),
      /** Unique TCP port for the dashboard. Must not collide with other plugins. */
      port: z.number().int().min(1).max(65535).default(8092),
    })
    .default({ enabled: true, port: 8092 }),
  telegram: TelegramSchema.default({ enabled: false, botToken: '', chatId: '' }),
  notifyOn: z
    .object({
      dayStart: z.boolean().default(true),
      dayEnd: z.boolean().default(false),
    })
    .default({ dayStart: true, dayEnd: false }),
  updates: UpdatesConfigSchema,
  analytics: AnalyticsConfigSchema,
});

export type Config = z.infer<typeof ConfigSchema>;

/** Parse unknown data into a Config, applying defaults and rejecting garbage. */
export function parseConfig(data: unknown): Config {
  return ConfigSchema.parse(data);
}

/** Mask secrets for safe exposure through the REST API / logs. */
export function maskConfig(config: Config): Config {
  return {
    ...config,
    telegram: {
      ...config.telegram,
      botToken: config.telegram.botToken ? '***' : '',
    },
  };
}

/**
 * Default configuration seeded on first start. Calendar ids are stable so the
 * derived Connect API deviceIds stay consistent across restarts/reinstalls.
 */
export function defaultConfig(): Config {
  return ConfigSchema.parse({
    timezone: 'Europe/Berlin',
    notificationLanguage: 'de',
    defaultStates: [],
    calendars: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        enabled: true,
        nameDe: 'Feiertag',
        nameEn: 'Public holiday',
        rules: [{ kind: 'germanHolidays', states: [] }],
      },
    ],
  });
}
