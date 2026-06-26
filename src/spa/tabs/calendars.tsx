import type { JSX } from 'preact';
import { signal } from '@preact/signals';
import type { Calendar, SpecialDayRule } from '../../shared/config.js';
import { config, saveConfig, saving } from '../store.js';
import { t } from '../i18n.js';
import { Button, Card, Chip, Empty, Field, Panel, Toggle } from '../components.js';
import { BUNDESLAENDER, RULE_KINDS, WEEKDAYS, uuid, type RuleKind } from '../constants.js';

/** Local editable draft of the calendars; seeded from the saved config. */
const draft = signal<Calendar[] | null>(null);
const dirty = signal(false);

function seed(): Calendar[] {
  return JSON.parse(JSON.stringify(config.value?.calendars ?? [])) as Calendar[];
}

function ensureDraft(): Calendar[] {
  if (draft.value === null) draft.value = seed();
  return draft.value;
}

function update(next: Calendar[]): void {
  draft.value = next;
  dirty.value = true;
}

function defaultRule(kind: RuleKind): SpecialDayRule {
  switch (kind) {
    case 'germanHolidays':
      return { kind, states: config.value?.defaultStates ?? [] };
    case 'bridgeDays':
      return { kind, states: config.value?.defaultStates ?? [] };
    case 'weekend':
      return { kind };
    case 'weekday':
      return { kind, weekdays: [1] };
    case 'fixedDate':
      return { kind, month: 12, day: 24 };
    case 'singleDate':
      return { kind, date: new Date().toISOString().slice(0, 10) };
    case 'dateRange':
      return { kind, from: new Date().toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) };
    case 'nthWeekdayOfMonth':
      return { kind, month: 5, weekday: 0, n: 2 };
    case 'relativeToEaster':
      return { kind, offset: -48 };
    case 'schoolHolidays':
      return { kind, ranges: [] };
  }
}

function StatesPicker(props: { value: string[]; onChange: (v: string[]) => void }): JSX.Element {
  return (
    <div class="states-grid">
      {BUNDESLAENDER.map((b) => {
        const on = props.value.includes(b.code);
        return (
          <label key={b.code} class={`state-pill ${on ? 'is-on' : ''}`} title={t(b.de, b.en)}>
            <input
              type="checkbox"
              checked={on}
              onChange={() =>
                props.onChange(on ? props.value.filter((c) => c !== b.code) : [...props.value, b.code])
              }
            />
            {b.code}
          </label>
        );
      })}
    </div>
  );
}

