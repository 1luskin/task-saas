import { requireStaffPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { LanguageSwitch } from "@/components/language-switch";
import { LogoutButton } from "@/components/logout-button";
import { PushToggle } from "@/components/settings/push-toggle";
import { InstallHint } from "@/components/settings/install-hint";
import { Avatar } from "@/components/ui";
import { StatusSwitch } from "./status-switch";
import { RequestForm } from "./request-form";
import { MyData } from "./my-data";
import { isEnabled } from "@/lib/features";
import { NotifyPrefs } from "@/components/settings/notify-prefs";
import { NOTIFY_TYPES } from "@/lib/notify-types";
import { LegalFooter } from "@/components/legal/legal-footer";

export default async function ProfilePage() {
  const ctx = await requireStaffPage();
  const { t, locale } = await getI18n();
  const { data: requests } = await ctx.supabase
    .from("task_requests")
    .select("*")
    .eq("created_by", ctx.member.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const requestsOn = await isEnabled(ctx, "requests");
  const { data: prefs } = await ctx.supabase.from("notification_prefs").select("*").eq("member_id", ctx.member.id);
  const { data: dataReqs } = await ctx.supabase.from("data_requests").select("id").eq("member_id", ctx.member.id).eq("status", "open");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={ctx.member.full_name} className="size-14 text-lg" />
        <div>
          <div className="text-xl font-semibold">{ctx.member.full_name}</div>
          <div className="text-muted">{ctx.member.email}</div>
        </div>
      </div>

      <section className="card-white space-y-3 p-4">
        <h2 className="font-semibold">{t("staff.myStatus")}</h2>
        <StatusSwitch initial={ctx.member.status} />
        <p className="text-sm text-muted">{t("staff.statusHint")}</p>
      </section>

      {requestsOn && <section className="card-white space-y-3 p-4">
        <h2 className="font-semibold">{t("requests.new")}</h2>
        <p className="text-sm text-muted">{t("requests.newHint")}</p>
        <RequestForm />
        {(requests ?? []).length > 0 && (
          <div className="border-t border-line/70 pt-3">
            <div className="mb-2 text-sm font-medium text-muted">{t("requests.mine")}</div>
            <ul className="space-y-1.5">
              {(requests ?? []).map((r) => (
                <li key={r.id} className="flex min-h-12 items-center justify-between gap-2 rounded-[12px] bg-card px-3">
                  <span className="min-w-0 truncate">{r.title} <span className="text-sm text-muted">· {formatDate(r.created_at.slice(0, 10), locale, { day: "2-digit", month: "2-digit" })}</span></span>
                  <span className={r.status === "approved" ? "chip bg-ok-soft text-ok" : r.status === "rejected" ? "chip bg-danger-soft text-danger" : "chip bg-accent-soft text-link"}>
                    {t(`requests.${r.status}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>}

      <section className="card-white space-y-3 p-4">
        <h2 className="font-semibold">{t("settings.notifications")}</h2>
        <PushToggle />
        <p className="text-sm text-muted">{t("notifyTypes.alwaysNewTask")}</p>
        <div className="-mx-4"><NotifyPrefs types={NOTIFY_TYPES.employee} off={(prefs ?? []).filter((p) => !p.enabled).map((p) => p.type)} /></div>
      </section>

      <section className="card-white space-y-3 p-4">
        <h2 className="font-semibold">{t("settings.language")}</h2>
        <LanguageSwitch persist large />
        <InstallHint />
      </section>

      <section className="card-white space-y-3 p-4">
        <h2 className="font-semibold">{t("legal.dataTitle")}</h2>
        <MyData requested={(dataReqs ?? []).length > 0} />
      </section>

      <div className="card-white p-2">
        <LogoutButton />
      </div>
      <LegalFooter />
    </div>
  );
}
