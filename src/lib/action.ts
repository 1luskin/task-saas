import "server-only";
import { z } from "zod";
import { AuthError } from "./auth";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: "unauthenticated" | "forbidden" | "expired" | "invalid" | "unavailable" | "error"; message?: string };

/** Einheitliche Fehlerbehandlung für Server Actions. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    if (e instanceof z.ZodError) return { ok: false, error: "invalid", message: e.issues[0]?.message };
    if (e instanceof ActionError) return { ok: false, error: e.code, message: e.message };
    const msg = (e as { message?: string; hint?: string })?.message ?? "";
    const hint = (e as { hint?: string })?.hint ?? "";
    if (hint === "member_unavailable" || msg.includes("assignee unavailable")) return { ok: false, error: "unavailable" };
    if (msg.includes("row-level security") && msg.includes("violates")) return { ok: false, error: "forbidden" };
    if (msg.includes("not allowed") || (e as { code?: string })?.code === "42501") return { ok: false, error: "forbidden" };
    console.error("[action]", e);
    return { ok: false, error: "error" };
  }
}

export class ActionError extends Error {
  constructor(public code: "invalid" | "forbidden" | "unavailable" | "error", message?: string) {
    super(message ?? code);
  }
}

/** Supabase-Fehler in Exceptions umwandeln */
export function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

/** Wie check, aber Ergebnis darf nicht leer sein (für .single()) */
export function must<R extends { data: unknown; error: unknown }>(res: R): NonNullable<R["data"]> {
  if (res.error) throw res.error;
  if (res.data == null) throw new ActionError("forbidden");
  return res.data as NonNullable<R["data"]>;
}
