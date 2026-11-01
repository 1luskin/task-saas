import "server-only";
import type { Ctx } from "@/lib/auth";
import { addDays, addMonths, isOverdue, startOfMonth, startOfWeek, todayISO } from "@/lib/dates";
import type { CalTask } from "@/components/calendar/calendar";
import type { Member, Task } from "@/lib/supabase/types";

export async function getMembers(ctx: Ctx, opts: { includeArchived?: boolean } = {}): Promise<Member[]> {
  let q = ctx.supabase.from("members").select("*").eq("firm_id", ctx.firm.id).order("full_name");
  if (!opts.includeArchived) q = q.is("archived_at", null);
  const { data } = await q;
  return data ?? [];
}

export async function getGroups(ctx: Ctx) {
  const { data } = await ctx.supabase.from("groups").select("*").eq("firm_id", ctx.firm.id).order("name");
  return data ?? [];
}

export async function pendingRequestCount(ctx: Ctx): Promise<number> {
  const { count } = await ctx.supabase
    .from("task_requests")
    .select("id", { count: "exact", head: true })
    .eq("firm_id", ctx.firm.id)
    .eq("status", "pending");
  return count ?? 0;
}

export function parseCalParams(sp: { cal?: string; view?: string }) {
  const anchor = sp.cal && /^\d{4}-\d{2}-\d{2}$/.test(sp.cal) ? sp.cal : todayISO();
  const view: "month" | "week" = sp.view === "week" ? "week" : "month";
  return { anchor, view };
}

export function calendarRange(view: "month" | "week", anchor: string) {
  if (view === "week") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 7) };
  }
  const from = startOfWeek(startOfMonth(anchor));
  return { from, to: addDays(startOfWeek(addMonths(startOfMonth(anchor), 1)), 7) };
}

export function toCalTasks(tasks: Task[], nameOf: (id: string | null) => string | null): CalTask[] {
  return tasks
    .filter((t) => t.due_date)
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date!,
      assigneeName: nameOf(t.assignee_id),
      overdue: isOverdue(t),
    }));
}

export async function getCalendarTasks(ctx: Ctx, view: "month" | "week", anchor: string, nameOf: (id: string | null) => string | null) {
  const { from, to } = calendarRange(view, anchor);
  const { data } = await ctx.supabase
    .from("tasks")
    .select("*")
    .eq("firm_id", ctx.firm.id)
    .gte("due_date", from)
    .lt("due_date", to)
    .order("due_time", { nullsFirst: true });
  return toCalTasks(data ?? [], nameOf);
}
