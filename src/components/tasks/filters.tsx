"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { Select } from "../ui";

export function TaskFilters({ members, groups }: { members: { id: string; full_name: string }[]; groups: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (k: string, v: string) => {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set(k, v);
    else sp.delete(k);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Select aria-label={t("dashboard.filterStatus")} value={params.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}>
        <option value="">{t("dashboard.openOnly")}</option>
        <option value="overdue">{t("dashboard.overdue")}</option>
        <option value="new">{t("status.new")}</option>
        <option value="in_progress">{t("status.in_progress")}</option>
        <option value="done">{t("status.done")}</option>
        <option value="all">{t("common.all")}</option>
      </Select>
      <Select aria-label={t("dashboard.filterEmployee")} value={params.get("member") ?? ""} onChange={(e) => set("member", e.target.value)}>
        <option value="">{t("dashboard.filterEmployee")}: {t("common.all")}</option>
        <option value="none">{t("dashboard.unassigned")}</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.full_name}</option>
        ))}
      </Select>
      <Select aria-label={t("dashboard.filterPriority")} value={params.get("priority") ?? ""} onChange={(e) => set("priority", e.target.value)}>
        <option value="">{t("dashboard.filterPriority")}: {t("common.all")}</option>
        <option value="urgent">{t("priority.urgent")}</option>
        <option value="normal">{t("priority.normal")}</option>
      </Select>
      <Select aria-label={t("dashboard.filterGroup")} value={params.get("group") ?? ""} onChange={(e) => set("group", e.target.value)} disabled={!groups.length}>
        <option value="">{t("dashboard.filterGroup")}: {t("common.all")}</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </Select>
    </div>
  );
}
