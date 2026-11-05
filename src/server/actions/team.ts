"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { assertBoss as assertBossBase, assertMember as assertMemberBase, assertWritable } from "@/lib/auth";
import { assertFeature, type FeatureKey } from "@/lib/features";
import { ActionError, check, must, runAction } from "@/lib/action";
import { isoDate, optUuid, uuid } from "@/lib/validation";
import { workdaysBetween } from "@/lib/vacation";
import { notifyBosses } from "@/server/notify";
import { sendPushToMembers } from "@/lib/push";

async function assertBoss(k: FeatureKey = "team") {
  const ctx = await assertBossBase();
  await assertFeature(ctx, k);
  return ctx;
}
async function assertMember(k: FeatureKey = "team") {
  const ctx = await assertMemberBase();
  await assertFeature(ctx, k);
  return ctx;
}

const refresh = () => {
  revalidatePath("/boss", "layout");
  revalidatePath("/staff", "layout");
};
const time = z.string().regex(/^\d{2}:\d{2}$/);

// --- Dienstplan -------------------------------------------------------------
export async function addPlan(raw: { memberId: string; date: string; start: string; end: string; note?: string }) {
  return runAction(async () => {
    const ctx = await assertBoss();
    assertWritable(ctx);
    const i = z.object({ memberId: uuid, date: isoDate, start: time, end: time, note: z.string().max(300).optional() }).parse(raw);
    if (!i.date || i.end <= i.start) throw new ActionError("invalid");
    check(await ctx.supabase.from("shift_plans").insert({ firm_id: ctx.firm.id, member_id: i.memberId, date: i.date, start_time: i.start, end_time: i.end, note: i.note || null }));
    refresh();
  });
}
export async function deletePlan(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("shift_plans").delete().eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id));
    refresh();
  });
}
export async function requestSwap(planId: string, toMember: string) {
  return runAction(async () => {
    const ctx = await assertMember();
    check(await ctx.supabase.from("shift_swaps").insert({ firm_id: ctx.firm.id, plan_id: uuid.parse(planId), from_member: ctx.member.id, to_member: uuid.parse(toMember) }));
    const to = uuid.parse(toMember), who = ctx.member.full_name;
    after(() => sendPushToMembers([to], (t) => ({ title: t("team.swapPush"), body: who, url: "/staff/team", tag: "swap" }), "shift_swap"));
    refresh();
  });
}
export async function decideSwap(id: string, action: "accept" | "approve" | "reject") {
  return runAction(async () => {
    const ctx = await assertMember();
    const { error } = await ctx.supabase.rpc("decide_swap", { p_swap: uuid.parse(id), p_action: z.enum(["accept", "approve", "reject"]).parse(action) });
    if (error) throw error;
    if (action === "accept") {
      const firmId = ctx.firm.id;
      after(() => notifyBosses(firmId, (t) => ({ title: t("team.swapPush"), body: t("team.swapAccepted"), url: "/boss/team", tag: "swap" }), "shift_swap"));
    }
    refresh();
  });
}

// --- Urlaub -----------------------------------------------------------------
export async function requestVacation(raw: { from: string; to: string; note?: string }) {
  return runAction(async () => {
    const ctx = await assertMember();
    const i = z.object({ from: isoDate, to: isoDate, note: z.string().max(500).optional() }).parse(raw);
    if (!i.from || !i.to || i.to < i.from) throw new ActionError("invalid");
    const days = Math.max(1, workdaysBetween(i.from, i.to));
    check(await ctx.supabase.from("vacation_requests").insert({ firm_id: ctx.firm.id, member_id: ctx.member.id, date_from: i.from, date_to: i.to, days, note: i.note || null }));
    const firmId = ctx.firm.id, who = ctx.member.full_name;
    after(() => notifyBosses(firmId, (t) => ({ title: t("team.vacationPush"), body: `${who}: ${i.from} – ${i.to}`, url: "/boss/team", tag: "vacation" }), "vacation_request"));
    refresh();
  });
}
export async function decideVacation(id: string, approve: boolean) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const v = must(
      await ctx.supabase
        .from("vacation_requests")
        .update({ status: approve ? "approved" : "rejected", decided_by: ctx.member.id, decided_at: new Date().toISOString() })
        .eq("id", uuid.parse(id))
        .eq("firm_id", ctx.firm.id)
        .select("member_id")
        .single(),
    );
    after(() => sendPushToMembers([v.member_id], (t) => ({ title: t("team.vacationAnswer"), body: approve ? t("team.approved") : t("team.rejected"), url: "/staff/team", tag: "vacation" }), "vacation_answer"));
    refresh();
  });
}
export async function deleteMyVacation(id: string) {
  return runAction(async () => {
    const ctx = await assertMember();
    check(await ctx.supabase.from("vacation_requests").delete().eq("id", uuid.parse(id)).eq("member_id", ctx.member.id).eq("status", "pending"));
    refresh();
  });
}

