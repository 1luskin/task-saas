import { Suspense } from "react";
import { requireBossPage } from "@/lib/auth";
import { getCalendarTasks, getMembers, parseCalParams } from "@/server/queries";
import { Calendar } from "@/components/calendar/calendar";

export default async function BossCalendarPage({ searchParams }: { searchParams: Promise<{ cal?: string; view?: string }> }) {
  const ctx = await requireBossPage();
  const { anchor, view } = parseCalParams(await searchParams);
  const members = await getMembers(ctx, { includeArchived: true });
  const tasks = await getCalendarTasks(ctx, view, anchor, (id) => members.find((m) => m.id === id)?.full_name ?? null);
  return (
    <Suspense>
      <Calendar tasks={tasks} view={view} anchor={anchor} taskHref="/boss/tasks/" />
    </Suspense>
  );
}
