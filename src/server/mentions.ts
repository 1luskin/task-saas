import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { parseMentions } from "@/lib/mentions";

/** @Name → Mitglieder-IDs, die die Aufgabe sehen dürfen (Chefs der Firma + Ausführender), ohne Autor */
export async function resolveMentions(firmId: string, taskId: string, body: string, authorId: string): Promise<string[]> {
  const admin = createAdminClient();
  const [{ data: task }, { data: members }] = await Promise.all([
    admin.from("tasks").select("assignee_id").eq("id", taskId).eq("firm_id", firmId).single(),
    admin.from("members").select("id, full_name, role").eq("firm_id", firmId).is("archived_at", null),
  ]);
  const allowed = (members ?? []).filter((m) => m.role === "boss" || m.id === task?.assignee_id);
  return parseMentions(body, allowed).filter((id) => id !== authorId);
}
