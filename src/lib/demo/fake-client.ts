import "server-only";
import { formatDocNo, invoiceTotals } from "@/lib/invoice-calc";
import { createSeed, type DemoDb } from "./seed";
import { staffCanTransition } from "@/lib/workflow";
import type { TaskStatus } from "@/lib/supabase/types";

/**
 * Minimaler Ersatz für den Supabase-Client im Demo-Modus.
 * - Daten liegen im Arbeitsspeicher des Servers (pro Instanz, Reset per Button).
 * - Sichtbarkeit und Schreibrechte bilden die RLS-Policies und Trigger aus
 *   supabase/migrations nach, damit Rollen sich wie in echt verhalten.
 * Unterstützt genau die Query-Methoden, die die App benutzt.
 */

type Row = Record<string, unknown>;
type TableName = Exclude<keyof DemoDb, "users">;
type Err = { message: string; code?: string; hint?: string };
type Result = { data: unknown; error: Err | null; count?: number | null };

const g = globalThis as unknown as { __werkplanDemoDb?: DemoDb };
export function demoDb(): DemoDb {
  if (!g.__werkplanDemoDb) g.__werkplanDemoDb = createSeed();
  return g.__werkplanDemoDb;
}
export function resetDemoDb() {
  g.__werkplanDemoDb = createSeed();
}

const clone = <T>(v: T): T => structuredClone(v);
const uuid = () => crypto.randomUUID();
const deny = (msg = "not allowed"): Err => ({ message: msg, code: "42501" });

const DEFAULTS: Partial<Record<TableName, () => Row>> = {
  tasks: () => ({ description: null, address: null, assignee_id: null, due_date: null, due_time: null, status: "new", priority: "normal",
    fixed_pay_cents: null, template_id: null, created_by: null, completed_at: null, overdue_notified_at: null,
    submitted_at: null, accepted_at: null, accepted_by: null, rating: null, rework_count: 0, review_reminded_at: null, custom_status_id: null,
    client_id: null, accepted_via: null, pinned: false, reminder_sent_at: null, lat: null, lng: null, kb_article_id: null }),
  shift_swaps: () => ({ status: "pending", decided_at: null }),
  vacation_requests: () => ({ note: null, status: "pending", decided_by: null, decided_at: null }),
  announcements: () => ({ group_id: null, created_by: null }),
  daily_reports: () => ({ task_id: null, problems: null, photo_paths: [] }),
  form_templates: () => ({ fields: [] }),
  form_submissions: () => ({ values: {}, submitted_by: null }),
  member_documents: () => ({ expires_on: null, file_path: null, reminded_at: null }),
  geo_points: () => ({ task_id: null, shift_id: null, accuracy_m: null }),
  checklist_templates: () => ({ items: [] }),
  task_files: () => ({ comment_id: null, uploaded_by: null }),
  task_statuses: () => ({ color: "slate", position: 0, is_system: false }),
  members: () => ({ email: null, phone: null, group_id: null, status: "active", pay_mode: "hourly", hourly_rate_cents: 0, locale: "de",
    notify_overdue: true, notify_done: true, archived_at: null, user_id: null, is_demo: false, hourly_basis: "tasks", vacation_days_per_year: 24, avatar_path: null }),
  shifts: () => ({ ended_at: null, break_minutes: 0, break_started_at: null, rate_cents: 0, auto_closed: false, needs_review: false }),
  expenses: () => ({ receipt_path: null, reimburse: false, status: "pending", decided_by: null, decided_at: null, source: "manual" }),
  invoices: () => ({ kind: "invoice", number: null, status: "draft", client_id: null, task_id: null, offer_id: null, cancels_id: null, issue_date: null,
    service_date: null, service_date_to: null, due_date: null, buyer_name: "", buyer_street: null, buyer_zip: null, buyer_city: null, buyer_country: "DE",
    buyer_vat_id: null, buyer_email: null, buyer_reference: null, seller: {}, small_business: false, note: null, net_cents: 0, vat_cents: 0, gross_cents: 0,
    sent_at: null, paid_at: null, retain_until: null, created_by: null }),
  invoice_items: () => ({ position: 0, unit: "Stk", vat_rate: 19 }),
  offers: () => ({ number: null, status: "draft", client_id: null, task_id: null, intro: null, buyer_name: "", buyer_email: null, buyer_address: null, valid_until: null,
    token: Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join(""), net_cents: 0, vat_cents: 0, gross_cents: 0,
    small_business: false, sent_at: null, decided_at: null, accepted_name: null, created_by: null }),
  offer_items: () => ({ position: 0, unit: "Stk", vat_rate: 19 }),
  clients: () => ({ email: null, phone: null, address: null, notes: null, hide_price: false, street: null, zip: null, city: null, country: "DE", vat_id: null }),
  materials: () => ({ unit: "Stk", stock: 0, min_stock: 0, unit_cost_cents: 0, low_notified_at: null, archived_at: null }),
  invites: () => ({ token: Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join(""),
    role: "employee", group_id: null, created_by: null, member_id: null, expires_at: new Date(Date.now() + 14 * 864e5).toISOString(), max_uses: 50, used_count: 0, revoked: false }),
  checklist_items: () => ({ done: false, position: 0 }),
  task_finance: () => ({ client_price_cents: 0 }),
  task_requests: () => ({ description: null, address: null, due_date: null, status: "pending", task_id: null, decided_by: null, decided_at: null }),
  task_templates: () => ({ description: null, address: null, assignee_id: null, priority: "normal", weekdays: [], month_day: null,
    client_price_cents: null, fixed_pay_cents: null, checklist: [], active: true, last_run_on: null, kb_article_id: null }),
  time_entries: () => ({ ended_at: null, rate_cents: 0 }),
  task_comments: () => ({ author_id: null }),
  task_photos: () => ({ uploaded_by: null, kind: "general" }),
  task_links: () => ({ token: Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join(""), expires_at: new Date(Date.now() + 60 * 864e5).toISOString(), revoked: false, created_by: null }),
  inbound_requests: () => ({ address: null, status: "new", task_id: null, client_id: null }),
  consents: () => ({ member_id: null }),
  firm_features: () => ({ set_by: "boss" }),
  admin_audit: () => ({ details: {} }),
  data_requests: () => ({ status: "open", note: null, resolved_at: null }),
};
const CHILD_OF_TASK: TableName[] = ["checklist_items", "task_comments", "task_photos", "task_finance", "time_entries", "expenses", "task_links", "task_files", "form_submissions"];
const KEY: Partial<Record<TableName, string>> = { task_finance: "task_id", feature_flags: "key", plans: "id" };

