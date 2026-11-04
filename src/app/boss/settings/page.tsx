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
import { DataPanel } from "@/components/settings/data-panel";
import { LegalFooter } from "@/components/legal/legal-footer";

export default async function SettingsPage() {
  const ctx = await requireBossPage();
  const { t } = await getI18n();
  const [{ data: statuses }, { data: reqs }, { data: members }] = await Promise.all([
    ctx.supabase.from("task_statuses").select("*").eq("firm_id", ctx.firm.id).order("position"),
    ctx.supabase.from("data_requests").select("*").eq("firm_id", ctx.firm.id).eq("status", "open"),
    ctx.supabase.from("members").select("id, full_name").eq("firm_id", ctx.firm.id),
  ]);
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
      <section className="card-white p-4">
        <DataPanel
          firmName={ctx.firm.name}
          email={ctx.email ?? ""}
          scheduledFor={ctx.firm.deletion_scheduled_for}
          requests={(reqs ?? []).map((r) => ({ id: r.id, kind: r.kind, created_at: r.created_at, memberName: members?.find((m) => m.id === r.member_id)?.full_name ?? "?" }))}
        />
      </section>
      <LegalFooter />
    </div>
  );
}
