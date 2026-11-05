"use client";
import { useId, useState } from "react";
import { compactNumber, niceTicks } from "@/lib/chart";
import { formatMoney } from "@/lib/money";
import { useI18n } from "@/i18n/client";

export type Series = { key: string; name: string; color: "chart-1" | "chart-2" };
export type Point = { label: string; sub?: string; values: Record<string, number> };

const COLOR = { "chart-1": "var(--color-chart-1)", "chart-2": "var(--color-chart-2)" };

/**
 * Säulen (vertikal, gestapelt möglich) oder Balken (horizontal) als SVG.
 * Dünne Marken (≤ 24 px), 4-px-Rundung am Datenende, 2-px-Lücke zwischen Segmenten,
 * Tooltip bei Hover/Fokus, Legende ab 2 Reihen, Tabellenansicht für Screenreader.
 */
export function BarChart({ title, series, data, money = false, horizontal = false, height = 180 }: {
  title: string; series: Series[]; data: Point[]; money?: boolean; horizontal?: boolean; height?: number;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const fmt = (v: number) => (money ? formatMoney(Math.round(v * 100), locale) : new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "de-DE").format(v));
  const axis = (v: number) => (money ? `${compactNumber(v, locale)} €` : compactNumber(v, locale));
  const totals = data.map((d) => series.reduce((s, x) => s + (d.values[x.key] ?? 0), 0));
  const mins = data.map((d) => Math.min(0, ...series.map((x) => d.values[x.key] ?? 0)));
  const ticks = niceTicks(Math.min(0, ...mins), Math.max(0, ...totals), 4, !money);
  const lo = ticks[0]!, hi = ticks[ticks.length - 1]!;

  const legend = series.length > 1 && (
    <div className="flex flex-wrap gap-3 text-xs text-ink-2">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px]" style={{ background: COLOR[s.color] }} />{s.name}</span>
      ))}
    </div>
  );
  const tip = hover !== null && data[hover] && (
    <div className="pointer-events-none absolute z-10 rounded-[10px] border border-line bg-bg-deep px-3 py-2 text-xs shadow-lg"
      style={horizontal ? { left: "40%", top: hover * 34 + 4 } : { left: `${Math.min(80, ((hover + 0.5) / data.length) * 100)}%`, top: 0, transform: "translateX(-50%)" }}>
      <div className="mb-1 font-medium text-ink">{data[hover]!.label}{data[hover]!.sub ? ` · ${data[hover]!.sub}` : ""}</div>
      {series.map((s) => (
        <div key={s.key} className="flex items-center gap-2 text-ink-2">
          <span className="size-2 rounded-[2px]" style={{ background: COLOR[s.color] }} />
          <span className="flex-1">{s.name}</span>
          <span className="tabular-nums text-ink">{fmt(data[hover]!.values[s.key] ?? 0)}</span>
        </div>
      ))}
    </div>
  );
  const table = (
    <details className="text-xs text-muted">
      <summary className="cursor-pointer select-none">{t("charts.table")}</summary>
      <table className="mt-2 w-full">
        <thead><tr><th className="text-left font-medium" /> {series.map((s) => <th key={s.key} className="text-right font-medium">{s.name}</th>)}</tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}><td>{d.label}{d.sub ? ` · ${d.sub}` : ""}</td>{series.map((s) => <td key={s.key} className="text-right tabular-nums text-ink-2">{fmt(d.values[s.key] ?? 0)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </details>
  );

  if (horizontal) {
    const s0 = series[0]!;
    const max = Math.max(1, ...data.map((d) => d.values[s0.key] ?? 0));
    return (
      <figure className="space-y-3" aria-labelledby={`${id}-t`}>
        <figcaption id={`${id}-t`} className="font-semibold">{title}</figcaption>
        <div className="relative space-y-2" onPointerLeave={() => setHover(null)}>
          {data.map((d, i) => {
            const v = d.values[s0.key] ?? 0;
            return (
              <div key={d.label} tabIndex={0} onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-[8px] text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent-2">
                <span className="truncate text-ink-2">{d.label}</span>
                <span className="h-3 rounded-r-[4px]" style={{ width: `${Math.max(2, (v / max) * 100)}%`, background: COLOR[s0.color], opacity: hover === null || hover === i ? 1 : 0.55 }} />
                <span className="tabular-nums text-ink">{fmt(v)}{d.sub ? <span className="text-muted"> · {d.sub}</span> : null}</span>
              </div>
            );
          })}
          {!data.length && <p className="text-sm text-muted">—</p>}
        </div>
        {table}
      </figure>
    );
  }

  const W = 600, H = height, padL = 52, padB = 22, padT = 8;
  const plotW = W - padL - 4, plotH = H - padB - padT;
  const y = (v: number) => padT + ((hi - v) / (hi - lo)) * plotH;
  const band = plotW / Math.max(1, data.length);
  const bw = Math.min(24, band * 0.6);
  return (
    <figure className="space-y-2" aria-labelledby={`${id}-t`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <figcaption id={`${id}-t`} className="font-semibold">{title}</figcaption>
        {legend}
      </div>
      <div className="relative" onPointerLeave={() => setHover(null)}>
        {tip}
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={title}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={padL} x2={W} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={v === 0 ? 1.2 : 1} opacity={v === 0 ? 1 : 0.6} />
              <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)" className="tabular-nums">{axis(v)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = padL + band * i + band / 2;
            let pos = 0, neg = 0;
            const segs = series.map((s, si) => {
              const v = d.values[s.key] ?? 0;
              const from = v >= 0 ? pos : neg;
              const to = from + v;
              if (v >= 0) pos = to; else neg = to;
              const top = Math.min(y(from), y(to)), h = Math.abs(y(to) - y(from));
              const isEnd = si === series.length - 1 || series.slice(si + 1).every((x) => (d.values[x.key] ?? 0) === 0);
              const gap = si > 0 && v !== 0 ? 2 : 0; // 2-px-Fläche zwischen Segmenten
              const hh = Math.max(0, h - gap);
              const yy = v >= 0 ? top : top + gap;
              if (hh <= 0) return null;
              const r = isEnd ? Math.min(4, hh) : 0;
              // nur das Datenende abrunden, Basis eckig
              const path = v >= 0
                ? `M${cx - bw / 2},${yy + hh} V${yy + r} Q${cx - bw / 2},${yy} ${cx - bw / 2 + r},${yy} H${cx + bw / 2 - r} Q${cx + bw / 2},${yy} ${cx + bw / 2},${yy + r} V${yy + hh} Z`
                : `M${cx - bw / 2},${yy} V${yy + hh - r} Q${cx - bw / 2},${yy + hh} ${cx - bw / 2 + r},${yy + hh} H${cx + bw / 2 - r} Q${cx + bw / 2},${yy + hh} ${cx + bw / 2},${yy + hh - r} V${yy} Z`;
              return <path key={s.key} d={path} fill={COLOR[s.color]} opacity={hover === null || hover === i ? 1 : 0.55} />;
            });
            return (
              <g key={d.label}>
                {segs}
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill={hover === i ? "var(--color-ink)" : "var(--color-muted)"}>{d.label}</text>
                <rect x={padL + band * i} y={0} width={band} height={H} fill="transparent" tabIndex={0} role="img" aria-label={`${d.label}: ${series.map((s) => `${s.name} ${fmt(d.values[s.key] ?? 0)}`).join(", ")}`}
                  onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} className="outline-none" />
              </g>
            );
          })}
        </svg>
      </div>
      {table}
    </figure>
  );
}
