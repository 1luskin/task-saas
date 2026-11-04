import { getI18n } from "@/i18n/server";
import { getContext } from "@/lib/auth";
import { actAs } from "@/server/actions/demo-firm";

/** "Ansehen als Mitarbeiter" direkt neben der Suche (nur Demo-Firma) */
export async function DemoWorkerButton() {
  const ctx = await getContext();
  if (!ctx || !ctx.member || !("supabase" in ctx)) return null;
  const { t } = await getI18n();
  const { data } = await ctx.supabase.from("members").select("id").eq("firm_id", ctx.firm.id).eq("role", "employee").is("archived_at", null).limit(1);
  if (!data?.[0]) return null;
  return (
    <form action={actAs.bind(null, data[0].id)}>
      <button className="btn-secondary">{t("demoFirm.viewAs")}: {t("demoFirm.worker")}</button>
    </form>
  );
}
