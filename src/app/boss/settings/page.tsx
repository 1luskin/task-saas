import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { PageTitle } from "@/components/ui";
import { LanguageSwitch } from "@/components/language-switch";
import { PushToggle } from "@/components/settings/push-toggle";
import { NotifyPrefs } from "@/components/settings/notify-prefs";
import { NOTIFY_TYPES } from "@/lib/notify-types";
import { InstallHint } from "@/components/settings/install-hint";
import { TrialCard } from "@/components/trial/trial";
import { FirmForm } from "./firm-form";
import { StatusesEditor } from "@/components/settings/statuses-editor";
import { DataPanel } from "@/components/settings/data-panel";
import { FeaturesForm, LogoForm, ShiftAutocloseForm, TaskFieldsForm } from "@/components/settings/firm-settings";
import { loadFeatures } from "@/lib/features";
import { logoUrl } from "@/lib/logo";
import { logoutAllDevices } from "@/server/actions/settings";
import { formatDateTime } from "@/lib/dates";
import Link from "next/link";
import { PublicSlugForm } from "@/components/clients/inbound";
import { serverEnv } from "@/lib/env";
import { LegalFooter } from "@/components/legal/legal-footer";

export default async function SettingsPage() {
  const ctx = await requireBossPage();
  const { t, locale } = await getI18n();
  const [{ data: statuses }, { data: reqs }, { data: members }] = await Promise.all([
    ctx.supabase.from("task_statuses").select("*").eq("firm_id", ctx.firm.id).order("position"),
    ctx.supabase.from("data_requests").select("*").eq("firm_id", ctx.firm.id).eq("status", "open"),
    ctx.supabase.from("members").select("id, full_name").eq("firm_id", ctx.firm.id),
  ]);
  const { data: prefs } = await ctx.supabase.from("notification_prefs").select("*").eq("member_id", ctx.member.id);
  const features = [...(await loadFeatures(ctx)).values()].filter((f) => f.key !== "demo_firm");
  const { data: logins } = await ctx.supabase.from("login_events").select("*").eq("user_id", ctx.userId).order("created_at", { ascending: false }).limit(10);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageTitle>{t("settings.title")}</PageTitle>
      <TrialCard firm={ctx.firm} />
      <section className="card-white p-4">
        <h2 className="mb-3 font-semibold">{t("settings.firm")}</h2>
        <FirmForm name={ctx.firm.name} />
      </section>
      <section className="card-white p-4">
        <LogoForm url={logoUrl(ctx.firm.logo_path)} />
      </section>
      <section className="card-white space-y-4 p-4">
        <TaskFieldsForm initial={ctx.firm.task_fields} />
        <p className="text-sm text-muted">{t("settings2.rates")} <Link href="/boss/employees" className="text-link">→ {t("nav.employees")}</Link></p>
      </section>
      {features.find((f) => f.key === "public_form")?.enabled && (
        <section className="card-white p-4">
          <PublicSlugForm slug={ctx.firm.public_slug} appUrl={serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")} />
        </section>
      )}
      <section className="card-white space-y-4 p-4">
        <FeaturesForm features={features} />
        <ShiftAutocloseForm hours={ctx.firm.shift_autoclose_hours} />
      </section>
      <section className="card-white p-4">
        <StatusesEditor statuses={statuses ?? []} autoAcceptDays={ctx.firm.auto_accept_days} />
      </section>
      <section className="card-white overflow-hidden">
        <h2 className="px-4 pt-4 font-semibold">{t("settings.notifications")}</h2>
        <NotifyPrefs types={NOTIFY_TYPES.boss} off={(prefs ?? []).filter((p) => !p.enabled).map((p) => p.type)} />
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
      <section className="card-white space-y-3 p-4">
        <h2 className="font-semibold">{t("settings2.security")}</h2>
        <div className="text-sm font-medium text-muted">{t("settings2.loginJournal")}</div>
        <ul className="space-y-1 text-sm">
          {(logins ?? []).map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-2 rounded-[10px] bg-card px-3 py-2">
              <span className="tabular-nums">{formatDateTime(l.created_at, locale)} · {l.kind}</span>
              <span className="truncate text-muted">{(l.user_agent ?? "").slice(0, 60)}</span>
            </li>
          ))}
          {!logins?.length && <li className="text-muted">—</li>}
        </ul>
        <form action={logoutAllDevices}><button className="btn-secondary">{t("settings2.logoutAll")}</button></form>
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
