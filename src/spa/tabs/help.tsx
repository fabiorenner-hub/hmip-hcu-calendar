import type { JSX } from 'preact';
import { t } from '../i18n.js';
import { Card, Panel } from '../components.js';

export function HelpTab(): JSX.Element {
  const items: { de: [string, string]; en: [string, string] }[] = [
    {
      de: ['Kalender = Gerät', 'Jeder Kalender erscheint als virtuelles An/Aus-Gerät in der HCU. Es schaltet automatisch ein, wenn der heutige Tag zu einer der Regeln passt.'],
      en: ['Calendar = device', 'Each calendar shows up as a virtual on/off device in the HCU. It switches on automatically when today matches one of its rules.'],
    },
    {
      de: ['Feiertage', 'Deutsche gesetzliche Feiertage, optional je Bundesland. Leere Auswahl = bundesweite Feiertage.'],
      en: ['Public holidays', 'German statutory holidays, optionally per federal state. Empty selection = nationwide holidays.'],
    },
    {
      de: ['Brückentage', 'Werktage zwischen einem Feiertag und dem Wochenende werden automatisch erkannt.'],
      en: ['Bridge days', 'Working days between a public holiday and the weekend are detected automatically.'],
    },
    {
      de: ['Eigene Tage', 'Einzeltermine, jährliche Daten (z. B. Geburtstage), Zeiträume (Urlaub), Wochentage, n-ter Wochentag (z. B. Muttertag) und Tage relativ zu Ostern.'],
      en: ['Custom days', 'Single dates, annual dates (e.g. birthdays), ranges (vacation), weekdays, nth weekday (e.g. Mother\'s Day) and days relative to Easter.'],
    },
    {
      de: ['Vor-/Nachlauf', 'Mit „Tage davor/danach" schaltet ein Gerät auch rund um den eigentlichen Tag (z. B. der Abend vor Heiligabend).'],
      en: ['Lead/trail', 'With "lead/trail days" a device also switches around the actual day (e.g. the eve of Christmas).'],
    },
    {
      de: ['Invertieren', 'Kehrt das Ergebnis um – nützlich für „kein Feiertag/Wochenende" als Bedingung.'],
      en: ['Invert', 'Flips the result – useful for "not a holiday/weekend" conditions.'],
    },
    {
      de: ['Manueller Override', 'Im Dashboard lässt sich ein Gerät temporär an-/ausschalten; der Override endet automatisch am nächsten Tag.'],
      en: ['Manual override', 'In the dashboard a device can be forced on/off temporarily; the override clears automatically the next day.'],
    },
    {
      de: ['Konfiguration', 'Das Tool wird über dieses Web-Dashboard konfiguriert. Dashboard aktivieren und den Port kannst du zusätzlich auf der HCU-Plugin-Konfigseite einstellen.'],
      en: ['Configuration', 'The tool is configured via this web dashboard. Enabling the dashboard and its port can additionally be set on the HCU plugin config page.'],
    },
  ];

  return (
    <Panel title={t('Hilfe', 'Help')} intro={t('Kurzer Funktionsüberblick.', 'A short feature overview.')}>
      <div class="grid grid--cards">
        {items.map((it, i) => {
          const [title, body] = t('de', 'en') === 'de' ? it.de : it.en;
          return (
            <Card key={i} title={title}>
              <p class="muted">{body}</p>
            </Card>
          );
        })}
      </div>
    </Panel>
  );
}