class Session {
  constructor(public uid: string | null, public admin: boolean) {}
  get db() {
    return demoDb();
  }
  get me(): Row | undefined {
    return this.db.members.find((m) => m.user_id === this.uid && !m.archived_at) as Row | undefined;
  }
  get firm() {
    return this.me?.firm_id as string | undefined;
  }
  get boss() {
    return this.me?.role === "boss";
  }
  taskVisible(taskId: unknown): boolean {
    if (this.admin) return true;
    const t = this.db.tasks.find((x) => x.id === taskId);
    return Boolean(t && t.firm_id === this.firm && (this.boss || t.assignee_id === this.me?.id));
  }
  /** entspricht den SELECT-Policies */
  visible(table: TableName, r: Row): boolean {
    if (this.admin) return true;
    if (table === "site_content" || table === "plans") return true; // öffentlich lesbar
    if (!this.uid) return false;
    const firm = this.firm, me = this.me?.id, boss = this.boss;
    switch (table) {
      case "firms": return r.id === firm;
      case "groups": case "task_statuses": return r.firm_id === firm;
      case "members": return r.firm_id === firm && (boss || r.user_id === this.uid);
      case "invites": case "task_templates": case "task_finance": return r.firm_id === firm && boss;
      case "tasks": return r.firm_id === firm && (boss || r.assignee_id === me);
      case "checklist_items": case "task_comments": case "task_photos": return this.taskVisible(r.task_id);
      case "time_entries": return r.firm_id === firm && (boss || r.member_id === me);
      case "task_requests": return r.firm_id === firm && (boss || r.created_by === me);
      case "push_subscriptions": case "user_settings": case "login_events": return r.user_id === this.uid;
      case "consents": return r.user_id === this.uid || (boss && this.db.members.some((m) => m.id === r.member_id && m.firm_id === firm));
      case "reviews": return r.firm_id === firm && boss;
      case "feature_flags": return true;
      case "firm_features": return r.firm_id === firm;
      case "admin_audit": return false;
      case "shifts": case "expenses": case "adjustments": case "time_edits": return r.firm_id === firm && (boss || r.member_id === me);
      case "clients": case "task_links": case "inbound_requests": case "checklist_templates": case "activity": return r.firm_id === firm && boss;
      case "task_files": return this.taskVisible(r.task_id);
      case "notification_prefs": return r.member_id === me;
      case "geo_points": return r.firm_id === firm && (boss || r.member_id === me);
      case "shift_plans": case "vacation_requests": case "daily_reports": case "member_documents": return r.firm_id === firm && (boss || r.member_id === me);
      case "shift_swaps": return r.firm_id === firm && (boss || r.from_member === me || r.to_member === me);
      case "announcements": return r.firm_id === firm && (boss || !r.group_id || r.group_id === this.me?.group_id);
      case "announcement_reads": return r.member_id === me || (boss && this.db.announcements.some((a) => a.id === r.announcement_id && a.firm_id === firm));
      case "form_templates": case "kb_articles": return r.firm_id === firm;
      case "form_submissions": return this.taskVisible(r.task_id);
      case "materials": return r.firm_id === firm;
      case "invoices": case "offers": return r.firm_id === firm && boss;
      case "invoice_items": return boss && this.db.invoices.some((i) => i.id === r.invoice_id && i.firm_id === firm);
      case "offer_items": return boss && this.db.offers.some((o) => o.id === r.offer_id && o.firm_id === firm);
      case "material_moves": return r.firm_id === firm && (boss || r.member_id === me || (r.task_id != null && this.taskVisible(r.task_id)));
      case "data_requests": return r.firm_id === firm && (boss || r.member_id === me);
    }
  }
  /** INSERT-Policies */
  canInsert(table: TableName, r: Row): boolean {
    if (this.admin) return true;
    const me = this.me?.id;
    switch (table) {
      case "task_comments": return this.taskVisible(r.task_id) && r.author_id === me;
      case "task_photos": return this.taskVisible(r.task_id) && r.uploaded_by === me;
      case "time_entries": return this.taskVisible(r.task_id) && (r.member_id === me || this.boss);
      case "task_requests": return r.firm_id === this.firm && r.created_by === me && r.status === "pending";
      case "consents": return r.user_id === this.uid && (r.member_id == null || r.member_id === me);
      case "data_requests": return r.firm_id === this.firm && r.member_id === me && r.status === "open";
      case "firm_features": return this.boss && r.firm_id === this.firm && r.set_by === "boss";
      case "shifts": return r.firm_id === this.firm && r.member_id === me;
      case "expenses": return this.taskVisible(r.task_id) && r.member_id === me && r.status === "pending";
      case "adjustments": return this.boss && r.firm_id === this.firm;
      case "time_edits": return false;
      case "clients": return this.boss && r.firm_id === this.firm;
      case "task_links": return this.boss && this.taskVisible(r.task_id);
      case "inbound_requests": case "activity": return false;
      case "checklist_templates": return this.boss && r.firm_id === this.firm;
      case "notification_prefs": return r.member_id === me;
      case "shift_plans": case "member_documents": case "announcements": case "form_templates": case "kb_articles": return this.boss && r.firm_id === this.firm;
      case "shift_swaps": return r.firm_id === this.firm && r.from_member === me && r.status === "pending" && this.db.shift_plans.some((p) => p.id === r.plan_id && p.member_id === me);
      case "vacation_requests": return r.firm_id === this.firm && (this.boss || (r.member_id === me && r.status === "pending"));
      case "announcement_reads": return r.member_id === me;
      case "daily_reports": return r.firm_id === this.firm && r.member_id === me;
      case "form_submissions": return this.taskVisible(r.task_id) && r.submitted_by === me;
      case "materials": return this.boss && r.firm_id === this.firm;
      case "material_moves": return false; // nur über RPC
      case "invoices": return this.boss && r.firm_id === this.firm && r.status === "draft" && r.number == null && r.kind === "invoice";
      case "invoice_items": return this.boss && this.db.invoices.some((i) => i.id === r.invoice_id && i.firm_id === this.firm && i.status === "draft");
      case "offers": return this.boss && r.firm_id === this.firm;
      case "offer_items": return this.boss && this.db.offers.some((o) => o.id === r.offer_id && o.firm_id === this.firm && o.status === "draft");
      case "geo_points": {
        const last = this.db.consents.filter((c) => c.user_id === this.uid && c.kind === "geolocation").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        return r.firm_id === this.firm && r.member_id === me && Boolean(last?.granted);
      }
      case "task_files": return this.taskVisible(r.task_id) && r.uploaded_by === me;
      case "push_subscriptions": return r.user_id === this.uid && r.member_id === me;
      case "checklist_items": return this.boss && this.taskVisible(r.task_id);
      default: return this.boss && r.firm_id === this.firm && this.visible(table, r);
    }
  }
  /** UPDATE-Policies + Guard-Trigger. Rückgabe: Fehler oder null */
  checkUpdate(table: TableName, old: Row, next: Row): Err | null {
    if (this.admin) return null;
    const changed = (allowed: string[]) => Object.keys(next).some((k) => !allowed.includes(k) && JSON.stringify(next[k]) !== JSON.stringify(old[k]));
    if (table === "invoices" && old.status !== "draft") {
      // GoBD wie private.guard_invoice: nur Zahlungsstatus sent ↔ paid
      if (Object.keys(next).some((k) => !["status", "paid_at", "updated_at"].includes(k) && JSON.stringify(next[k]) !== JSON.stringify(old[k]))) return deny("invoice locked (GoBD)");
      if ("status" in next && next.status !== old.status && !((old.status === "sent" && next.status === "paid") || (old.status === "paid" && next.status === "sent"))) return deny("invoice locked (GoBD)");
      if (this.boss) return null;
    }
    if (table === "invoice_items" && this.db.invoices.find((i) => i.id === old.invoice_id)?.status !== "draft") return deny("invoice locked (GoBD)");
    if (table === "offer_items" && this.db.offers.find((o) => o.id === old.offer_id)?.status !== "draft") return deny();
    if (this.boss) {
      if (table === "shifts" && old.ended_at) return deny();
      if (table === "task_statuses" && old.is_system && (("kind" in next && next.kind !== old.kind) || ("is_system" in next && next.is_system !== old.is_system))) return deny("system status");
      if (["firms", "groups", "members", "invites", "task_templates", "tasks", "task_finance", "checklist_items", "time_entries", "task_requests", "task_statuses", "expenses", "clients", "task_links", "inbound_requests", "checklist_templates", "shift_plans", "vacation_requests", "announcements", "member_documents", "form_templates", "kb_articles", "materials", "invoices", "invoice_items", "offers", "offer_items"].includes(table)) return null;
    }
    switch (table) {
      case "tasks":
        if (changed(["status", "completed_at", "updated_at"])) return deny();
        // gleiche Übergangsregeln wie private.guard_task_write
        if ("status" in next && next.status !== old.status && !staffCanTransition(old.status as TaskStatus, next.status as TaskStatus))
          return { message: "status transition not allowed", code: "42501", hint: "transition" };
        return null;
      case "checklist_items": return changed(["done", "updated_at"]) ? deny() : null;
      case "members":
        if (old.user_id !== this.uid) return deny();
        return changed(["full_name", "phone", "status", "locale", "notify_overdue", "notify_done", "avatar_path", "updated_at"]) ? deny() : null;
      case "time_entries":
        if (old.member_id !== this.me?.id || old.ended_at) return deny();
        return changed(["ended_at"]) ? deny() : null;
      case "push_subscriptions": return null;
      case "notification_prefs": return old.member_id === this.me?.id ? null : deny();
      case "shifts":
        if (old.member_id !== this.me?.id || old.ended_at) return deny();
        return changed(["ended_at", "break_minutes", "break_started_at"]) ? deny() : null;
      default: return deny();
    }
  }
  canDelete(table: TableName, r: Row): boolean {
    if (this.admin) return true;
    const me = this.me?.id;
    switch (table) {
      case "task_comments": return this.boss || r.author_id === me;
      case "task_photos": return this.boss || r.uploaded_by === me;
      case "task_requests": return this.boss || (r.created_by === me && r.status === "pending");
      case "task_statuses": return this.boss && !r.is_system;
      case "expenses": return this.boss || (r.member_id === me && r.status === "pending");
      case "clients": case "checklist_templates": case "shift_plans": case "announcements": case "member_documents": case "form_templates": case "kb_articles": return this.boss;
      case "vacation_requests": return this.boss || (r.member_id === me && r.status === "pending");
      case "invoices": return this.boss && r.status === "draft";
      case "invoice_items": return this.boss && this.db.invoices.find((i) => i.id === r.invoice_id)?.status === "draft";
      case "offer_items": return this.boss && this.db.offers.find((o) => o.id === r.offer_id)?.status === "draft";
      case "notification_prefs": return r.member_id === me;
      case "task_files": return this.boss || r.uploaded_by === me;
      case "task_links": case "inbound_requests": return false;
      case "shifts": case "time_edits": case "adjustments": return false;
      case "push_subscriptions": return r.user_id === this.uid;
      default: return this.boss;
    }
  }
}

