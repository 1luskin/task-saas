import { requireStaffPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { TimesView } from "@/components/shifts/times-view";

export default async function MyTimes() {
  const ctx = await requireStaffPage();
  const { t, locale } = await getI18n();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("times.mine")}</h1>
      <TimesView ctx={ctx} memberId={ctx.member.id} t={t} locale={locale} editable={false} />
    </div>
  );
}
