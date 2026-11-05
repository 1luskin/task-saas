import { notFound } from "next/navigation";
import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { isEnabled } from "@/lib/features";
import { EmptyState, PageTitle } from "@/components/ui";
import { IconBook } from "@/components/icons";
import { ArticleForm, DeleteFormTemplate, EditableArticle, FormTemplateForm } from "./knowledge-client";

export default async function KnowledgePage() {
  const ctx = await requireBossPage();
  if (!(await isEnabled(ctx, "knowledge"))) notFound();
  const { t } = await getI18n();
  const [{ data: articles }, { data: forms }] = await Promise.all([
    ctx.supabase.from("kb_articles").select("*").eq("firm_id", ctx.firm.id).order("title"),
    ctx.supabase.from("form_templates").select("*").eq("firm_id", ctx.firm.id).order("name"),
  ]);
  return (
    <div className="space-y-6">
      <PageTitle>{t("kb.title")}</PageTitle>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("kb.articles")}</h2>
          {(articles ?? []).map((a) => <EditableArticle key={a.id} article={a} />)}
          {!articles?.length && <div className="card-white"><EmptyState icon={<IconBook />}>{t("team.noItems")}</EmptyState></div>}
          <div className="card-white space-y-3 p-4">
            <h3 className="font-semibold">{t("kb.newArticle")}</h3>
            <ArticleForm />
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("kb.forms")}</h2>
          {(forms ?? []).map((f) => (
            <div key={f.id} className="card-white flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{f.name}</div>
                <ul className="mt-1 space-y-0.5 text-sm text-muted">
                  {f.fields.map((x) => <li key={x.id}>{x.label} <span className="text-xs">({x.type}{x.options ? `: ${x.options.join(", ")}` : ""})</span></li>)}
                </ul>
              </div>
              <DeleteFormTemplate id={f.id} />
            </div>
          ))}
          <div className="card-white space-y-3 p-4">
            <h3 className="font-semibold">{t("kb.newForm")}</h3>
            <FormTemplateForm />
          </div>
        </section>
      </div>
    </div>
  );
}
