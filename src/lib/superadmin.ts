import "server-only";
import { notFound } from "next/navigation";
import { getContext } from "./auth";
import { createAdminClient } from "./supabase/server";
import { isDemo } from "./demo/mode";

/** E-Mails aus SUPERADMIN_EMAILS (Komma-getrennt). Im Demo-Modus: die Demo-Chefin. */
export function superadminEmails(): string[] {
  const list = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (isDemo()) list.push("chefin@demo.de");
  return list;
}

export function isSuperadminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && superadminEmails().includes(email!.toLowerCase());
}

/** Seiten/Aktionen im /admin-Bereich: sonst 404 (Bereich wird nicht verraten) */
export async function requireSuperadmin() {
  const ctx = await getContext();
  if (!ctx || !isSuperadminEmail(ctx.email)) notFound();
  return { email: ctx.email!.toLowerCase(), admin: createAdminClient() };
}

export async function audit(admin: ReturnType<typeof createAdminClient>, email: string, action: string, target: string | null, details: Record<string, unknown> = {}) {
  await admin.from("admin_audit").insert({ admin_email: email, action, target, details });
}
