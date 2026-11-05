import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { addDays, daysInMonth, isOverdue, isoWeekday, todayISO } from "@/lib/dates";
import { sendPushToMembers } from "@/lib/push";
import { notifyBosses, notifyNewTask } from "@/server/notify";
import { runEmailJobs } from "@/server/jobs/emails";
import type { TaskTemplate } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function templateDueToday(t: TaskTemplate, today: string): boolean {
  if (t.last_run_on && t.last_run_on >= today) return false;
  switch (t.recurrence) {
    case "daily":
      return true;
    case "weekly":
      return t.weekdays.includes(isoWeekday(today));
    case "monthly": {
      const day = Number(today.slice(8, 10));
      const target = Math.min(t.month_day ?? 1, daysInMonth(today)); // 31. → letzter Tag im Monat
      return day === target;
    }
  }
}

/**
 * Täglicher Job (Vercel Cron, siehe vercel.json):
 * 1. Aufgaben aus aktiven Vorlagen erzeugen
 * 2. Chefs über überfällige Aufgaben informieren
 */
export async function GET(req: Request) {
  const secret = serverEnv().CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const today = todayISO();
  let created = 0;

  // 1. Vorlagen
  const { data: templates, error: tErr } = await admin.from("task_templates").select("*").eq("active", true);
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  // Feature-Flag "templates": global aus oder für die Firma ausgeschaltet → überspringen
  const [{ data: tplFlag }, { data: tplOff }] = await Promise.all([
    admin.from("feature_flags").select("default_enabled").eq("key", "templates").maybeSingle(),
    admin.from("firm_features").select("firm_id, enabled").eq("key", "templates"),
  ]);
  const tplEnabled = (firmId: string) => {
    const o = (tplOff ?? []).find((x) => x.firm_id === firmId);
    return o ? o.enabled : tplFlag?.default_enabled !== false;
  };

  for (const tpl of templates ?? []) {
    if (!tplEnabled(tpl.firm_id)) continue;
    if (!templateDueToday(tpl, today)) continue;
    // Atomar "beanspruchen", damit doppelte Cron-Läufe keine Duplikate erzeugen
    const { data: claimed } = await admin
      .from("task_templates")
      .update({ last_run_on: today })
      .eq("id", tpl.id)
      .or(`last_run_on.is.null,last_run_on.lt.${today}`)
      .select("id");
    if (!claimed?.length) continue;

    let assignee = tpl.assignee_id;
    let fixedPay = tpl.fixed_pay_cents;
    if (assignee) {
      const { data: m } = await admin.from("members").select("status, pay_mode, archived_at").eq("id", assignee).maybeSingle();
      if (!m || m.status !== "active" || m.archived_at) assignee = null; // Urlaub/krank → Chef weist neu zu
      else if (m.pay_mode === "hourly") fixedPay = null;
      if (assignee) {
        // genehmigter Urlaub heute → nicht zuweisen
        const { data: off } = await admin.from("vacation_requests").select("id").eq("member_id", assignee).eq("status", "approved").lte("date_from", today).gte("date_to", today).limit(1);
        if (off?.length) assignee = null;
      }
    }
    const { data: task, error } = await admin
      .from("tasks")
      .insert({
        firm_id: tpl.firm_id,
        title: tpl.title,
        description: tpl.description,
        address: tpl.address,
        assignee_id: assignee,
        due_date: today,
        priority: tpl.priority,
        fixed_pay_cents: fixedPay,
        template_id: tpl.id,
        kb_article_id: tpl.kb_article_id ?? null,
      })
      .select()
      .single();
    if (error || !task) {
      console.error("[cron] template", tpl.id, error);
      continue;
    }
    await admin.from("task_finance").insert({ task_id: task.id, firm_id: tpl.firm_id, client_price_cents: tpl.client_price_cents ?? 0 });
    if (tpl.checklist.length) {
      await admin
        .from("checklist_items")
        .insert(tpl.checklist.map((text, position) => ({ task_id: task.id, firm_id: tpl.firm_id, text, position })));
    }
    if (assignee) await notifyNewTask(assignee, task);
    created++;
  }

  // 2. Überfällige Aufgaben → je Firma eine Sammel-Benachrichtigung
  const { data: open } = await admin
    .from("tasks")
    .select("id, firm_id, status, due_date, due_time")
    .neq("status", "done")
    .is("overdue_notified_at", null)
    .lte("due_date", today);
  const overdue = (open ?? []).filter((t) => isOverdue(t));
  const byFirm = new Map<string, string[]>();
  for (const t of overdue) byFirm.set(t.firm_id, [...(byFirm.get(t.firm_id) ?? []), t.id]);

  for (const [firmId, ids] of byFirm) {
    const { data: bosses } = await admin
      .from("members")
      .select("id")
      .eq("firm_id", firmId)
      .eq("role", "boss")
      .eq("notify_overdue", true)
      .is("archived_at", null);
    await sendPushToMembers((bosses ?? []).map((b) => b.id), (t) => ({
      title: t("push.overdue"),
      body: t("push.overdueBody", { n: ids.length }),
      url: "/boss?status=overdue",
      tag: "overdue",
    }), "overdue");
    await admin.from("tasks").update({ overdue_notified_at: new Date().toISOString() }).in("id", ids);
  }

  // 3. DSGVO: beantragte Firmenlöschungen nach 30 Tagen endgültig ausführen
  const { data: doomed } = await admin.from("firms").select("id").lt("deletion_scheduled_for", new Date().toISOString());
  for (const f of doomed ?? []) {
    const { data: photos } = await admin.from("task_photos").select("storage_path").eq("firm_id", f.id);
    if (photos?.length) await admin.storage.from("task-photos").remove(photos.map((p) => p.storage_path));
    await admin.from("firms").delete().eq("id", f.id);
  }
  // 4a. Standortpunkte nach Aufbewahrungsfrist der Firma (Standard 90 Tage) löschen
  const { data: geoFirms } = await admin.from("firms").select("id, geo_retention_days");
  for (const f of geoFirms ?? []) {
    await admin.from("geo_points").delete().eq("firm_id", f.id).lt("created_at", new Date(Date.now() - f.geo_retention_days * 864e5).toISOString());
  }
  // 4c. Rechnungen nach Ablauf der 10-jährigen Aufbewahrung (GoBD) löschen
  await admin.rpc("purge_expired_invoices");
  // 4. Aufbewahrung: Login-Protokoll 90 Tage
  await admin.from("login_events").delete().lt("created_at", new Date(Date.now() - 90 * 864e5).toISOString());

  // 4b. Dokumente der Mitarbeiter laufen in ≤ 30 Tagen ab → einmalig Chef + Mitarbeiter erinnern
  const { data: docs } = await admin
    .from("member_documents")
    .select("id, firm_id, member_id, name, expires_on")
    .is("reminded_at", null)
    .not("expires_on", "is", null)
    .lte("expires_on", addDays(today, 30));
  for (const d of docs ?? []) {
    const body = `${d.name} · ${d.expires_on!.split("-").reverse().join(".")}`;
    await notifyBosses(d.firm_id, (t) => ({ title: t("team.docPush"), body, url: "/boss/team?tab=docs", tag: `doc-${d.id}` }), "doc_expiry");
    await sendPushToMembers([d.member_id], (t) => ({ title: t("team.docPush"), body, url: "/staff/team", tag: `doc-${d.id}` }), "doc_expiry");
    await admin.from("member_documents").update({ reminded_at: new Date().toISOString() }).eq("id", d.id);
  }

  // 5. E-Mails: Testzeitraum endet bald, Wochenbericht (montags)
  const emails = await runEmailJobs();

  return NextResponse.json({ ok: true, created, overdue: overdue.length, deletedFirms: doomed?.length ?? 0, docReminders: docs?.length ?? 0, emails });
}
