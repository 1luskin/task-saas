/** Runde Achsenwerte (0 eingeschlossen), z. B. 0 / 500 / 1.000 / 1.500 */
export function niceTicks(min: number, max: number, count = 4, integer = false): number[] {
  const lo = Math.min(0, min), hi = Math.max(0, max);
  if (lo === hi) return [0, 1];
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  if (integer) step = Math.max(1, Math.ceil(step)); // Stückzahlen: keine halben Aufgaben
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** Kompakt für Achsen: 950 · 1.200 · 12 T · 1,2 Mio (de) */
export function compactNumber(n: number, locale = "de"): string {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "de-DE", { notation: Math.abs(n) >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
}