/** Trigger nachbilden: firm_id erben, Zuweisung prüfen, completed_at, Stundensatz */
function applyTriggers(s: Session, table: TableName, row: Row, old: Row | null): Err | null {
  const db = s.db;
  if (!old && CHILD_OF_TASK.includes(table)) {
    const t = db.tasks.find((x) => x.id === row.task_id);
    if (!t) return { message: "task not found", code: "23503" };
    row.firm_id = t.firm_id;
  }
  if (table === "invoices" && old && old.status !== "draft") row.paid_at = row.status === "paid" ? (old.paid_at ?? new Date().toISOString()) : null;
  if (table === "tasks") {
    if (row.assignee_id && (!old || row.assignee_id !== old.assignee_id)) {
      const m = db.members.find((x) => x.id === row.assignee_id);
      if (!m || m.firm_id !== row.firm_id || m.archived_at) return { message: "invalid assignee", code: "23514" };
      if (m.status !== "active") return { message: "assignee unavailable", code: "23514", hint: "member_unavailable" };
    }
    if (row.assignee_id && row.due_date && (!old || row.assignee_id !== old.assignee_id || row.due_date !== old.due_date)
        && db.vacation_requests.some((v) => v.member_id === row.assignee_id && v.status === "approved" && String(row.due_date) >= v.date_from && String(row.due_date) <= v.date_to))
      return { message: "assignee unavailable", code: "23514", hint: "member_unavailable" };
    if (row.custom_status_id) {
      const st = db.task_statuses.find((x) => x.id === row.custom_status_id);
      if (!st || st.firm_id !== row.firm_id) return { message: "invalid status", code: "23514" };
      if (old && row.custom_status_id !== old.custom_status_id) row.status = st.kind;
      else if (st.kind !== row.status) row.custom_status_id = null;
    }
    const now = new Date().toISOString();
    if (row.status === "review" && (!old || old.status !== "review")) {
      row.submitted_at = now;
      row.review_reminded_at = null;
    }
    if (old && row.status === "rework" && old.status !== "rework") row.rework_count = Number(old.rework_count ?? 0) + 1;
    if (row.status === "done" && (!old || old.status !== "done")) {
      row.completed_at = row.completed_at ?? now;
      row.accepted_at = row.accepted_at ?? now;
      row.accepted_by = row.accepted_by ?? s.me?.id ?? null;
    } else if (row.status !== "done") {
      row.completed_at = null;
      row.accepted_at = null;
      row.accepted_by = null;
      row.rating = null;
    }
  }
  if ((table === "time_entries" || table === "shifts") && !old) {
    const m = db.members.find((x) => x.id === row.member_id);
    if (!m || m.firm_id !== row.firm_id) return { message: "invalid member", code: "23514" };
    const basis = table === "shifts" ? "shifts" : "tasks";
    row.rate_cents = (m.pay_mode === "hourly" || m.pay_mode === "both") && m.hourly_basis === basis ? m.hourly_rate_cents : 0;
    if (table === "shifts" && db.shifts.some((x) => x.member_id === row.member_id && !x.ended_at))
      return { message: "duplicate key value violates unique constraint \"shifts_one_open\"", code: "23505" };
  }
  if (old && "updated_at" in old) row.updated_at = new Date().toISOString();
  return null;
}

