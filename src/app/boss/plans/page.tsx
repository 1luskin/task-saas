import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { getPlans } from "@/lib/plans";
import { formatMoney } from "@/lib/money";
import { trialInfo } from "@/lib/trial";
import { startCheckout } from "@/server/actions/billing";
import { PageTitle } from "@/components/ui";
import { IconCheck } from "@/components/icons";

export const metadata = { robots: { index: false } };

export default async function PlansPage() {
  const ctx = await requireBossPage();
  const { t, locale } = await getI18n();
  const info = trialInfo(ctx.firm);
  const plans = await getPlans();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle>{t("plans.title")}</PageTitle>
      <p className="text-muted">{t("plans.intro")}</p>
      {!ctx.firm.is_demo && ctx.firm.plan === "trial" && (
        <p className={info.expired ? "text-danger" : "text-ink-2"}>
          {info.expired ? t("trial.expiredTitle") : `${t("trial.title")}: ${t("trial.daysLeft", { n: info.daysLeft, total: info.totalDays })}`}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((p) => (
          <div key={p.id} className="card-white flex flex-col gap-3 p-5">
            <h2 className="text-xl font-semibold">{t(`plans.${p.id}`)}</h2>
            <div>
              <span className="font-display text-3xl font-semibold tabular-nums">{p.pricePerEmployeeCents == null ? "[ЦЕНА]" : formatMoney(p.pricePerEmployeeCents, locale)}</span>
              <span className="ml-1 text-sm text-muted">{t("plans.perEmployee")}</span>
            </div>
            <p className="flex items-start gap-2 text-ink-2"><IconCheck className="mt-0.5 size-5 text-ok" />{t(`plans.${p.id}Text`)}</p>
            <form action={startCheckout.bind(null, p.id)} className="mt-auto">
              <button className="btn-primary w-full" disabled={ctx.firm.plan === "paid"}>{ctx.firm.plan === "paid" ? t("plans.current") : t("plans.choose")}</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
