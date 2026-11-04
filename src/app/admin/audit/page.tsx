import { requireSuperadmin } from "@/lib/superadmin";
import { getI18n } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { PageTitle } from "@/components/ui";

export default async function AdminAudit() {
  const { admin } = await requireSuperadmin();
  const { t, locale } = await getI18n();
  const { data } = await admin.from("admin_audit").select("*").order("created_at", { ascending: false }).limit(200);
  return (
    <div className="space-y-4">
      <PageTitle>{t("admin.audit")}</PageTitle>
      <ul className="card-white divide-y divide-line/60 text-sm">
        {(data ?? []).map((a) => (
          <li key={a.id} className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-2">
            <span className="tabular-nums text-muted">{formatDateTime(a.created_at, locale)}</span>
            <span className="font-medium">{a.action}</span>
            <span className="text-ink-2">{a.target}</span>
            <span className="text-muted">{a.admin_email}</span>
            <code className="w-full truncate text-xs text-muted">{JSON.stringify(a.details)}</code>
          </li>
        ))}
        {!data?.length && <li className="px-4 py-6 text-center text-muted">—</li>}
      </ul>
    </div>
  );
}
