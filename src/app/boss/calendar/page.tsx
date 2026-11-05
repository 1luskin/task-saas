import { Suspense } from "react";
import { requireBossPage } from "@/lib/auth";
import { getCalendarAbsences, getCalendarTasks, getMembers, parseCalParams } from "@/server/queries";
import { isEnabled } from "@/lib/features";
import { Calendar } from "@/components/calendar/calendar";
import { ViewTabs } from "@/components/tasks/view-tabs";

export default async function BossCalendarPage({ searchParams }: { searchParams: Promise<{ cal?: string; view?: string }> }) {
  const ctx = await requireBossPage();
  const { anchor, view } = parseCalParams(await searchParams);
  const members = await getMembers(ctx, { includeArchived: true });
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.full_name ?? null;
  const [tasks, absences] = await Promise.all([
    getCalendarTasks(ctx, view, anchor, nameOf),
    isEnabled(ctx, "team").then((on) => (on ? getCalendarAbsences(ctx, view, anchor, nameOf) : [])),
  ]);
  return (
    <div className="space-y-4">
    <div className="flex justify-end"><ViewTabs active="calendar" /></div>
    <Suspense>
      <Calendar key={`${view}-${anchor}`} tasks={tasks} view={view} anchor={anchor} taskHref="/boss/tasks/" draggable absences={absences} />
    </Suspense>
    </div>
  );
}
