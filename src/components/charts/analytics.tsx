import type { Ctx } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { topMembers, weeklySeries } from "@/server/analytics";
import { getMembers } from "@/server/queries";
import { BarChart } from "./bar-chart";

/** Diagramme: Dashboard (2) bzw. "Geld" (4: + Kosten gestapelt, Top-Mitarbeiter) */
export async function AnalyticsCharts({ ctx, variant, month }: { ctx: Ctx; variant: "dashboard" | "money"; month?: string }) {
  const { t, locale } = await getI18n();
  const [weeks, top, members] = await Promise.all([
    weeklySeries(ctx, 8),
    variant === "money" ? topMembers(ctx, month) : Promise.resolve([]),
    variant === "money" ? getMembers(ctx, { includeArchived: true }) : Promise.resolve([]),
  ]);
  const label = (w: (typeof weeks)[number]) => t("charts.kw", { n: w.kw });
  const done = (
    <BarChart title={t("charts.doneWeek")} series={[{ key: "done", name: t("charts.done"), color: "chart-1" }]}
      data={weeks.map((w) => ({ label: label(w), values: { done: w.done } }))} />
  );
  const profit = (
    <BarChart title={t("charts.profitWeek")} money series={[{ key: "profit", name: t("charts.profit"), color: "chart-1" }]}
      data={weeks.map((w) => ({ label: label(w), values: { profit: w.profitCents / 100 } }))} />
  );
  if (variant === "dashboard") {
    return <div className="grid gap-4 md:grid-cols-2"><div className="card-white p-4">{done}</div><div className="card-white p-4">{profit}</div></div>;
  }
  const fmtRating = (n: number) => new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "de-DE", { maximumFractionDigits: 1 }).format(n);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card-white p-4">{done}</div>
      <div className="card-white p-4">{profit}</div>
      <div className="card-white p-4">
        <BarChart title={t("charts.costsWeek")} money
          series={[{ key: "labor", name: t("charts.labor"), color: "chart-1" }, { key: "mat", name: t("charts.materials"), color: "chart-2" }]}
          data={weeks.map((w) => ({ label: label(w), values: { labor: w.laborCents / 100, mat: w.materialsCents / 100 } }))} />
      </div>
      <div className="card-white p-4">
        <BarChart horizontal title={t("charts.top", { month: month ?? "" })} series={[{ key: "done", name: t("charts.done"), color: "chart-1" }]}
          data={top.map((r) => ({
            label: members.find((m) => m.id === r.memberId)?.full_name ?? "?",
            sub: r.avgRating !== null ? t("charts.rating", { n: fmtRating(r.avgRating) }) : undefined,
            values: { done: r.tasksDone },
          }))} />
      </div>
    </div>
  );
}
