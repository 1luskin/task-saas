import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { getMembers } from "@/server/queries";
import { PageTitle } from "@/components/ui";
import { TemplatesClient } from "./templates-client";

export default async function TemplatesPage() {
  const ctx = await requireBossPage();
  const { t } = await getI18n();
  const [{ data: templates }, members] = await Promise.all([
    ctx.supabase.from("task_templates").select("*").eq("firm_id", ctx.firm.id).order("created_at"),
    getMembers(ctx),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle>{t("templates.title")}</PageTitle>
      <p className="text-muted">{t("templates.hint")}</p>
      <TemplatesClient templates={templates ?? []} members={members.map((m) => ({ id: m.id, full_name: m.full_name, status: m.status }))} />
    </div>
  );
}