// ---- Filter -------------------------------------------------------------
type Pred = (r: Row) => boolean;
const cmp = (a: unknown, b: unknown) => (a == null || b == null ? NaN : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
function parseVal(v: string): unknown {
  return v === "null" ? null : v === "true" ? true : v === "false" ? false : v;
}
function opPred(col: string, op: string, raw: unknown): Pred {
  switch (op) {
    case "eq": return (r) => r[col] === raw || (typeof r[col] === "number" && String(r[col]) === raw);
    case "neq": return (r) => r[col] !== raw;
    case "gt": return (r) => cmp(r[col], raw) > 0;
    case "gte": return (r) => cmp(r[col], raw) >= 0;
    case "lt": return (r) => cmp(r[col], raw) < 0;
    case "lte": return (r) => cmp(r[col], raw) <= 0;
    case "is": return (r) => (raw === null ? r[col] == null : r[col] === raw);
    case "in": return (r) => (raw as unknown[]).includes(r[col]);
    case "ilike": {
      const re = new RegExp("^" + String(raw).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "is");
      return (r) => typeof r[col] === "string" && re.test(r[col] as string);
    }
    default: throw new Error(`demo: unsupported op ${op}`);
  }
}
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
/** PostgREST-Syntax: "a.eq.1,and(b.lt.2,c.is.null)" */
function parseOr(expr: string): Pred {
  const parts = splitTop(expr).map((p): Pred => {
    const m = /^(and|or)\((.*)\)$/.exec(p.trim());
    if (m) {
      const subs = splitTop(m[2]!).map((x) => parseOr(x));
      return m[1] === "and" ? (r) => subs.every((f) => f(r)) : (r) => subs.some((f) => f(r));
    }
    const [col, op, ...rest] = p.trim().split(".");
    return opPred(col!, op!, parseVal(rest.join(".")));
  });
  return (r) => parts.some((f) => f(r));
}

// ---- Query-Builder --------------------------------------------------------
class Query implements PromiseLike<Result> {
  private preds: Pred[] = [];
  private orders: { col: string; asc: boolean; nullsFirst: boolean }[] = [];
  private lim: number | null = null;
  private mode: "many" | "single" | "maybe" = "many";
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private returning = false;
  private countOpt = false;
  private head = false;

  constructor(private s: Session, private table: TableName) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op !== "select") this.returning = true;
    if (opts?.count) this.countOpt = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(v: Row | Row[]) { this.op = "insert"; this.payload = v; return this; }
  upsert(v: Row | Row[]) { this.op = "upsert"; this.payload = v; return this; }
  update(v: Row) { this.op = "update"; this.payload = v; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: unknown) { this.preds.push(opPred(c, "eq", v)); return this; }
  neq(c: string, v: unknown) { this.preds.push(opPred(c, "neq", v)); return this; }
  gt(c: string, v: unknown) { this.preds.push(opPred(c, "gt", v)); return this; }
  gte(c: string, v: unknown) { this.preds.push(opPred(c, "gte", v)); return this; }
  lt(c: string, v: unknown) { this.preds.push(opPred(c, "lt", v)); return this; }
  lte(c: string, v: unknown) { this.preds.push(opPred(c, "lte", v)); return this; }
  is(c: string, v: unknown) { this.preds.push(opPred(c, "is", v)); return this; }
  in(c: string, v: unknown[]) { this.preds.push(opPred(c, "in", v)); return this; }
  not(c: string, op: string, v: unknown) { const p = opPred(c, op, v); this.preds.push((r) => !p(r)); return this; }
  or(expr: string) { this.preds.push(parseOr(expr)); return this; }
  order(col: string, o: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    const asc = o.ascending ?? true;
    this.orders.push({ col, asc, nullsFirst: o.nullsFirst ?? !asc });
    return this;
  }
  limit(n: number) { this.lim = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  private rows(): Row[] {
    return this.s.db[this.table] as unknown as Row[];
  }
  private match(r: Row) {
    return this.s.visible(this.table, r) && this.preds.every((p) => p(r));
  }

  private exec(): Result {
    try {
      let out: Row[];
      switch (this.op) {
        case "select": out = this.rows().filter((r) => this.match(r)); break;
        case "insert": case "upsert": {
          const list = Array.isArray(this.payload) ? this.payload : [this.payload!];
          out = [];
          const key = KEY[this.table] ?? "id";
          for (const p of list) {
            const existing = this.op === "upsert" ? this.rows().find((r) => r[key] === p[key]) : undefined;
            if (existing) {
              const next = { ...existing, ...clone(p) };
              const err = this.s.checkUpdate(this.table, existing, next) ?? applyTriggers(this.s, this.table, next, existing);
              if (err) return { data: null, error: err };
              Object.assign(existing, next);
              out.push(existing);
              continue;
            }
            const now = new Date().toISOString();
            const row: Row = { ...(DEFAULTS[this.table]?.() ?? {}), id: uuid(), created_at: now, updated_at: now, ...clone(p) };
            if (this.table === "task_finance") delete row.id;
            if (this.table === "task_finance") delete row.created_at;
            if (this.rows().some((r) => r[key] === row[key])) return { data: null, error: { message: "duplicate key", code: "23505" } };
            const err = applyTriggers(this.s, this.table, row, null);
            if (err) return { data: null, error: err };
            if (!this.s.canInsert(this.table, row)) return { data: null, error: { message: `new row violates row-level security policy for table "${this.table}"`, code: "42501" } };
            this.rows().push(row);
            out.push(row);
          }
          break;
        }
        case "update": {
          out = [];
          for (const r of this.rows().filter((x) => this.match(x))) {
            const next = { ...r, ...clone(this.payload as Row) };
            const err = this.s.checkUpdate(this.table, r, this.payload as Row) ?? applyTriggers(this.s, this.table, next, r);
            if (err) return { data: null, error: err };
            Object.assign(r, next);
            out.push(r);
          }
          break;
        }
        case "delete": {
          const del = this.rows().filter((x) => this.match(x) && this.s.canDelete(this.table, x));
          const arr = this.rows();
          for (const d of del) arr.splice(arr.indexOf(d), 1);
          if (this.table === "tasks") cascadeTasks(this.s.db, del.map((d) => d.id as string));
          out = del;
          break;
        }
      }
      for (const o of [...this.orders].reverse()) {
        out = [...out].sort((a, b) => {
          const av = a[o.col], bv = b[o.col];
          if (av == null && bv == null) return 0;
          if (av == null) return o.nullsFirst ? -1 : 1;
          if (bv == null) return o.nullsFirst ? 1 : -1;
          const c = cmp(av, bv);
          return o.asc ? c : -c;
        });
      }
      if (this.lim != null) out = out.slice(0, this.lim);
      const count = this.countOpt ? out.length : null;
      if (this.op !== "select" && !this.returning) return { data: null, error: null, count };
      if (this.head) return { data: null, error: null, count };
      const data = clone(out);
      if (this.mode === "single") {
        return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } };
      }
      if (this.mode === "maybe") return { data: data[0] ?? null, error: null };
      return { data, error: null, count };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve(this.exec()).then(ok, fail);
  }
}

