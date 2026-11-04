import Link from "next/link";
import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { serverEnv } from "@/lib/env";
import { isDemo } from "@/lib/demo/mode";
import { getGroups } from "@/server/queries";
import { openDemoFirm } from "@/server/actions/demo-firm";
import { InvitePanel } from "@/components/employees/invite-panel";
import { InstallHint } from "@/components/settings/install-hint";
import { FinishOnboarding } from "./finish";
import { IconCheck } from "@/components/icons";
import { cx } from "@/components/ui";

export default async function WelcomePage() {
  const ctx = await requireBossPage();
  const { t } = await getI18n();
  const [{ count: members }, { count: tasks }, { data: invites }, groups] = await Promise.all([
    ctx.supabase.from("members").select("id", { count: "exact", head: true }).eq("firm_id", ctx.firm.id).is("archived_at", null),
    ctx.supabase.from("tasks").select("id", { count: "exact", head: true }).eq("firm_id", ctx.firm.id),
    ctx.supabase.from("invites").select("*").eq("firm_id", ctx.firm.id).eq("revoked", false).order("created_at", { ascending: false }).limit(3),
    getGroups(ctx),
  ]);
  const step2 = (members ?? 0) > 1 || (invites ?? []).length > 0;
  const step3 = (tasks ?? 0) > 0;
  const Step = ({ n, done, title, text, children }: { n: number; done: boolean; title: string; text?: string; children?: React.ReactNode }) => (
    <section className="card-white space-y-3 p-5">
      <div className="flex items-center gap-3">
        <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-full font-semibold", done ? "bg-ok-soft text-ok" : "bg-surface-3 text-ink")}>
          {done ? <IconCheck className="size-5" /> : n}
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {text && <p className="text-sm text-muted">{text}</p>}
        </div>
      </div>
      {children}
    </section>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">{t("onboarding2.title")}</h1>
      {Step({ n: 1, done: true, title: t("onboarding2.step1"), text: ctx.firm.name })}
      {Step({
        n: 2, done: step2, title: t("onboarding2.step2"), text: t("onboarding2.step2Text"),
        children: (
          <InvitePanel
            firmName={ctx.firm.name}
            appUrl={serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}
            groups={groups}
            invites={(invites ?? []).map((i) => ({ id: i.id, token: i.token, role: i.role, used_count: i.used_count, expires_at: i.expires_at }))}
          />
        ),
      })}
      {Step({
        n: 3, done: step3, title: t("onboarding2.step3"), text: t("onboarding2.step3Text"),
        children: <Link href="/boss/tasks/new" className="btn-primary">{t("dashboard.newTask")}</Link>,
      })}
      {!isDemo() && (
        <section className="card-white space-y-3 p-5">
          <h2 className="font-semibold">{t("onboarding2.demoTitle")}</h2>
          <p className="text-sm text-muted">{t("onboarding2.demoText")}</p>
          <form action={openDemoFirm}><button className="btn-secondary">{t("onboarding2.openDemo")}</button></form>
        </section>
      )}
      <section className="card-white p-5"><InstallHint /></section>
      <FinishOnboarding />
    </div>
  );
}
