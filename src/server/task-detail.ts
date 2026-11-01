import "server-only";
import type { Ctx } from "@/lib/auth";
import { taskPay } from "@/lib/earnings";
import { minutesBetween } from "@/lib/dates";

export async function loadTaskDetail(ctx: Ctx, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data: task } = await ctx.supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (!task) return null; // RLS: fremde Aufgaben sind unsichtbar
  const isBoss = ctx.member.role === "boss";

  const [checklist, comments, photos, entries, finance, assignee] = await Promise.all([
    ctx.supabase.from("checklist_items").select("*").eq("task_id", id).order("position"),
    ctx.supabase.from("task_comments").select("*").eq("task_id", id).order("created_at"),
    ctx.supabase.from("task_photos").select("*").eq("task_id", id).order("created_at"),
    ctx.supabase.from("time_entries").select("*").eq("task_id", id).order("started_at"),
    isBoss ? ctx.supabase.from("task_finance").select("*").eq("task_id", id).maybeSingle() : Promise.resolve({ data: null }),
    task.assignee_id ? ctx.supabase.from("members").select("*").eq("id", task.assignee_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const photoRows = photos.data ?? [];
  let urls: (string | null)[] = [];
  if (photoRows.length) {
    const { data } = await ctx.supabase.storage.from("task-photos").createSignedUrls(photoRows.map((p) => p.storage_path), 60 * 60);
    urls = photoRows.map((_, i) => data?.[i]?.signedUrl ?? null);
  }

  const allEntries = entries.data ?? [];
  const myEntries = allEntries.filter((e) => e.member_id === ctx.member.id);
  const runningMine = myEntries.find((e) => !e.ended_at)?.started_at ?? null;
  const closedMinutesMine = myEntries.filter((e) => e.ended_at).reduce((s, e) => s + minutesBetween(e.started_at, e.ended_at), 0);
  const pay = taskPay(task, allEntries);

  return {
    task,
    checklist: checklist.data ?? [],
    comments: comments.data ?? [],
    photos: photoRows.map((p, i) => ({ id: p.id, url: urls[i] ?? null, uploaded_by: p.uploaded_by })),
    entries: allEntries,
    runningMine,
    closedMinutesMine,
    pay,
    clientPriceCents: finance.data?.client_price_cents ?? 0,
    assignee: assignee.data,
  };
}
