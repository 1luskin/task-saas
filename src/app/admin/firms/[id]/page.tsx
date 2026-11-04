import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/superadmin";
import { getI18n } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { FEATURES } from "@/lib/features";
import { FirmActions } from "@/components/admin/firm-actions";
import { FirmFlagSelect } from "@/components/admin/flag-controls";
import { PageTitle } from "@/components/ui";

export default async function AdminFirm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { admin } = await requireSuperadmin();
  const { t, locale } = await getI18n();
  const [{ data: firm }, { data: members }, { data: flags }, { data: overrides }, { count: tasks }] = await Promise.all([
    admin.from("firms").select("*").eq("id", id).maybeSingle(),
    admin.from("members").select("id, full_name, email, role, status, archived_at, created_at").eq("firm_id", id).order("created_at"),
    admin.from("feature_flags").select("*"),
    admin.from("firm_features").select("*").eq("firm_id", id),
    admin.from("tasks").select("id", { count: "exact", head: true }).eq("firm_id", id),
  ]);
  if (!firm) notFound();
  return (
    <div className="space-y-4">
      <PageTitle actions={<FirmActions firmId={firm.id} plan={firm.plan} />}>{firm.name}</PageTitle>
      <div className="card-white grid gap-3 p-4 text-sm sm:grid-cols-4">
        <div><div className="text-muted">{t("admin.colPlan")}</div><div className="font-semibold">{firm.plan}</div></div>
        <div><div className="text-muted">{t("admin.colTrial")}</div><div className="font-semibold tabular-nums">{formatDate(firm.trial_ends_at.slice(0, 10), locale)}</div></div>
        <div><div className="text-muted">{t("admin.colTasks")}</div><div className="font-semibold tabular-nums">{tasks ?? 0}</div></div>
        <div><div className="text-muted">{t("admin.colOwner")}</div><div className="font-semibold">{firm.contact_email ?? "—"}</div></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-white p-4">
          <h2 className="mb-3 font-semibold">{t("admin.firms")}: {t("employees.title")}</h2>
          <ul className="divide-y divide-line/60 text-sm">
            {(members ?? []).map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{m.full_name} <span className="text-muted">· {m.role}{m.archived_at ? " · archived" : ""}</span></span>
                <span className="text-muted">{m.email ?? "—"}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card-white p-4">
          <h2 className="mb-3 font-semibold">{t("admin.firmFlags")}</h2>
          <ul className="space-y-2 text-sm">
            {FEATURES.map((k) => {
              const o = overrides?.find((x) => x.key === k);
              const def = flags?.find((x) => x.key === k)?.default_enabled ?? true;
              const value = !o || o.set_by !== "admin" ? "default" : o.enabled ? "on" : "off";
              return (
                <li key={k} className="flex items-center justify-between gap-2">
                  <span><code>{k}</code> <span className="text-muted">({t("admin.globalDefault")}: {def ? "on" : "off"}{o && o.set_by === "boss" ? `, Chef: ${o.enabled ? "on" : "off"}` : ""})</span></span>
                  <FirmFlagSelect firmId={firm.id} flagKey={k} value={value} />
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