function cascadeTasks(db: DemoDb, ids: string[]) {
  for (const t of CHILD_OF_TASK) {
    const arr = db[t] as unknown as Row[];
    for (let i = arr.length - 1; i >= 0; i--) if (ids.includes(arr[i]!.task_id as string)) arr.splice(i, 1);
  }
}

// ---- Client ---------------------------------------------------------------
export function createFakeClient(uid: string | null, admin = false) {
  const s = new Session(uid, admin);
  const user = () => {
    const u = s.db.users.find((x) => x.id === uid);
    return u ? { id: u.id, email: u.email } : null;
  };
  return {
    from: (table: TableName) => new Query(s, table),
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      if (fn === "current_context") {
        const m = s.me;
        return { data: m ? [{ member_id: m.id, real_member_id: m.id, own_member_id: m.id, demo_member_id: null, acting: false }] : [], error: null };
      }
      if (fn === "dismiss_hint" || fn === "finish_onboarding") {
        if (!uid) return { data: null, error: { message: "not authenticated" } };
        let us = s.db.user_settings.find((u) => u.user_id === uid);
        if (!us) {
          us = { user_id: uid, active_member_id: null, acting_member_id: null, onboarding_done: false, hints_dismissed: [], reauth_at: null, updated_at: new Date().toISOString() };
          s.db.user_settings.push(us);
        }
        if (fn === "finish_onboarding") us.onboarding_done = true;
        else if (!us.hints_dismissed.includes(String(args.p_key).slice(0, 40))) us.hints_dismissed.push(String(args.p_key).slice(0, 40));
        return { data: null, error: null };
      }
      if (fn === "admin_firm_overview" && admin) {
        const data = s.db.firms.filter((f) => !f.is_demo).map((f) => ({
          id: f.id, name: f.name, created_at: f.created_at, plan: f.plan, trial_ends_at: f.trial_ends_at, is_demo: f.is_demo,
          members: s.db.members.filter((m) => m.firm_id === f.id && !m.archived_at).length,
          tasks: s.db.tasks.filter((t) => t.firm_id === f.id).length,
          last_activity: [f.created_at, ...s.db.tasks.filter((t) => t.firm_id === f.id).map((t) => t.updated_at)].sort().at(-1)!,
          owner_email: f.contact_email, deletion_scheduled_for: f.deletion_scheduled_for,
        }));
        return { data, error: null };
      }
      if (fn === "edit_time_record") {
        if (!s.boss) return { data: null, error: deny() };
        if (String(args.p_reason ?? "").trim().length < 3) return { data: null, error: { message: "reason required", code: "22023" } };
        const coll = (args.p_kind === "shift" ? s.db.shifts : s.db.time_entries) as unknown as Row[];
        const rec = coll.find((x) => x.id === args.p_id);
        if (!rec || rec.firm_id !== s.firm) return { data: null, error: deny("not found") };
        const before = clone(rec);
        rec.started_at = args.p_started_at;
        rec.ended_at = args.p_ended_at;
        if (args.p_kind === "shift") {
          rec.break_minutes = Math.max(0, Number(args.p_break_minutes ?? 0));
          rec.break_started_at = null;
          rec.needs_review = false;
        }
        s.db.time_edits.push({
          id: uuid(), firm_id: rec.firm_id as string, member_id: rec.member_id as string, kind: args.p_kind as "shift" | "time_entry",
          record_id: rec.id as string, changed_by: s.me?.id as string, before, after: clone(rec), reason: String(args.p_reason).trim(),
          created_at: new Date().toISOString(),
        });
        return { data: null, error: null };
      }
      if (fn === "search_all") {
        const q = String(args.p_q ?? "").trim().toLowerCase();
        if (q.length < 2) return { data: [], error: null };
        const vis = (tb: TableName) => (s.db[tb] as unknown as Row[]).filter((r) => s.visible(tb, r));
        const has = (...v: unknown[]) => v.some((x) => typeof x === "string" && x.toLowerCase().includes(q));
        const out = [
          ...vis("tasks").filter((r) => has(r.title, r.description, r.address)).map((r) => ({ kind: "task", id: r.id, title: r.title, subtitle: r.address ?? "" })),
          ...vis("members").filter((r) => !r.archived_at && has(r.full_name)).map((r) => ({ kind: "member", id: r.id, title: r.full_name, subtitle: r.email ?? "" })),
          ...vis("clients").filter((r) => has(r.name, r.address)).map((r) => ({ kind: "client", id: r.id, title: r.name, subtitle: r.address ?? "" })),
          ...vis("task_requests").filter((r) => has(r.title)).map((r) => ({ kind: "request", id: r.id, title: r.title, subtitle: r.status })),
        ].slice(0, 20);
        return { data: out, error: null };
      }
      if (fn === "issue_invoice" || fn === "cancel_invoice") {
        if (!s.boss) return { data: null, error: deny() };
        const inv = s.db.invoices.find((i) => i.id === args.p_invoice && i.firm_id === s.firm);
        const firm = s.db.firms.find((f) => f.id === s.firm);
        if (!inv || !firm) return { data: null, error: deny("not found") };
        const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
        const year = Number(today.slice(0, 4));
        const nextNo = () => formatDocNo(firm.invoice_prefix, year, 1 + s.db.invoices.filter((i) => i.firm_id === firm.id && i.number?.startsWith(`${firm.invoice_prefix}-${year}-`)).length);
        const err = (hint: string) => ({ data: null, error: { message: hint, code: "23514", hint } });
        const retain = `${year + 11}-01-01`;
        if (fn === "issue_invoice") {
          if (inv.status !== "draft") return { data: null, error: { message: "invoice locked (GoBD)", code: "42501", hint: "invoice_locked" } };
          if (!firm.address_street || !firm.address_zip || !firm.address_city || (!firm.tax_number && !firm.vat_id)) return err("seller_incomplete");
          if (!inv.buyer_name.trim() || !inv.buyer_city || !inv.buyer_zip || !inv.buyer_street) return err("buyer_incomplete");
          if (!inv.service_date) return err("service_date");
          const items = s.db.invoice_items.filter((i) => i.invoice_id === inv.id);
          const tot = invoiceTotals(items.map((i) => ({ ...i, qty: Number(i.qty) })), firm.small_business);
          if (!items.length || tot.net <= 0) return err("no_items");
          const issue = inv.issue_date ?? today;
          Object.assign(inv, {
            number: nextNo(), issue_date: issue, due_date: inv.due_date ?? new Date(Date.parse(`${issue}T12:00:00Z`) + firm.payment_terms_days * 864e5).toISOString().slice(0, 10),
            small_business: firm.small_business, net_cents: tot.net, vat_cents: tot.vat, gross_cents: tot.gross, status: "sent", sent_at: new Date().toISOString(), retain_until: retain,
            seller: { name: firm.legal_name || firm.name, street: firm.address_street, zip: firm.address_zip, city: firm.address_city, country: firm.address_country,
              tax_number: firm.tax_number, vat_id: firm.vat_id, iban: firm.iban, bic: firm.bic, bank: firm.bank_name, email: firm.invoice_email, phone: firm.invoice_phone },
          });
          return { data: inv.number, error: null };
        }
        if (inv.kind !== "invoice" || !["sent", "paid"].includes(inv.status)) return err("cannot_cancel");
        const sid = uuid();
        const now = new Date().toISOString();
        s.db.invoices.push({ ...clone(inv as unknown as Row), id: sid, kind: "storno", number: nextNo(), status: "sent", cancels_id: inv.id, issue_date: today, due_date: today,
          note: String(args.p_reason ?? "") || "Stornierung", net_cents: -inv.net_cents, vat_cents: -inv.vat_cents, gross_cents: -inv.gross_cents, sent_at: now, paid_at: null,
          retain_until: retain, created_by: s.me ? String(s.me.id) : null, created_at: now, updated_at: now } as unknown as typeof inv);
        for (const it of s.db.invoice_items.filter((i) => i.invoice_id === inv.id)) s.db.invoice_items.push({ ...it, id: uuid(), invoice_id: sid, qty: -Number(it.qty) });
        inv.status = "cancelled";
        return { data: sid, error: null };
      }
      if (fn === "send_offer") {
        if (!s.boss) return { data: null, error: deny() };
        const off = s.db.offers.find((o) => o.id === args.p_offer && o.firm_id === s.firm);
        const firm = s.db.firms.find((f) => f.id === s.firm);
        if (!off || !firm) return { data: null, error: deny("not found") };
        if (off.status !== "draft") return { data: off.number, error: null };
        if (!off.buyer_name.trim()) return { data: null, error: { message: "buyer_incomplete", code: "23514", hint: "buyer_incomplete" } };
        const tot = invoiceTotals(s.db.offer_items.filter((i) => i.offer_id === off.id).map((i) => ({ ...i, qty: Number(i.qty) })), firm.small_business);
        if (tot.net <= 0) return { data: null, error: { message: "no_items", code: "23514", hint: "no_items" } };
        const year = new Date().getFullYear();
        Object.assign(off, { number: formatDocNo("AN", year, 1 + s.db.offers.filter((o) => o.firm_id === firm.id && o.number?.startsWith(`AN-${year}-`)).length),
          status: "sent", sent_at: new Date().toISOString(), small_business: firm.small_business, net_cents: tot.net, vat_cents: tot.vat, gross_cents: tot.gross,
          valid_until: off.valid_until ?? new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) });
        return { data: off.number, error: null };
      }
      if (fn === "decide_offer") {
        if (!s.admin) return { data: null, error: deny("permission denied") };
        const off = s.db.offers.find((o) => o.token === args.p_token);
        const today = new Date().toISOString().slice(0, 10);
        if (!off || off.status !== "sent" || (off.valid_until && off.valid_until < today)) return { data: null, error: { message: "offer not open", code: "23514", hint: "offer_closed" } };
        const now = new Date().toISOString();
        const name = String(args.p_name ?? "").trim().slice(0, 120);
        if (!args.p_accept) { Object.assign(off, { status: "declined", decided_at: now, accepted_name: name || null }); return { data: null, error: null }; }
        if (!name) return { data: null, error: { message: "name required", code: "23514", hint: "name_required" } };
        let clientId = off.client_id;
        if (!clientId) {
          clientId = uuid();
          s.db.clients.push({ ...(DEFAULTS.clients!() as object), id: clientId, firm_id: off.firm_id, name: off.buyer_name, email: off.buyer_email, address: off.buyer_address, created_at: now } as never);
        }
        const items = s.db.offer_items.filter((i) => i.offer_id === off.id).sort((a, b) => a.position - b.position);
        const taskId = uuid();
        s.db.tasks.push({ ...(DEFAULTS.tasks!() as object), id: taskId, firm_id: off.firm_id, title: off.title.slice(0, 200), client_id: clientId, address: off.buyer_address,
          description: [off.intro, items.map((i) => `• ${i.description} (${i.qty} ${i.unit})`).join("\n")].filter(Boolean).join("\n\n"), created_at: now, updated_at: now } as never);
        s.db.task_finance.push({ task_id: taskId, firm_id: off.firm_id, client_price_cents: off.net_cents, updated_at: now });
        Object.assign(off, { status: "accepted", decided_at: now, accepted_name: name, client_id: clientId, task_id: taskId });
        return { data: taskId, error: null };
      }
      if (fn === "use_material") {
        const me = s.me;
        const qty = Number(args.p_qty);
        const mat = s.db.materials.find((m) => m.id === args.p_material && m.firm_id === s.firm && !m.archived_at);
        if (!me || !mat || !s.taskVisible(args.p_task)) return { data: null, error: deny("not found") };
        if (!(qty > 0 && qty <= 100000)) return { data: null, error: { message: "invalid qty", code: "22023" } };
        if (mat.stock < qty) return { data: null, error: { message: "insufficient stock", code: "23514", hint: "insufficient_stock" } };
        mat.stock = Math.round((mat.stock - qty) * 1000) / 1000;
        const now = new Date().toISOString();
        const cost = Math.round(qty * mat.unit_cost_cents);
        let expenseId: string | null = null;
        if (cost > 0) {
          expenseId = uuid();
          s.db.expenses.push({ id: expenseId, firm_id: mat.firm_id, task_id: String(args.p_task), member_id: String(me.id), amount_cents: cost,
            description: `${mat.name} × ${qty} ${mat.unit}`.slice(0, 300), receipt_path: null, reimburse: false, status: "approved",
            decided_by: String(me.id), decided_at: now, created_at: now, source: "material" });
        }
        s.db.material_moves.push({ id: uuid(), firm_id: mat.firm_id, material_id: mat.id, kind: "use", qty: -qty, unit_cost_cents: mat.unit_cost_cents,
          task_id: String(args.p_task), member_id: String(me.id), expense_id: expenseId, note: null, created_at: now });
        const low = mat.stock <= mat.min_stock;
        const first = low && !mat.low_notified_at;
        if (first) mat.low_notified_at = now;
        return { data: [{ stock: mat.stock, min_stock: mat.min_stock, low, first_low: first }], error: null };
      }
      if (fn === "adjust_material_stock") {
        if (!s.boss) return { data: null, error: deny() };
        const mat = s.db.materials.find((m) => m.id === args.p_material && m.firm_id === s.firm);
        const qty = Number(args.p_qty);
        if (!mat) return { data: null, error: deny("not found") };
        if (!qty || !["in", "correction"].includes(String(args.p_kind)) || (args.p_kind === "in" && qty < 0)) return { data: null, error: { message: "invalid", code: "22023" } };
        mat.stock = Math.round((mat.stock + qty) * 1000) / 1000;
        if (args.p_unit_cost_cents != null) mat.unit_cost_cents = Number(args.p_unit_cost_cents);
        if (mat.stock > mat.min_stock) mat.low_notified_at = null;
        s.db.material_moves.push({ id: uuid(), firm_id: mat.firm_id, material_id: mat.id, kind: args.p_kind as "in" | "correction", qty, unit_cost_cents: mat.unit_cost_cents,
          task_id: null, member_id: s.me ? String(s.me.id) : null, expense_id: null, note: args.p_note ? String(args.p_note) : null, created_at: new Date().toISOString() });
        return { data: mat.stock, error: null };
      }
      if (fn === "colleagues") {
        const me = s.me;
        const data = s.db.members.filter((m) => m.firm_id === me?.firm_id && !m.archived_at && m.id !== me?.id).map((m) => ({ id: m.id, full_name: m.full_name }));
        return { data, error: null };
      }
      if (fn === "decide_swap") {
        const sw = s.db.shift_swaps.find((x) => x.id === args.p_swap && x.firm_id === s.firm);
        const me = s.me?.id;
        if (!sw) return { data: null, error: deny("not found") };
        if (args.p_action === "accept" && sw.status === "pending" && sw.to_member === me) sw.status = "accepted";
        else if (args.p_action === "approve" && sw.status === "accepted" && s.boss) {
          const plan = s.db.shift_plans.find((p) => p.id === sw.plan_id);
          if (plan) plan.member_id = sw.to_member;
          sw.status = "approved";
          sw.decided_at = new Date().toISOString();
        } else if (args.p_action === "reject" && (sw.status === "pending" || sw.status === "accepted") && (s.boss || sw.to_member === me || sw.from_member === me)) {
          sw.status = "rejected";
          sw.decided_at = new Date().toISOString();
        } else return { data: null, error: deny() };
        return { data: null, error: null };
      }
      if (fn === "published_reviews") {
        const list = s.db.reviews
          .filter((r) => r.moderation === "approved" && r.allow_publish && r.comment)
          .slice(0, Number(args.p_limit ?? 6))
          .map((r) => ({ client_name: (r.client_name ?? "").split(" ")[0], rating: r.rating, comment: r.comment, created_at: r.created_at }));
        return { data: list, error: null };
      }
      if (fn === "invite_info") {
        const inv = s.db.invites.find((i) => i.token === args.p_token);
        const firm = s.db.firms.find((f) => f.id === inv?.firm_id);
        return { data: inv && firm ? [{ firm_name: firm.name, role: inv.role, valid: !inv.revoked && inv.expires_at > new Date().toISOString() }] : [], error: null };
      }
      return { data: null, error: { message: "Im Demo-Modus nicht verfügbar", code: "22023" } };
    },
    auth: {
      getUser: async () => ({ data: { user: user() }, error: null }),
      getClaims: async () => ({ data: uid ? { claims: { sub: uid } } : null, error: null }),
      signOut: async () => ({ error: null }),
    },
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: null })), error: null }),
        remove: async () => ({ data: [], error: null }),
        upload: async () => ({ data: null, error: { message: "demo" } }),
      }),
    },
  };
}
