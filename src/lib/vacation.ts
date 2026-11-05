import { addDays, isoWeekday } from "./dates";

/** Urlaubstage = Arbeitstage Mo–Fr im Zeitraum (Feiertage nicht berücksichtigt) */
export function workdaysBetween(from: string, to: string): number {
  if (to < from) return 0;
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (isoWeekday(d) <= 5) n++;
  return n;
}

/** Resturlaub im Jahr: Kontingent − genehmigte Tage (Antragsbeginn im Jahr) */
export function remainingVacation(perYear: number, requests: { date_from: string; days: number; status: string }[], year: number): number {
  const used = requests.filter((r) => r.status === "approved" && r.date_from.startsWith(String(year))).reduce((s, r) => s + r.days, 0);
  return perYear - used;
}
