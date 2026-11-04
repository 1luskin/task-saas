import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { monthPeriod, todayISO } from "@/lib/dates";
import { loadFinance } from "@/lib/finance";
import { getGroups, getMembers } from "@/server/queries";
import { serverEnv } from "@/lib/env";
import { PageTitle } from "@/components/ui";
import { Hint } from "@/components/hint";
import { InvitePanel } from "@/components/employees/invite-panel";
import { GroupsPanel } from "@/components/employees/groups-panel";
import { MemberCard } from "@/components/employees/member-card";

export default async function EmployeesPage() {
  const ctx = await requireBossPage();
  const { t } = await getI18n();
  const [members, groups, fin, { data: invites }] = await Promise.all([
    getMembers(ctx),
    getGroups(ctx),
    loadFinance(ctx, monthPeriod(todayISO())),
    ctx.supabase.from("invites").select("*").eq("firm_id", ctx.firm.id).eq("revoked", false).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
  ]);
  const appUrl = serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  return (
    <div className="space-y-6">
      <PageTitle>{t("employees.title")}</PageTitle>
      <Hint id="employees" dismissed={ctx.settings.hints_dismissed}>{t("hints.employees")}</Hint>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          {members.length <= 1 && <p className="text-muted">{t("employees.none")}</p>}
          {members.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              groups={groups}
              isSelf={m.id === ctx.member.id}
              myEmail={ctx.email ?? ""}
              tasksDoneMonth={fin.perMember.get(m.id)?.tasksDone ?? 0}
              reworksMonth={fin.perMember.get(m.id)?.reworks ?? 0}
              avgRating={(() => { const x = fin.perMember.get(m.id); return x && x.ratingCount ? x.ratingSum / x.ratingCount : null; })()}
            />
          ))}
        </div>
        <div className="space-y-4">
          <InvitePanel firmName={ctx.firm.name} appUrl={appUrl} groups={groups} invites={(invites ?? []).map((i) => ({ id: i.id, token: i.token, role: i.role, used_count: i.used_count, expires_at: i.expires_at }))} />
          <GroupsPanel groups={groups} />
        </div>
      </div>
    </div>
  );
}
