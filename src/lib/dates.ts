/** Datums-Helfer. Alle "Kalendertage" werden in Europe/Berlin gerechnet. */
export const TZ = "Europe/Berlin";

const isoFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD des Zeitpunkts in Berlin */
export function toISODate(d: Date = new Date()): string {
  return isoFmt.format(d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseISO(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number): string {
  const { y, m } = parseISO(iso);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  return dt.toISOString().slice(0, 10);
}

/** ISO-Wochentag 1 = Montag … 7 = Sonntag */
export function isoWeekday(iso: string): number {
  const { y, m, d } = parseISO(iso);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function startOfWeek(iso: string): string {
  return addDays(iso, 1 - isoWeekday(iso));
}

export function startOfMonth(iso: string): string {
  return iso.slice(0, 8) + "01";
}

export function daysInMonth(iso: string): number {
  const { y, m } = parseISO(iso);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Offset (ms) von Berlin gegenüber UTC zu einem Zeitpunkt */
function tzOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUTC - utcMs;
}

/** UTC-Zeitpunkt von 00:00 Berliner Zeit an diesem Tag */
export function berlinStartOfDay(iso: string): Date {
  const { y, m, d } = parseISO(iso);
  const guess = Date.UTC(y, m - 1, d);
  const offset = tzOffsetMs(guess);
  return new Date(guess - offset);
}

export interface Period {
  from: string; // inkl. YYYY-MM-DD
  to: string; // exkl. YYYY-MM-DD
}

export function weekPeriod(iso: string = todayISO()): Period {
  const from = startOfWeek(iso);
  return { from, to: addDays(from, 7) };
}

export function monthPeriod(iso: string = todayISO()): Period {
  const from = startOfMonth(iso);
  return { from, to: addMonths(from, 1) };
}

export function periodToRange(p: Period): { fromTs: string; toTs: string } {
  return { fromTs: berlinStartOfDay(p.from).toISOString(), toTs: berlinStartOfDay(p.to).toISOString() };
}

export function isOverdue(t: { status: string; due_date: string | null; due_time: string | null }, now = new Date()): boolean {
  if (t.status === "done" || t.status === "review" || !t.due_date) return false;
  const today = toISODate(now);
  if (t.due_date < today) return true;
  if (t.due_date > today || !t.due_time) return false;
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  return t.due_time.slice(0, 5) < hhmm;
}

export function minutesBetween(a: string, b: string | null, now = Date.now()): number {
  const end = b ? new Date(b).getTime() : now;
  return Math.max(0, (end - new Date(a).getTime()) / 60000);
}

export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} h ${m.toString().padStart(2, "0")} min` : `${m} min`;
}

export function intlLocale(locale: string): string {
  return locale === "ru" ? "ru-RU" : "de-DE";
}

export function formatDate(iso: string | null, locale: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }): string {
  if (!iso) return "—";
  const { y, m, d } = parseISO(iso.slice(0, 10));
  return new Intl.DateTimeFormat(intlLocale(locale), { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatDateTime(ts: string | null, locale: string): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

/** "2026-11-04T08:30" (Berliner Ortszeit, z. B. aus <input type=datetime-local>) → ISO UTC */
export function berlinLocalToISO(local: string): string {
  const [d, tm = "00:00"] = local.split("T") as [string, string?];
  const [hh, mm] = tm.split(":").map(Number) as [number, number];
  const base = berlinStartOfDay(d).getTime();
  // Offset an diesem Tag kann sich durch Sommerzeit ändern → über die Ziel-Uhrzeit korrigieren
  const guess = base + (hh * 60 + mm) * 60_000;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(guess));
  const [gh, gm] = parts.split(":").map(Number) as [number, number];
  const diff = (hh * 60 + mm - (gh * 60 + gm)) * 60_000;
  return new Date(guess + (Math.abs(diff) < 3 * 3600_000 ? diff : 0)).toISOString();
}

/** ISO → "2026-11-04T08:30" in Berliner Ortszeit (für <input type=datetime-local>) */
export function isoToBerlinLocal(iso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}