// --- Schwarzes Brett ----------------------------------------------------------
export async function createAnnouncement(raw: { title: string; body: string; groupId?: string | null }) {
  return runAction(async () => {
    const ctx = await assertBoss();
    assertWritable(ctx);
    const i = z.object({ title: z.string().trim().min(1).max(160), body: z.string().trim().min(1).max(5000), groupId: optUuid }).parse(raw);
    check(await ctx.supabase.from("announcements").insert({ firm_id: ctx.firm.id, title: i.title, body: i.body, group_id: i.groupId, created_by: ctx.member.id }));
    refresh();
  });
}
export async function deleteAnnouncement(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    check(await ctx.supabase.from("announcements").delete().eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id));
    refresh();
  });
}
export async function markAnnouncementRead(id: string) {
  return runAction(async () => {
    const ctx = await assertMember();
    await ctx.supabase.from("announcement_reads").insert({ announcement_id: uuid.parse(id), member_id: ctx.member.id });
    revalidatePath("/staff/team");
  });
}

// --- Tagesbericht -------------------------------------------------------------
export async function createDailyReport(raw: { id: string; date: string; taskId?: string | null; done: string; problems?: string; photoPaths?: string[] }) {
  return runAction(async () => {
    const ctx = await assertMember();
    const i = z
      .object({ id: uuid, date: isoDate, taskId: optUuid, done: z.string().trim().min(1).max(5000), problems: z.string().trim().max(3000).optional(), photoPaths: z.array(z.string().max(300)).max(10).optional() })
      .parse(raw);
    for (const p of i.photoPaths ?? []) if (!p.startsWith(`${ctx.firm.id}/${ctx.member.id}/`)) throw new ActionError("forbidden");
    const exists = check(await ctx.supabase.from("daily_reports").select("id").eq("id", i.id).maybeSingle());
    if (exists) return; // idempotent (Offline)
    check(
      await ctx.supabase.from("daily_reports").insert({
        id: i.id, firm_id: ctx.firm.id, member_id: ctx.member.id, date: i.date!, task_id: i.taskId, done_text: i.done, problems: i.problems || null, photo_paths: i.photoPaths ?? [],
      }),
    );
    refresh();
  });
}

// --- Dokumente der Mitarbeiter ------------------------------------------------
export async function saveDocument(raw: { memberId: string; name: string; expiresOn: string | null; filePath?: string | null }) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const i = z.object({ memberId: uuid, name: z.string().trim().min(1).max(120), expiresOn: isoDate, filePath: z.string().max(300).nullable().optional() }).parse(raw);
    if (i.filePath && !i.filePath.startsWith(`${ctx.firm.id}/${i.memberId}/`)) throw new ActionError("forbidden");
    check(await ctx.supabase.from("member_documents").insert({ firm_id: ctx.firm.id, member_id: i.memberId, name: i.name, expires_on: i.expiresOn, file_path: i.filePath ?? null }));
    refresh();
  });
}
export async function deleteDocument(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const d = must(await ctx.supabase.from("member_documents").select("*").eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id).maybeSingle());
    if (d.file_path) await ctx.supabase.storage.from("member-docs").remove([d.file_path]);
    check(await ctx.supabase.from("member_documents").delete().eq("id", d.id));
    refresh();
  });
}

