"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertBoss, assertWritable } from "@/lib/auth";
import { ActionError, check, must, runAction } from "@/lib/action";
import { assertFeature } from "@/lib/features";
import { optText, uuid } from "@/lib/validation";

const clientInput = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.preprocess((v) => (v === "" ? null : v), z.string().trim().email().max(254).nullable().optional()).transform((v) => v ?? null),
  phone: optText(40),
  address: optText(300),
  notes: optText(2000),
  hide_price: z.boolean().default(false),
});

export async function saveClient(id: string | null, raw: z.input<typeof clientInput>) {
  return runAction(async () => {
    const ctx = await assertBoss();
    await assertFeature(ctx, "clients");
    const input = clientInput.parse(raw);
    if (id) {
      check(await ctx.supabase.from("clients").update(input).eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id));
      revalidatePath("/boss/clients", "layout");
      return { id };
    }
    assertWritable(ctx);
    const c = must(await ctx.supabase.from("clients").insert({ ...input, firm_id: ctx.firm.id }).select("id").single());
    revalidatePath("/boss/clients", "layout");
    return { id: c.id };
  });
}

export async function deleteClient(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("clients").delete().eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id));
    revalidatePath("/boss/clients", "layout");
  });
}

/** Kunden-Link anlegen (alte für die Aufgabe werden widerrufen → "neu erstellen") */
export async function createTaskLink(taskId: string, days = 60) {
  return runAction(async () => {
    const ctx = await assertBoss();
    await assertFeature(ctx, "clients");
    assertWritable(ctx);
    const tid = uuid.parse(taskId);
    must(await ctx.supabase.from("tasks").select("id").eq("id", tid).eq("firm_id", ctx.firm.id).maybeSingle());
    await ctx.supabase.from("task_links").update({ revoked: true }).eq("task_id", tid).eq("revoked", false);
    const link = must(
      await ctx.supabase
        .from("task_links")
        .insert({ task_id: tid, created_by: ctx.member.id, expires_at: new Date(Date.now() + z.number().int().min(1).max(365).parse(days) * 864e5).toISOString() })
        .select("token")
        .single(),
    );
    revalidatePath(`/boss/tasks/${tid}`);
    return { token: link.token };
  });
}

export async function revokeTaskLink(linkId: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("task_links").update({ revoked: true }).eq("id", uuid.parse(linkId)).eq("firm_id", ctx.firm.id));
    revalidatePath("/boss", "layout");
  });
}

/** Website-Anfrage → Kunde + Aufgabe (ein Klick) */
export async function convertInbound(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    assertWritable(ctx);
    const req = must(await ctx.supabase.from("inbound_requests").select("*").eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id).maybeSingle());
    if (req.status !== "new") throw new ActionError("invalid");
    const isMail = /@/.test(req.contact);
    const client = must(
      await ctx.supabase
        .from("clients")
        .insert({ firm_id: ctx.firm.id, name: req.name, email: isMail ? req.contact : null, phone: isMail ? null : req.contact, address: req.address })
        .select("id")
        .single(),
    );
    const task = must(
      await ctx.supabase
        .from("tasks")
        .insert({ firm_id: ctx.firm.id, title: req.message.slice(0, 120), description: req.message, address: req.address, client_id: client.id, created_by: ctx.member.id })
        .select("id")
        .single(),
    );
    check(await ctx.supabase.from("task_finance").insert({ task_id: task.id, client_price_cents: 0 }));
    check(await ctx.supabase.from("inbound_requests").update({ status: "converted", task_id: task.id, client_id: client.id }).eq("id", req.id));
    revalidatePath("/boss", "layout");
    return { taskId: task.id };
  });
}

export async function dismissInbound(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("inbound_requests").update({ status: "dismissed" }).eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id));
    revalidatePath("/boss/requests");
  });
}

export async function setPublicSlug(slug: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const v = slug.trim() === "" ? null : z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,40}$/).parse(slug);
    check(await ctx.supabase.from("firms").update({ public_slug: v }).eq("id", ctx.firm.id));
    revalidatePath("/boss/settings");
  });
}
