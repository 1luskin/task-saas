"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import ExcelJS from "exceljs";
import { assertBoss, assertWritable } from "@/lib/auth";
import { ActionError, must, runAction } from "@/lib/action";
import { IMPORT_MAX_ROWS, validateImportRows, type ImportError, type ImportRow } from "@/lib/import-members";
import { hit } from "@/lib/rate-limit";
import { isDemo } from "@/lib/demo/mode";
import { layout, sendEmail } from "@/lib/email";
import { getI18n } from "@/i18n/server";
import { serverEnv } from "@/lib/env";

const MAX_BYTES = 2 * 1024 * 1024;

async function readSheet(file: File): Promise<unknown[][]> {
  if (file.size > MAX_BYTES) throw new ActionError("invalid", "too_large");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer);
  } catch {
    throw new ActionError("invalid", "bad_file");
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new ActionError("invalid", "bad_file");
  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    if (n === 1) return; // Kopfzeile
    const vals = row.values as unknown[]; // 1-basiert
    rows[n - 2] = vals.slice(1, 7);
  });
  if (rows.length > IMPORT_MAX_ROWS) throw new ActionError("invalid", "too_many");
  return Array.from(rows, (r) => r ?? []);
}

/**
 * Mitarbeiter aus Excel: dry=1 → nur Vorschau mit Fehlern; sonst anlegen.
 * Jeder neue Mitarbeiter bekommt einen persönlichen Einladungslink (invites.member_id, einmalig);
 * mit E-Mail wird er direkt verschickt.
 */
export async function importMembers(fd: FormData) {
  return runAction(async (): Promise<{ valid: ImportRow[]; errors: ImportError[]; created?: number; links?: { name: string; url: string }[] }> => {
    const ctx = await assertBoss();
    assertWritable(ctx);
    const file = fd.get("file");
    if (!(file instanceof File)) throw new ActionError("invalid");
    const dry = fd.get("dry") === "1";
    const rows = await readSheet(file);
    const { data: existing } = await ctx.supabase.from("members").select("email").eq("firm_id", ctx.firm.id).not("email", "is", null);
    const { valid, errors } = validateImportRows(rows, new Set((existing ?? []).map((m) => (m.email ?? "").toLowerCase())));
    if (dry || !valid.length) return { valid, errors };
    if (!(await hit("import", `import:${ctx.firm.id}`))) throw new ActionError("forbidden", "rate_limited");

    // Gruppen per Name zuordnen, fehlende anlegen
    const { data: groups } = await ctx.supabase.from("groups").select("id,name").eq("firm_id", ctx.firm.id);
    const byName = new Map((groups ?? []).map((g) => [g.name.toLowerCase(), g.id]));
    for (const g of new Set(valid.map((v) => v.group).filter((x): x is string => !!x))) {
      if (byName.has(g.toLowerCase())) continue;
      const ng = must(await ctx.supabase.from("groups").insert({ firm_id: ctx.firm.id, name: g.slice(0, 80) }).select("id").single());
      byName.set(g.toLowerCase(), ng.id);
    }
    const members = must(
      await ctx.supabase
        .from("members")
        .insert(valid.map((v) => ({
          firm_id: ctx.firm.id, role: "employee" as const, full_name: v.full_name, email: v.email, phone: v.phone,
          group_id: v.group ? byName.get(v.group.toLowerCase()) ?? null : null, hourly_rate_cents: v.hourly_rate_cents,
          ...(v.vacation_days !== null ? { vacation_days_per_year: v.vacation_days } : {}),
        })))
        .select("id,full_name,email,group_id"),
    );
    const invites = must(
      await ctx.supabase
        .from("invites")
        .insert(members.map((m) => ({ firm_id: ctx.firm.id, role: "employee" as const, group_id: m.group_id, created_by: ctx.member.id, member_id: m.id, max_uses: 1, expires_at: new Date(Date.now() + 30 * 864e5).toISOString() })))
        .select("token,member_id"),
    );
    const base = serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const links = invites.map((i) => ({ member: members.find((m) => m.id === i.member_id)!, url: `${base}/join/${i.token}` }));
    if (!isDemo()) {
      const { t } = await getI18n();
      const firm = ctx.firm.name, boss = ctx.member.full_name;
      after(async () => {
        for (const l of links.filter((x) => x.member.email)) {
          const m = layout({ title: t("mail.inviteTitle", { firm }), lines: [t("mail.inviteText", { name: boss })], cta: { label: t("join.submit"), url: l.url }, footer: firm });
          await sendEmail({ to: l.member.email!, subject: t("mail.inviteTitle", { firm }), ...m }).catch(() => {});
        }
      });
    }
    revalidatePath("/boss/employees");
    revalidatePath("/boss/team");
    return { valid, errors, created: members.length, links: links.filter((l) => !l.member.email).map((l) => ({ name: l.member.full_name, url: l.url })) };
  });
}
