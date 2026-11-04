import { requireSuperadmin } from "@/lib/superadmin";
import { getI18n } from "@/i18n/server";
import { centsToInput } from "@/lib/money";
import { LANDING_DEFAULTS } from "@/landing/content";
import { LandingJsonForm, PlanPriceForm } from "@/components/admin/content-forms";
import { PageTitle } from "@/components/ui";

export default async function AdminContent() {
  const { admin } = await requireSuperadmin();
  const { t } = await getI18n();
  const [{ data: plans }, { data: content }] = await Promise.all([
    admin.from("plans").select("*").order("position"),
    admin.from("site_content").select("*").eq("key", "landing"),
  ]);
  return (
    <div className="space-y-4">
      <PageTitle>{t("admin.content")}</PageTitle>
      <section className="card-white space-y-3 p-4">
        {(plans ?? []).map((p) => <PlanPriceForm key={p.id} planId={p.id} value={centsToInput(p.price_cents)} />)}
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        {(["de", "ru"] as const).map((l) => {
          const saved = content?.find((c) => c.locale === l)?.data;
          const value = JSON.stringify(saved && Object.keys(saved).length ? saved : { hero: LANDING_DEFAULTS[l].hero }, null, 2);
          return (
            <section key={l} className="card-white p-4">
              <LandingJsonForm locale={l} value={value} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
