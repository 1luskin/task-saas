import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { loadTaskDetail } from "@/server/task-detail";
import { TaskDetail } from "@/components/tasks/task-detail";
import { isEnabled } from "@/lib/features";

export default async function StaffTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage();
  const { t, locale } = await getI18n();
  const d = await loadTaskDetail(ctx, id);
  if (!d) notFound();
  return <TaskDetail d={d} ctx={ctx} t={t} locale={locale} backHref="/staff/today" expensesOn={await isEnabled(ctx, "expenses")} geoOn={await isEnabled(ctx, "geolocation")} />;
}
