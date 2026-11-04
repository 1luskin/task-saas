import { getI18n } from "@/i18n/server";
import { actAs, resetDemoFirm, switchToOwnFirm } from "@/server/actions/demo-firm";
import type { Ctx } from "@/lib/auth";
import { isDemo } from "@/lib/demo/mode";
import Link from "next/link";

/**
 * Leiste in der Demo-Firma: "Ansehen als Inhaber / Mitarbeiter / Kunde",
 * Demo zurücksetzen, zurück zur eigenen Firma.
 */
export async function DemoFirmBar({ ctx }: { ctx: Ctx }) {
  if (!ctx.firm.is_demo && !isDemo()) return null;
  const { t } = await getI18n();
  // Demo-Mitarbeiter (für Chef sichtbar; im acting-Modus über Server-Abfrage als Admin nicht nötig)
  const { data: staff } = ctx.member.role === "boss" || ctx.acting
    ? await ctx.supabase.from("members").select("id, full_name, role").eq("firm_id", ctx.firm.id).eq("role", "employee").is("archived_at", null).order("full_name")
    : { data: [] as { id: string; full_name: string; role: string }[] };
  const isWorkerView = ctx.member.role !== "boss";

  return (
    <div className="flex flex-wrap items-center gap-2 bg-review-soft px-4 py-2 text-sm text-review">
      <span className="min-w-0 flex-1">{isWorkerView ? t("demoFirm.actingAs", { name: ctx.member.full_name }) : t("demoFirm.banner")}</span>
      <span className="text-ink-2">{t("demoFirm.viewAs")}:</span>
      <form action={actAs.bind(null, null)}>
        <button className={`chip min-h-8 ${!isWorkerView ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-white/5"}`}>{t("demoFirm.owner")}</button>
      </form>
      {(staff ?? []).length > 0 &&
        (isWorkerView ? (
          <span className="chip min-h-8 bg-surface-3 text-ink">{t("demoFirm.worker")}</span>
        ) : (
          <form action={actAs.bind(null, staff![0]!.id)}>
            <button className="chip min-h-8 text-ink-2 hover:bg-white/5" title={staff![0]!.full_name}>{t("demoFirm.worker")}</button>
          </form>
        ))}
      <span className="chip min-h-8 text-muted" title={t("demoFirm.customerSoon")} aria-disabled="true">{t("demoFirm.customer")}</span>
      <form action={resetDemoFirm}>
        <button className="chip min-h-8 text-ink-2 hover:bg-white/5">{t("demoFirm.reset")}</button>
      </form>
      {isDemo() && (
        <Link href="/login" className="chip min-h-8 text-ink-2 underline underline-offset-2 hover:bg-white/5">{t("demo.switchRole")}</Link>
      )}
      {!isDemo() && ctx.ownMemberId && (
        <form action={switchToOwnFirm}>
          <button className="chip min-h-8 bg-accent text-white">{t("demoFirm.toMyFirm")}</button>
        </form>
      )}
    </div>
  );
}
