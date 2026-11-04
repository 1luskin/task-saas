import "server-only";
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
    submitted_at: null, accepted_at: null, accepted_by: null, rating: null, rework_count: 0, review_reminded_at: null, custom_status_id: null }),
  task_statuses: () => ({ color: "slate", position: 0, is_system: false }),
  members: () => ({ email: null, phone: null, group_id: null, status: "active", pay_mode: "hourly", hourly_rate_cents: 0, locale: "de",
    notify_overdue: true, notify_done: true, archived_at: null, user_id: null, is_demo: false }),
  invites: () => ({ token: Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join(""),
    role: "employee", group_id: null, created_by: null, expires_at: new Date(Date.now() + 14 * 864e5).toISOString(), max_uses: 50, used_count: 0, revoked: false }),
  checklist_items: () => ({ done: false, position: 0 }),
  task_finance: () => ({ client_price_cents: 0 }),
  task_requests: () => ({ description: null, address: null, due_date: null, status: "pending", task_id: null, decided_by: null, decided_at: null }),
  task_templates: () => ({ description: null, address: null, assignee_id: null, priority: "normal", weekdays: [], month_day: null,
    client_price_cents: null, fixed_pay_cents: null, checklist: [], active: true, last_run_on: null }),
  time_entries: () => ({ ended_at: null, rate_cents: 0 }),
  task_comments: () => ({ author_id: null }),
  task_photos: () => ({ uploaded_by: null }),
};
const CHILD_OF_TASK: TableName[] = ["checklist_items", "task_comments", "task_photos", "task_finance", "time_entries"];
const KEY: Partial<Record<TableName, string>> = { task_finance: "task_id" };

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
      case "push_subscriptions": case "user_settings": return r.user_id === this.uid;
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
      case "push_subscriptions": return r.user_id === this.uid && r.member_id === me;
      case "checklist_items": return this.boss && this.taskVisible(r.task_id);
      default: return this.boss && r.firm_id === this.firm && this.visible(table, r);
    }
  }
  /** UPDATE-Policies + Guard-Trigger. Rückgabe: Fehler oder null */
  checkUpdate(table: TableName, old: Row, next: Row): Err | null {
    if (this.admin) return null;
    const changed = (allowed: string[]) => Object.keys(next).some((k) => !allowed.includes(k) && JSON.stringify(next[k]) !== JSON.stringify(old[k]));
    if (this.boss) {
      if (table === "task_statuses" && old.is_system && (("kind" in next && next.kind !== old.kind) || ("is_system" in next && next.is_system !== old.is_system))) return deny("system status");
      if (["firms", "groups", "members", "invites", "task_templates", "tasks", "task_finance", "checklist_items", "time_entries", "task_requests", "task_statuses"].includes(table)) return null;
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
        return changed(["full_name", "phone", "status", "locale", "notify_overdue", "notify_done", "updated_at"]) ? deny() : null;
      case "time_entries":
        if (old.member_id !== this.me?.id || old.ended_at) return deny();
        return changed(["ended_at"]) ? deny() : null;
      case "push_subscriptions": return null;
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
  if (table === "tasks") {
    if (row.assignee_id && (!old || row.assignee_id !== old.assignee_id)) {
      const m = db.members.find((x) => x.id === row.assignee_id);
      if (!m || m.firm_id !== row.firm_id || m.archived_at) return { message: "invalid assignee", code: "23514" };
      if (m.status !== "active") return { message: "assignee unavailable", code: "23514", hint: "member_unavailable" };
    }
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
  if (table === "time_entries" && !old) {
    const m = db.members.find((x) => x.id === row.member_id);
    if (!m || m.firm_id !== row.firm_id) return { message: "invalid member", code: "23514" };
    row.rate_cents = m.pay_mode === "hourly" || m.pay_mode === "both" ? m.hourly_rate_cents : 0;
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
    rpc: async (fn: string, args: Record<string, string>) => {
      if (fn === "current_context") {
        const m = s.me;
        return { data: m ? [{ member_id: m.id, real_member_id: m.id, own_member_id: m.id, demo_member_id: null, acting: false }] : [], error: null };
      }
      if (fn === "dismiss_hint" || fn === "finish_onboarding") {
        if (!uid) return { data: null, error: { message: "not authenticated" } };
        let us = s.db.user_settings.find((u) => u.user_id === uid);
        if (!us) {
          us = { user_id: uid, active_member_id: null, acting_member_id: null, onboarding_done: false, hints_dismissed: [], updated_at: new Date().toISOString() };
          s.db.user_settings.push(us);
        }
        if (fn === "finish_onboarding") us.onboarding_done = true;
        else if (!us.hints_dismissed.includes(String(args.p_key).slice(0, 40))) us.hints_dismissed.push(String(args.p_key).slice(0, 40));
        return { data: null, error: null };
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
