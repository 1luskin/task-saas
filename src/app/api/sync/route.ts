import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthError, assertMember } from "@/lib/auth";
import { applyOp, syncOpSchema } from "@/server/task-ops";
import { ActionError } from "@/lib/action";
import { hit } from "@/lib/rate-limit";

const bodySchema = z.object({
  ops: z.array(z.object({ id: z.string().min(1).max(64), op: z.unknown() }).passthrough()).max(200),
});

/**
 * Offline-Sync: Der Client schickt seine Warteschlange. Jede Operation wird
 * einzeln geprüft und angewendet; Ergebnis pro Operation zurück.
 */
export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await assertMember();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: 401 });
    throw e;
  }
  if (!(await hit("sync", ctx.userId))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const raw of parsed.data.ops) {
    const { id, ...rest } = raw;
    const op = syncOpSchema.safeParse(rest);
    if (!op.success) {
      results.push({ id, ok: false, error: "invalid" });
      continue;
    }
    try {
      await applyOp(ctx, op.data);
      results.push({ id, ok: true });
    } catch (e) {
      // Fachlich unzulässig (z. B. Aufgabe gelöscht/neu zugewiesen) → verwerfen.
      // Sonstige Fehler → Client versucht es später erneut.
      const code = (e as { code?: string })?.code;
      const permanent = e instanceof ActionError || code === "42501" || code === "23514" || code === "23503";
      if (!permanent) console.error("[sync]", e);
      results.push({ id, ok: false, error: permanent ? "rejected" : "retry" });
    }
  }
  revalidatePath("/staff", "layout");
  revalidatePath("/boss", "layout");
  return NextResponse.json({ results });
}
