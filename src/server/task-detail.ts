import "server-only";
import type { Ctx } from "@/lib/auth";
import { taskPay } from "@/lib/earnings";
import { minutesBetween } from "@/lib/dates";

export async function loadTaskDetail(ctx: Ctx, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data: task } = await ctx.supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (!task) return null; // RLS: fremde Aufgaben sind unsichtbar
  const isBoss = ctx.member.role === "boss";

  const [checklist, comments, photos, entries, finance, assignee, expenses] = await Promise.all([
    ctx.supabase.from("checklist_items").select("*").eq("task_id", id).order("position"),
    ctx.supabase.from("task_comments").select("*").eq("task_id", id).order("created_at"),
    ctx.supabase.from("task_photos").select("*").eq("task_id", id).order("created_at"),
    ctx.supabase.from("time_entries").select("*").eq("task_id", id).order("started_at"),
    isBoss ? ctx.supabase.from("task_finance").select("*").eq("task_id", id).maybeSingle() : Promise.resolve({ data: null }),
    task.assignee_id ? ctx.supabase.from("members").select("*").eq("id", task.assignee_id).maybeSingle() : Promise.resolve({ data: null }),
    ctx.supabase.from("expenses").select("*").eq("task_id", id).order("created_at"),
  ]);
  const { data: fileRows } = await ctx.supabase.from("task_files").select("*").eq("task_id", id).order("created_at");
  const fileUrls = new Map<string, string>();
  if (fileRows?.length) {
    const { data } = await ctx.supabase.storage.from("task-files").createSignedUrls(fileRows.map((f) => f.storage_path), 15 * 60);
    fileRows.forEach((f, i) => { const u = data?.[i]?.signedUrl; if (u) fileUrls.set(f.id, u); });
  }
  const expRows = expenses.data ?? [];
  const receiptPaths = expRows.filter((e) => e.receipt_path).map((e) => e.receipt_path!);
  const receiptUrls = new Map<string, string>();
  if (receiptPaths.length) {
    const { data } = await ctx.supabase.storage.from("receipts").createSignedUrls(receiptPaths, 15 * 60);
    receiptPaths.forEach((p, i) => { const u = data?.[i]?.signedUrl; if (u) receiptUrls.set(p, u); });
  }
  const { data: expMembers } = expRows.length
    ? await ctx.supabase.from("members").select("id, full_name").in("id", [...new Set(expRows.map((e) => e.member_id))])
    : { data: [] as { id: string; full_name: string }[] };

  const photoRows = photos.data ?? [];
  let urls: (string | null)[] = [];
  if (photoRows.length) {
    const { data } = await ctx.supabase.storage.from("task-photos").createSignedUrls(photoRows.map((p) => p.storage_path), 15 * 60); // ≤ 15 min
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
    photos: photoRows.map((p, i) => ({ id: p.id, url: urls[i] ?? null, uploaded_by: p.uploaded_by, kind: p.kind })),
    entries: allEntries,
    runningMine,
    closedMinutesMine,
    pay,
    clientPriceCents: finance.data?.client_price_cents ?? 0,
    assignee: assignee.data,
    expenses: expRows.map((e) => ({
      id: e.id, amount_cents: e.amount_cents, description: e.description, status: e.status, reimburse: e.reimburse, member_id: e.member_id,
      receiptUrl: e.receipt_path ? receiptUrls.get(e.receipt_path) ?? null : null,
      memberName: expMembers?.find((m) => m.id === e.member_id)?.full_name ?? "",
    })),
    files: (fileRows ?? []).map((f) => ({ id: f.id, name: f.file_name, size: f.size_bytes, url: fileUrls.get(f.id) ?? null, uploaded_by: f.uploaded_by })),
    expensesApprovedCents: expRows.filter((e) => e.status === "approved").reduce((s, e) => s + e.amount_cents, 0),
  };
}