// --- Wissensdatenbank & Formulare ---------------------------------------------
export async function saveArticle(id: string | null, raw: { title: string; body: string }) {
  return runAction(async () => {
    const ctx = await assertBoss("knowledge");
    const i = z.object({ title: z.string().trim().min(1).max(160), body: z.string().max(20000) }).parse(raw);
    if (id) check(await ctx.supabase.from("kb_articles").update({ ...i, updated_at: new Date().toISOString() }).eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id));
    else check(await ctx.supabase.from("kb_articles").insert({ ...i, firm_id: ctx.firm.id }));
    refresh();
  });
}
export async function deleteArticle(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss("knowledge");
    check(await ctx.supabase.from("kb_articles").delete().eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id));
    refresh();
  });
}

const fieldSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,20}$/i),
  type: z.enum(["text", "number", "checkbox", "select", "photo"]),
  label: z.string().trim().min(1).max(120),
  options: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
});
export async function saveFormTemplate(raw: { name: string; fields: unknown }) {
  return runAction(async () => {
    const ctx = await assertBoss("knowledge");
    const i = z.object({ name: z.string().trim().min(1).max(120), fields: z.array(fieldSchema).min(1).max(40) }).parse(raw);
    check(await ctx.supabase.from("form_templates").insert({ firm_id: ctx.firm.id, name: i.name, fields: i.fields }));
    refresh();
  });
}
export async function deleteFormTemplate(id: string) {
  return runAction(async () => {
    const ctx = await assertBoss("knowledge");
    check(await ctx.supabase.from("form_templates").delete().eq("id", uuid.parse(id)).eq("firm_id", ctx.firm.id));
    refresh();
  });
}
export async function submitForm(raw: { taskId: string; templateId: string; values: Record<string, unknown> }) {
  return runAction(async () => {
    const ctx = await assertMember("knowledge");
    assertWritable(ctx);
    const tpl = must(await ctx.supabase.from("form_templates").select("*").eq("id", uuid.parse(raw.templateId)).eq("firm_id", ctx.firm.id).maybeSingle());
    // Nur bekannte Felder mit passendem Typ übernehmen
    const values: Record<string, string | number | boolean> = {};
    for (const f of tpl.fields) {
      const v = raw.values[f.id];
      if (v === undefined || v === null || v === "") continue;
      if (f.type === "checkbox") values[f.id] = Boolean(v);
      else if (f.type === "number") { const n = Number(v); if (Number.isFinite(n)) values[f.id] = n; }
      else if (f.type === "select") { if (f.options?.includes(String(v))) values[f.id] = String(v); }
      else if (f.type === "photo") {
        const pth = String(v);
        if (!pth.startsWith(`${ctx.firm.id}/${raw.taskId}/`) || pth.includes("..")) throw new ActionError("forbidden");
        values[f.id] = pth;
      } else values[f.id] = String(v).slice(0, 2000);
    }
    const sub = must(await ctx.supabase.from("form_submissions").insert({ task_id: uuid.parse(raw.taskId), template_id: tpl.id, values, submitted_by: ctx.member.id }).select("id").single());
    refresh();
    return { id: sub.id };
  });
}

export async function setVacationDays(memberId: string, days: number) {
  return runAction(async () => {
    const ctx = await assertBoss();
    const d = z.number().int().min(0).max(60).parse(days);
    check(await ctx.supabase.from("members").update({ vacation_days_per_year: d }).eq("id", uuid.parse(memberId)).eq("firm_id", ctx.firm.id));
    refresh();
  });
}

export async function setTaskArticle(taskId: string, articleId: string | null) {
  return runAction(async () => {
    const ctx = await assertBoss("knowledge");
    check(await ctx.supabase.from("tasks").update({ kb_article_id: articleId ? uuid.parse(articleId) : null }).eq("id", uuid.parse(taskId)).eq("firm_id", ctx.firm.id));
    revalidatePath(`/boss/tasks/${taskId}`);
  });
}
