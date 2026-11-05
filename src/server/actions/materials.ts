"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { assertBoss, assertMember, assertWritable } from "@/lib/auth";
import { assertFeature } from "@/lib/features";
import { ActionError, check, runAction } from "@/lib/action";
import { parseMoneyToCents } from "@/lib/money";
import { uuid } from "@/lib/validation";
import { notifyBosses } from "@/server/notify";

const qty = z.number().finite().positive().max(100000);
const parseQty = (s: string | number) => Number(String(s).replace(",", "."));

export async function saveMaterial(id: string | null, raw: { name: string; unit: string; minStock: string; unitCost: string; stock?: string }) {
  return runAction(async () => {
    const ctx = await assertBoss();
    await assertFeature(ctx, "materials");
    assertWritable(ctx);
    const i = z.object({ name: z.string().trim().min(1).max(120), unit: z.string().trim().min(1).max(20) }).parse(raw);
    const minStock = parseQty(raw.minStock || "0");
    const cost = raw.unitCost.trim() ? parseMoneyToCents(raw.unitCost) : 0;
    if (!Number.isFinite(minStock) || minStock < 0 || cost === null || !Number.isFinite(cost) || cost > 10000000) throw new ActionError("invalid");
    const row = { name: i.name, unit: i.unit, min_stock: minStock, unit_cost_cents: cost };
    if (id) {
      check(await ctx.supabase.from("materials").update(row).eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id));
    } else {
      const { data, error } = await ctx.supabase.from("materials").insert({ ...row, firm_id: ctx.firm.id }).select("id").single();
      if (error) throw error;
      const start = parseQty(raw.stock || "0");
      if (start > 0) {
        const r = await ctx.supabase.rpc("adjust_material_stock", { p_material: data.id, p_qty: qty.parse(start), p_kind: "in", p_unit_cost_cents: cost });
        if (r.error) throw r.error;
      }
    }
    revalidatePath("/boss/materials");
  });
}

export async function archiveMaterial(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("materials").update({ archived_at: new Date().toISOString() }).eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id));
    revalidatePath("/boss/materials");
  });
}

/** Zugang (Lieferung, optional neuer Einkaufspreis) oder Korrektur (±, mit Notiz) */
export async function adjustStock(raw: { id: string; kind: "in" | "correction"; qty: string; unitCost?: string; note?: string }) {
  return runAction(async () => {
    const ctx = await assertBoss();
    await assertFeature(ctx, "materials");
    const q = parseQty(raw.qty);
    if (!Number.isFinite(q) || q === 0 || Math.abs(q) > 1000000) throw new ActionError("invalid");
    const cost = raw.unitCost?.trim() ? parseMoneyToCents(raw.unitCost) : null;
    if (cost !== null && !Number.isFinite(cost)) throw new ActionError("invalid");
    const { error } = await ctx.supabase.rpc("adjust_material_stock", {
      p_material: uuid.parse(raw.id), p_qty: q, p_kind: z.enum(["in", "correction"]).parse(raw.kind), p_unit_cost_cents: cost, p_note: raw.note?.slice(0, 300) ?? null,
    });
    if (error) throw error;
    revalidatePath("/boss/materials");
  });
}

/** Entnahme auf eine Aufgabe (Mitarbeiter auf eigener Aufgabe oder Chef) → Ausgabe der Aufgabe */
export async function useMaterial(raw: { taskId: string; materialId: string; qty: string }) {
  return runAction(async () => {
    const ctx = await assertMember();
    await assertFeature(ctx, "materials");
    assertWritable(ctx);
    const q = qty.parse(parseQty(raw.qty));
    const { data, error } = await ctx.supabase.rpc("use_material", { p_material: uuid.parse(raw.materialId), p_task: uuid.parse(raw.taskId), p_qty: q });
    if (error) {
      if (error.hint === "insufficient_stock") throw new ActionError("invalid", "insufficient_stock");
      throw error;
    }
    const r = data?.[0];
    if (r?.first_low) {
      const { data: mat } = await ctx.supabase.from("materials").select("name, unit").eq("id", raw.materialId).maybeSingle();
      const firmId = ctx.firm.id;
      after(() => notifyBosses(firmId, (t) => ({ title: t("mat.lowPush"), body: `${mat?.name ?? ""}: ${r.stock} ${mat?.unit ?? ""}`, url: "/boss/materials", tag: `mat-${raw.materialId}` }), "material_low"));
    }
    revalidatePath(`/boss/tasks/${raw.taskId}`);
    revalidatePath(`/staff/tasks/${raw.taskId}`);
    revalidatePath("/boss/materials");
    return { low: r?.low ?? false };
  });
}