function RuleEditor(props: {
  rule: SpecialDayRule;
  onChange: (r: SpecialDayRule) => void;
}): JSX.Element {
  const r = props.rule;
  switch (r.kind) {
    case 'germanHolidays':
    case 'bridgeDays':
      return (
        <div>
          <Field label={t('Bundesländer (leer = bundesweit)', 'States (empty = nationwide)')}>
            <StatesPicker value={r.states} onChange={(states) => props.onChange({ ...r, states } as SpecialDayRule)} />
          </Field>
        </div>
      );
    case 'weekend':
      return <p class="muted">{t('Samstag und Sonntag.', 'Saturday and Sunday.')}</p>;
    case 'weekday':
      return (
        <div class="weekday-grid">
          {WEEKDAYS.map((w) => {
            const on = r.weekdays.includes(w.value);
            return (
              <label key={w.value} class={`state-pill ${on ? 'is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    props.onChange({
                      ...r,
                      weekdays: on ? r.weekdays.filter((d) => d !== w.value) : [...r.weekdays, w.value],
                    })
                  }
                />
                {t(w.de, w.en)}
              </label>
            );
          })}
        </div>
      );
    case 'fixedDate':
      return (
        <div class="row">
          <Field label={t('Monat', 'Month')}>
            <input
              type="number"
              min={1}
              max={12}
              value={r.month}
              onInput={(e) => props.onChange({ ...r, month: Number((e.target as HTMLInputElement).value) })}
            />
          </Field>
          <Field label={t('Tag', 'Day')}>
            <input
              type="number"
              min={1}
              max={31}
              value={r.day}
              onInput={(e) => props.onChange({ ...r, day: Number((e.target as HTMLInputElement).value) })}
            />
          </Field>
        </div>
      );
    case 'singleDate':
      return (
        <Field label={t('Datum', 'Date')}>
          <input
            type="date"
            value={r.date}
            onInput={(e) => props.onChange({ ...r, date: (e.target as HTMLInputElement).value })}
          />
        </Field>
      );
    case 'dateRange':
      return (
        <div class="row">
          <Field label={t('Von', 'From')}>
            <input
              type="date"
              value={r.from}
              onInput={(e) => props.onChange({ ...r, from: (e.target as HTMLInputElement).value })}
            />
          </Field>
          <Field label={t('Bis', 'To')}>
            <input
              type="date"
              value={r.to}
              onInput={(e) => props.onChange({ ...r, to: (e.target as HTMLInputElement).value })}
            />
          </Field>
        </div>
      );
    case 'nthWeekdayOfMonth':
      return (
        <div class="row">
          <Field label={t('Monat', 'Month')}>
            <input
              type="number"
              min={1}
              max={12}
              value={r.month}
              onInput={(e) => props.onChange({ ...r, month: Number((e.target as HTMLInputElement).value) })}
            />
          </Field>
          <Field label={t('Wochentag', 'Weekday')}>
            <select
              value={r.weekday}
              onChange={(e) => props.onChange({ ...r, weekday: Number((e.target as HTMLSelectElement).value) })}
            >
              {WEEKDAYS.map((w) => (
                <option key={w.value} value={w.value}>
                  {t(w.de, w.en)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('Vorkommen', 'Occurrence')}>
            <select
              value={r.n}
              onChange={(e) => props.onChange({ ...r, n: Number((e.target as HTMLSelectElement).value) })}
            >
              {[1, 2, 3, 4, 5, -1].map((n) => (
                <option key={n} value={n}>
                  {n === -1 ? t('Letzter', 'Last') : `${n}.`}
                </option>
              ))}
            </select>
          </Field>
        </div>
      );
    case 'relativeToEaster':
      return (
        <Field
          label={t('Tage relativ zu Ostersonntag', 'Days relative to Easter Sunday')}
          hint={t('z. B. -48 Rosenmontag, -2 Karfreitag, +1 Ostermontag', 'e.g. -48 Rose Monday, -2 Good Friday, +1 Easter Monday')}
        >
          <input
            type="number"
            min={-200}
            max={200}
            value={r.offset}
            onInput={(e) => props.onChange({ ...r, offset: Number((e.target as HTMLInputElement).value) })}
          />
        </Field>
      );
    case 'schoolHolidays':
      return (
        <div>
          {r.ranges.length === 0 && <p class="muted">{t('Keine Zeiträume.', 'No ranges.')}</p>}
          {r.ranges.map((range, i) => (
            <div class="row" key={i}>
              <input
                type="date"
                value={range.from}
                onInput={(e) => {
                  const ranges = r.ranges.slice();
                  ranges[i] = { ...range, from: (e.target as HTMLInputElement).value };
                  props.onChange({ ...r, ranges });
                }}
              />
              <input
                type="date"
                value={range.to}
                onInput={(e) => {
                  const ranges = r.ranges.slice();
                  ranges[i] = { ...range, to: (e.target as HTMLInputElement).value };
                  props.onChange({ ...r, ranges });
                }}
              />
              <Button
                variant="danger"
                onClick={() => props.onChange({ ...r, ranges: r.ranges.filter((_, j) => j !== i) })}
              >
                ✕
              </Button>
            </div>
          ))}
          <Button
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              props.onChange({ ...r, ranges: [...r.ranges, { from: today, to: today }] });
            }}
          >
            {t('Zeitraum hinzufügen', 'Add range')}
          </Button>
        </div>
      );
  }
}

function CalendarCard(props: { cal: Calendar; onChange: (c: Calendar) => void; onDelete: () => void }): JSX.Element {
  const { cal } = props;
  const setRule = (i: number, rule: SpecialDayRule): void => {
    const rules = cal.rules.slice();
    rules[i] = rule;
    props.onChange({ ...cal, rules });
  };
  return (
    <Card>
      <div class="row row--head">
        <Field label={t('Name (DE)', 'Name (DE)')}>
          <input value={cal.nameDe} onInput={(e) => props.onChange({ ...cal, nameDe: (e.target as HTMLInputElement).value })} />
        </Field>
        <Field label={t('Name (EN)', 'Name (EN)')}>
          <input value={cal.nameEn} onInput={(e) => props.onChange({ ...cal, nameEn: (e.target as HTMLInputElement).value })} />
        </Field>
      </div>

      <div class="row row--opts">
        <Toggle checked={cal.enabled} onChange={(v) => props.onChange({ ...cal, enabled: v })} label={t('Aktiv', 'Enabled')} />
        <Toggle checked={cal.invert} onChange={(v) => props.onChange({ ...cal, invert: v })} label={t('Invertieren', 'Invert')} />
        <Field label={t('Tage davor', 'Lead days')}>
          <input
            type="number"
            min={0}
            max={31}
            value={cal.leadDays}
            onInput={(e) => props.onChange({ ...cal, leadDays: Number((e.target as HTMLInputElement).value) })}
          />
        </Field>
        <Field label={t('Tage danach', 'Trail days')}>
          <input
            type="number"
            min={0}
            max={31}
            value={cal.trailDays}
            onInput={(e) => props.onChange({ ...cal, trailDays: Number((e.target as HTMLInputElement).value) })}
          />
        </Field>
      </div>

      <h3 class="subhead">{t('Regeln (ODER-verknüpft)', 'Rules (matched with OR)')}</h3>
      {cal.rules.map((rule, i) => (
        <div class="rule" key={i}>
          <div class="rule__head">
            <Chip tone="accent">{t(RULE_KINDS.find((k) => k.kind === rule.kind)?.de ?? rule.kind, RULE_KINDS.find((k) => k.kind === rule.kind)?.en ?? rule.kind)}</Chip>
            <Button variant="danger" onClick={() => props.onChange({ ...cal, rules: cal.rules.filter((_, j) => j !== i) })}>
              {t('Regel entfernen', 'Remove rule')}
            </Button>
          </div>
          <RuleEditor rule={rule} onChange={(r) => setRule(i, r)} />
        </div>
      ))}

      <div class="row">
        <select
          onChange={(e) => {
            const kind = (e.target as HTMLSelectElement).value as RuleKind;
            if (!kind) return;
            props.onChange({ ...cal, rules: [...cal.rules, defaultRule(kind)] });
            (e.target as HTMLSelectElement).value = '';
          }}
        >
          <option value="">{t('+ Regel hinzufügen…', '+ Add rule…')}</option>
          {RULE_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {t(k.de, k.en)}
            </option>
          ))}
        </select>
        <Button variant="danger" onClick={props.onDelete}>
          {t('Kalender löschen', 'Delete calendar')}
        </Button>
      </div>
    </Card>
  );
}

export function CalendarsTab(): JSX.Element {
  if (!config.value) {
    return (
      <Panel title={t('Kalender', 'Calendars')}>
        <Empty>{t('Lade Konfiguration…', 'Loading configuration…')}</Empty>
      </Panel>
    );
  }
  const calendars = ensureDraft();

  const addCalendar = (): void => {
    update([
      ...calendars,
      {
        id: uuid(),
        enabled: true,
        nameDe: t('Neuer Kalender', 'New calendar'),
        nameEn: t('Neuer Kalender', 'New calendar'),
        rules: [],
        invert: false,
        leadDays: 0,
        trailDays: 0,
      },
    ]);
  };

  const save = async (): Promise<void> => {
    if (!config.value) return;
    const ok = await saveConfig({ ...config.value, calendars });
    if (ok) {
      dirty.value = false;
      draft.value = seed();
    }
  };

  return (
    <Panel
      title={t('Kalender', 'Calendars')}
      badge={`${calendars.length} ${t('Geräte', 'devices')}`}
      intro={t(
        'Jeder Kalender wird als virtuelles An/Aus-Gerät in der HCU sichtbar. Nach dem Speichern in HCUweb die Geräte-Suche des Plugins erneut starten, um neue Geräte aufzunehmen.',
        'Each calendar becomes a virtual on/off device in the HCU. After saving, re-run the plugin device discovery in HCUweb to include new devices.',
      )}
    >
      <div class="sticky-actions">
        <Button variant="primary" onClick={addCalendar}>
          {t('+ Kalender', '+ Calendar')}
        </Button>
        <Button variant="primary" onClick={save} disabled={!dirty.value || saving.value}>
          {saving.value ? t('Speichere…', 'Saving…') : dirty.value ? t('Speichern', 'Save') : t('Gespeichert', 'Saved')}
        </Button>
        {dirty.value && (
          <Button
            variant="ghost"
            onClick={() => {
              draft.value = seed();
              dirty.value = false;
            }}
          >
            {t('Verwerfen', 'Discard')}
          </Button>
        )}
      </div>

      {calendars.length === 0 && (
        <Empty>{t('Noch keine Kalender. Lege oben einen an.', 'No calendars yet. Add one above.')}</Empty>
      )}

      {calendars.map((cal, i) => (
        <CalendarCard
          key={cal.id}
          cal={cal}
          onChange={(c) => {
            const next = calendars.slice();
            next[i] = c;
            update(next);
          }}
          onDelete={() => update(calendars.filter((_, j) => j !== i))}
        />
      ))}
    </Panel>
  );
}
