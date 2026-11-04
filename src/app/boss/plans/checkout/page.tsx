import Link from "next/link";
import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { CONTACT_MAILTO } from "@/components/trial/trial";
import { IconClock } from "@/components/icons";

export const metadata = { robots: { index: false } };

/** "Oplata skoro" – Platzhalter, bis ein echter PaymentProvider (Stripe) angebunden ist */
export default async function CheckoutPage() {
  await requireBossPage();
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-md space-y-4 py-10 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-card text-link"><IconClock className="size-7" /></span>
      <h1 className="text-2xl font-semibold">{t("plans.comingTitle")}</h1>
      <p className="text-muted">{t("plans.comingText")}</p>
      <div className="flex flex-col gap-2">
        <a href={CONTACT_MAILTO} className="btn-primary">{t("trial.contact")}</a>
        <Link href="/boss/plans" className="btn-ghost">{t("plans.back")}</Link>
      </div>
    </div>
  );
}
