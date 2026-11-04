import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { PageTitle } from "@/components/ui";
import { LanguageSwitch } from "@/components/language-switch";
import { PushToggle } from "@/components/settings/push-toggle";
import { ProfileToggle } from "@/components/settings/toggle";
import { InstallHint } from "@/components/settings/install-hint";
import { TrialCard } from "@/components/trial/trial";
import { FirmForm } from "./firm-form";
import { StatusesEditor } from "@/components/settings/statuses-editor";

export default async function SettingsPage() {
  const ctx = await requireBossPage();
  const { t } = await getI18n();
  const { data: statuses } = await ctx.supabase.from("task_statuses").select("*").eq("firm_id", ctx.firm.id).order("position");
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageTitle>{t("settings.title")}</PageTitle>
      <TrialCard firm={ctx.firm} />
      <section className="card-white p-4">
        <h2 className="mb-3 font-semibold">{t("settings.firm")}</h2>
        <FirmForm name={ctx.firm.name} />
      </section>
      <section className="card-white p-4">
        <StatusesEditor statuses={statuses ?? []} autoAcceptDays={ctx.firm.auto_accept_days} />
      </section>
      <section className="card-white overflow-hidden">
        <h2 className="px-4 pt-4 font-semibold">{t("settings.notifications")}</h2>
        <div className="divide-y divide-line/70">
          <ProfileToggle field="notify_overdue" initial={ctx.member.notify_overdue} label={t("settings.notifyOverdue")} />
          <ProfileToggle field="notify_done" initial={ctx.member.notify_done} label={t("settings.notifyDone")} />
        </div>
        <div className="border-t border-line/70 p-4">
          <div className="mb-2 text-sm font-medium text-muted">{t("settings.push")}</div>
          <PushToggle />
        </div>
      </section>
      <section className="card-white space-y-3 p-4">
        <h2 className="font-semibold">{t("settings.language")}</h2>
        <LanguageSwitch persist large />
        <InstallHint />
      </section>
    </div>
  );
}
