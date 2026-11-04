import { addDays, berlinStartOfDay, todayISO } from "@/lib/dates";
import type { Database } from "@/lib/supabase/types";

type Tables = Database["public"]["Tables"];
export type DemoDb = { [K in keyof Tables]: Tables[K]["Row"][] } & { users: { id: string; email: string }[] };

/** Feste IDs, damit Links stabil bleiben */
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
export const DEMO = {
  firm: id(1),
  bossUser: id(101),
  boss: id(201),
  employees: [
    { user: id(102), member: id(202) },
    { user: id(103), member: id(203) },
    { user: id(104), member: id(204) },
  ],
};

/** Zeitpunkt: Tag relativ zu heute, Uhrzeit in Berlin */
function at(dayOffset: number, hh: number, mm = 0): string {
  const d = berlinStartOfDay(addDays(todayISO(), dayOffset));
  return new Date(d.getTime() + (hh * 60 + mm) * 60000).toISOString();
}

/** Zeitpunkt: vor h Stunden (hält Demo-Werte in der laufenden Woche) */
function ago(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

export function createSeed(): DemoDb {
  const today = todayISO();
  const now = new Date().toISOString();
  const day = (n: number) => addDays(today, n);
  const [e1, e2, e3] = DEMO.employees as [typeof DEMO.employees[0], typeof DEMO.employees[0], typeof DEMO.employees[0]];
  const gClean = id(301), gBuild = id(302);

  const member = (o: Partial<Tables["members"]["Row"]> & Pick<Tables["members"]["Row"], "id" | "user_id" | "role" | "full_name">): Tables["members"]["Row"] => ({
    firm_id: DEMO.firm, email: null, phone: null, group_id: null, status: "active", pay_mode: "hourly",
    hourly_rate_cents: 0, locale: "de", notify_overdue: true, notify_done: true, archived_at: null,
    created_at: now, updated_at: now, ...o,
  });

  const task = (n: number, o: Partial<Tables["tasks"]["Row"]> & Pick<Tables["tasks"]["Row"], "title">): Tables["tasks"]["Row"] => ({
    id: id(400 + n), firm_id: DEMO.firm, description: null, address: null, assignee_id: null, due_date: null, due_time: null,
    status: "new", priority: "normal", fixed_pay_cents: null, template_id: null, created_by: DEMO.boss,
    completed_at: null, overdue_notified_at: null, submitted_at: null, accepted_at: null, accepted_by: null, rating: null,
    rework_count: 0, review_reminded_at: null, custom_status_id: null, created_at: at(-7, 8), updated_at: now, ...o,
  });

  const tasks: Tables["tasks"]["Row"][] = [
    task(1, { title: "Treppenhaus reinigen – Haus A", assignee_id: e1.member, due_date: day(0), due_time: "09:00", status: "in_progress",
      address: "Karl-Marx-Allee 12, 10243 Berlin", description: "Alle Etagen wischen, Geländer abwischen, Fenster im EG." }),
    task(2, { title: "Büro Fenster 2. OG", assignee_id: e1.member, due_date: day(0), due_time: "13:00", priority: "urgent",
      address: "Friedrichstr. 88, 10117 Berlin", description: "Kunde kommt um 16 Uhr – unbedingt vorher fertig." }),
    task(3, { title: "Grundreinigung Praxis Dr. Klein", assignee_id: e1.member, due_date: day(-2), status: "rework", rework_count: 1,
      address: "Schönhauser Allee 40, 10435 Berlin" }),
    task(4, { title: "Trockenbauwand Küche stellen", assignee_id: e2.member, due_date: day(1), fixed_pay_cents: 18000,
      address: "Sonnenallee 150, 12059 Berlin", description: "Material liegt im Keller. Maße siehe Foto im Chat." }),
    task(5, { title: "Badfliesen verfugen", assignee_id: e2.member, due_date: day(-1), status: "review", submitted_at: ago(20), priority: "urgent",
      fixed_pay_cents: 9000, address: "Hermannstr. 3, 12049 Berlin" }),
    task(6, { title: "Lager-Inventur Regal A–F", assignee_id: e2.member, due_date: day(3), fixed_pay_cents: 6000 }),
    task(7, { title: "Treppenhaus reinigen – Haus B", assignee_id: e1.member, due_date: day(0), status: "done",
      completed_at: ago(2), accepted_at: ago(2), accepted_by: DEMO.boss, rating: 5, address: "Karl-Marx-Allee 14, 10243 Berlin" }),
    task(8, { title: "Malerarbeiten Flur", assignee_id: e2.member, due_date: day(0), status: "done", fixed_pay_cents: 25000,
      completed_at: ago(1), accepted_at: ago(1), accepted_by: DEMO.boss, rating: 4 }),
    task(9, { title: "Fensterreinigung Kita Sonnenschein", assignee_id: e3.member, due_date: day(-4), status: "done",
      fixed_pay_cents: 7000, completed_at: at(-4, 14), accepted_at: at(-4, 16), accepted_by: DEMO.boss, rating: 5 }),
    task(10, { title: "Teppichreinigung Hotel Lobby", due_date: day(5), description: "Noch niemandem zugewiesen.",
      address: "Unter den Linden 77, 10117 Berlin" }),
  ];

  const finance: Record<number, number> = { 1: 12000, 2: 9000, 3: 25000, 4: 42000, 5: 22000, 6: 15000, 7: 12000, 8: 52000, 9: 16000, 10: 30000 };

  const items: [number, string, boolean][] = [
    [1, "Erdgeschoss", true], [1, "1.–3. OG", true], [1, "4.–5. OG", false], [1, "Geländer", false],
    [2, "Innen", false], [2, "Außen", false], [2, "Rahmen abwischen", false],
    [4, "Ständerwerk", false], [4, "Beplanken", false], [4, "Spachteln", false],
    [5, "Alte Fugen raus", true], [5, "Neu verfugen", false],
    [7, "Alle Etagen", true], [7, "Briefkästen", true],
  ];

  const entry = (n: number, t: number, m: string, s: string, e: string | null, rate: number): Tables["time_entries"]["Row"] => ({
    id: id(600 + n), task_id: id(400 + t), firm_id: DEMO.firm, member_id: m, started_at: s, ended_at: e, rate_cents: rate, created_at: s,
  });

  return {
    users: [
      { id: DEMO.bossUser, email: "chefin@demo.de" },
      { id: e1.user, email: "dmitri@demo.de" },
      { id: e2.user, email: "lukas@demo.de" },
      { id: e3.user, email: "olga@demo.de" },
    ],
    firms: [{ id: DEMO.firm, name: "Glanz & Bau Service GmbH", timezone: "Europe/Berlin", auto_accept_days: 3, created_at: now }],
    task_statuses: [
      ...(["new", "in_progress", "review", "rework", "done"] as const).map((kind, i) => ({
        id: id(1200 + i), firm_id: DEMO.firm, name: ["Neu", "In Arbeit", "Zur Prüfung", "Nacharbeit", "Erledigt"][i]!,
        color: (["slate", "blue", "amber", "red", "green"] as const)[i]!, position: i, kind, is_system: true, created_at: now,
      })),
      { id: id(1210), firm_id: DEMO.firm, name: "Material fehlt", color: "violet" as const, position: 5, kind: "in_progress" as const, is_system: false, created_at: now },
    ],
    groups: [
      { id: gClean, firm_id: DEMO.firm, name: "Reinigung", created_at: now },
      { id: gBuild, firm_id: DEMO.firm, name: "Bau & Renovierung", created_at: now },
    ],
    members: [
      member({ id: DEMO.boss, user_id: DEMO.bossUser, role: "boss", full_name: "Anna Becker", email: "chefin@demo.de", pay_mode: "fixed" }),
      member({ id: e1.member, user_id: e1.user, role: "employee", full_name: "Dmitri Iwanow", email: "dmitri@demo.de", phone: "+49 151 2345678",
        group_id: gClean, pay_mode: "hourly", hourly_rate_cents: 1800, locale: "ru" }),
      member({ id: e2.member, user_id: e2.user, role: "employee", full_name: "Lukas Weber", email: "lukas@demo.de",
        group_id: gBuild, pay_mode: "both", hourly_rate_cents: 1500 }),
      member({ id: e3.member, user_id: e3.user, role: "employee", full_name: "Olga Petrowa", email: "olga@demo.de",
        group_id: gClean, pay_mode: "fixed", status: "vacation", locale: "ru" }),
    ],
    invites: [{ id: id(701), firm_id: DEMO.firm, token: "de0de0de0de0de0de0de0de0de0de0de0de0", role: "employee", group_id: gClean,
      created_by: DEMO.boss, expires_at: at(14, 0), max_uses: 50, used_count: 3, revoked: false, created_at: now }],
    task_templates: [
      { id: id(801), firm_id: DEMO.firm, title: "Treppenhaus reinigen – Haus A", description: null, address: "Karl-Marx-Allee 12, 10243 Berlin",
        assignee_id: e1.member, priority: "normal", recurrence: "weekly", weekdays: [1, 4], month_day: null, client_price_cents: 12000,
        fixed_pay_cents: null, checklist: ["Erdgeschoss", "1.–3. OG", "4.–5. OG", "Geländer"], active: true, last_run_on: day(-1), created_at: now },
      { id: id(802), firm_id: DEMO.firm, title: "Monatsinventur Lager", description: null, address: null, assignee_id: e2.member,
        priority: "normal", recurrence: "monthly", weekdays: [], month_day: 1, client_price_cents: 15000, fixed_pay_cents: 6000,
        checklist: [], active: true, last_run_on: null, created_at: now },
    ],
    tasks,
    task_finance: tasks.map((t, i) => ({ task_id: t.id, firm_id: DEMO.firm, client_price_cents: finance[i + 1] ?? 0, updated_at: now })),
    checklist_items: items.map(([t, text, done], i) => ({
      id: id(900 + i), task_id: id(400 + t), firm_id: DEMO.firm, text, done, position: i, updated_at: now,
    })),
    task_comments: [
      { id: id(1001), task_id: id(402), firm_id: DEMO.firm, author_id: DEMO.boss, author_name: "Anna Becker",
        body: "Schlüssel liegt beim Hausmeister, Herr Yilmaz.", created_at: at(-1, 17) },
      { id: id(1002), task_id: id(402), firm_id: DEMO.firm, author_id: e1.member, author_name: "Dmitri Iwanow",
        body: "Ok, bin um 12:30 da.", created_at: at(0, 7, 45) },
      { id: id(1003), task_id: id(405), firm_id: DEMO.firm, author_id: e2.member, author_name: "Lukas Weber",
        body: "Brauche noch 2 Säcke Fugenmörtel.", created_at: at(-1, 15) },
      { id: id(1004), task_id: id(403), firm_id: DEMO.firm, author_id: DEMO.boss, author_name: "Anna Becker",
        body: "Bitte die Fensterbänke im Wartezimmer nochmal – da sind noch Streifen.", created_at: ago(18) },
    ],
    task_photos: [],
    time_entries: [
      entry(1, 1, e1.member, ago(0.75), null, 1800),
      entry(2, 7, e1.member, ago(5.5), ago(2), 1800),
      entry(3, 3, e1.member, at(-2, 9), at(-2, 10, 15), 1800),
      entry(4, 5, e2.member, ago(9), ago(6), 1500),
      entry(5, 8, e2.member, ago(7), ago(1), 1500),
    ],
    task_requests: [
      { id: id(1101), firm_id: DEMO.firm, created_by: e1.member, title: "Mülltonnenplatz Haus A säubern",
        description: "Dort liegt seit Tagen Sperrmüll, Mieter beschweren sich.", address: "Karl-Marx-Allee 12, 10243 Berlin",
        due_date: day(2), status: "pending", task_id: null, decided_by: null, decided_at: null, created_at: at(0, 7) },
      { id: id(1102), firm_id: DEMO.firm, created_by: e2.member, title: "Silikonfugen Dusche erneuern",
        description: null, address: "Hermannstr. 3, 12049 Berlin", due_date: null, status: "pending", task_id: null,
        decided_by: null, decided_at: null, created_at: at(-1, 18) },
    ],
    push_subscriptions: [],
  };
}
