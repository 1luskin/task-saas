import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { getMembers } from "@/server/queries";
import { isEnabled } from "@/lib/features";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { TemplatesClient } from "./templates-client";
import { ChecklistTemplatesManager } from "@/components/tasks/checklist-templates";

export default async function TemplatesPage() {
  const ctx = await requireBossPage();
  if (!(await isEnabled(ctx, "templates"))) notFound();
  const { t } = await getI18n();
  const [{ data: templates }, members, { data: clTemplates }] = await Promise.all([
    ctx.supabase.from("task_templates").select("*").eq("firm_id", ctx.firm.id).order("created_at"),
    getMembers(ctx),
    ctx.supabase.from("checklist_templates").select("*").eq("firm_id", ctx.firm.id).order("name"),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle>{t("templates.title")}</PageTitle>
      <p className="text-muted">{t("templates.hint")}</p>
      <section className="card-white p-4"><ChecklistTemplatesManager templates={clTemplates ?? []} /></section>
      <TemplatesClient templates={templates ?? []} members={members.map((m) => ({ id: m.id, full_name: m.full_name, status: m.status }))} />
    </div>
  );
}
