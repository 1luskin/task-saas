import { requireSuperadmin } from "@/lib/superadmin";
import { getI18n } from "@/i18n/server";
import { GlobalFlagToggle } from "@/components/admin/flag-controls";
import { PageTitle } from "@/components/ui";

export default async function AdminFlags() {
  const { admin } = await requireSuperadmin();
  const { t } = await getI18n();
  const { data: flags } = await admin.from("feature_flags").select("*").order("key");
  return (
    <div className="space-y-4">
      <PageTitle>{t("admin.flags")}</PageTitle>
      <ul className="card-white divide-y divide-line/60">
        {(flags ?? []).map((f) => (
          <li key={f.key} className="flex items-center justify-between gap-3 px-4 py-3">
            <div><code className="font-medium">{f.key}</code><div className="text-sm text-muted">{f.description}</div></div>
            <GlobalFlagToggle flagKey={f.key} enabled={f.default_enabled} />
          </li>
        ))}
      </ul>
    </div>
  );
}
