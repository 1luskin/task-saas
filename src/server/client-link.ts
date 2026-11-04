import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Kunden-Link: Zugriff NUR über gültigen Token (nicht widerrufen, nicht abgelaufen).
 * Liefert ausschließlich Daten DIESER einen Aufgabe – serverseitig mit service_role.
 */
export async function resolveLink(token: string) {
  if (!/^[0-9a-z]{32,128}$/i.test(token)) return null;
  const admin = createAdminClient();
  const { data: link } = await admin.from("task_links").select("*").eq("token", token).maybeSingle();
  if (!link || link.revoked || new Date(link.expires_at).getTime() < Date.now()) return null;
  const { data: task } = await admin.from("tasks").select("*").eq("id", link.task_id).maybeSingle();
  if (!task) return null;
  return { admin, link, task };
}

export async function loadLinkView(token: string) {
  const r = await resolveLink(token);
  if (!r) return null;
  const { admin, task, link } = r;
  const [{ data: firm }, { data: assignee }, { data: fin }, { data: client }, { data: photos }, { data: review }] = await Promise.all([
    admin.from("firms").select("name, logo_path, is_demo").eq("id", task.firm_id).single(),
    task.assignee_id ? admin.from("members").select("full_name").eq("id", task.assignee_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("task_finance").select("client_price_cents").eq("task_id", task.id).maybeSingle(),
    task.client_id ? admin.from("clients").select("name, hide_price").eq("id", task.client_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("task_photos").select("storage_path, kind").eq("task_id", task.id).order("created_at"),
    admin.from("reviews").select("id").eq("task_id", task.id).limit(1),
  ]);
  const list = photos ?? [];
  const urls = new Map<string, string>();
  if (list.length) {
    const { data } = await admin.storage.from("task-photos").createSignedUrls(list.map((p) => p.storage_path), 15 * 60);
    list.forEach((p, i) => { const u = data?.[i]?.signedUrl; if (u) urls.set(p.storage_path, u); });
  }
  const pic = (kind: string) => list.filter((p) => p.kind === kind && urls.has(p.storage_path)).map((p) => urls.get(p.storage_path)!);
  return {
    linkId: link.id,
    firm: { name: firm?.name ?? "", logoPath: firm?.logo_path ?? null },
    task: { id: task.id, title: task.title, status: task.status, due_date: task.due_date, address: task.address, accepted_at: task.accepted_at },
    assigneeFirstName: assignee?.full_name.split(" ")[0] ?? null,
    priceCents: client?.hide_price ? null : (fin?.client_price_cents ?? null),
    photos: { before: pic("before"), after: pic("after"), general: pic("general") },
    reviewed: (review ?? []).length > 0,
  };
}
