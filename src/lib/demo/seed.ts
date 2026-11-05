import { addDays, berlinStartOfDay, todayISO } from "@/lib/dates";
import type { Database } from "@/lib/supabase/types";

type Tables = Database["public"]["Tables"];
export type DemoDb = { [K in keyof Tables]: Tables[K]["Row"][] } & { users: { id: string; email: string }[] };

/** Feste IDs, damit Links stabil bleiben */
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
/** Fester Kunden-Link der Demo-Aufgabe "Badfliesen verfugen" */
export const DEMO_LINK_TOKEN = "d3m0".repeat(16);

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
    hourly_rate_cents: 0, locale: "de", notify_overdue: true, notify_done: true, archived_at: null, is_demo: false, hourly_basis: "tasks", vacation_days_per_year: 24,
    created_at: now, updated_at: now, ...o,
  });

  const task = (n: number, o: Partial<Tables["tasks"]["Row"]> & Pick<Tables["tasks"]["Row"], "title">): Tables["tasks"]["Row"] => ({
    id: id(400 + n), firm_id: DEMO.firm, description: null, address: null, assignee_id: null, due_date: null, due_time: null,
    status: "new", priority: "normal", fixed_pay_cents: null, template_id: null, created_by: DEMO.boss,
    completed_at: null, overdue_notified_at: null, submitted_at: null, accepted_at: null, accepted_by: null, rating: null,
    rework_count: 0, review_reminded_at: null, custom_status_id: null, client_id: null, accepted_via: null, pinned: false, reminder_sent_at: null, lat: null, lng: null, kb_article_id: null, created_at: at(-7, 8), updated_at: now, ...o,
  });

  const tasks: Tables["tasks"]["Row"][] = [
    task(1, { lat: 52.5176, lng: 13.437, kb_article_id: id(2601), title: "Treppenhaus reinigen – Haus A", client_id: id(1601), assignee_id: e1.member, due_date: day(0), due_time: "09:00", status: "in_progress",
      address: "Karl-Marx-Allee 12, 10243 Berlin", description: "Alle Etagen wischen, Geländer abwischen, Fenster im EG." }),
    task(2, { lat: 52.5153, lng: 13.3888, title: "Büro Fenster 2. OG", pinned: true, assignee_id: e1.member, due_date: day(0), due_time: "13:00", priority: "urgent",
      address: "Friedrichstr. 88, 10117 Berlin", description: "Kunde kommt um 16 Uhr – unbedingt vorher fertig." }),
    task(3, { lat: 52.5394, lng: 13.4125, title: "Grundreinigung Praxis Dr. Klein", client_id: id(1602), assignee_id: e1.member, due_date: day(-2), status: "rework", rework_count: 1,
      address: "Schönhauser Allee 40, 10435 Berlin" }),
    task(4, { lat: 52.4796, lng: 13.4441, title: "Trockenbauwand Küche stellen", assignee_id: e2.member, due_date: day(1), fixed_pay_cents: 18000,
      address: "Sonnenallee 150, 12059 Berlin", description: "Material liegt im Keller. Maße siehe Foto im Chat." }),
    task(5, { lat: 52.4823, lng: 13.4249, title: "Badfliesen verfugen", client_id: id(1601), assignee_id: e2.member, due_date: day(-1), status: "review", submitted_at: ago(20), priority: "urgent",
      fixed_pay_cents: 9000, address: "Hermannstr. 3, 12049 Berlin" }),
    task(6, { title: "Lager-Inventur Regal A–F", assignee_id: e2.member, due_date: day(3), fixed_pay_cents: 6000 }),
    task(7, { title: "Treppenhaus reinigen – Haus B", client_id: id(1601), assignee_id: e1.member, due_date: day(0), status: "done",
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
    firms: [{ id: DEMO.firm, name: "Glanz & Bau Service GmbH", timezone: "Europe/Berlin", auto_accept_days: 3,
      trial_ends_at: new Date(Date.now() + 9 * 864e5).toISOString(), plan: "trial", is_demo: false, contact_email: "chefin@demo.de",
      deletion_requested_at: null, deletion_scheduled_for: null, logo_path: null, shift_autoclose_hours: 12, public_slug: "glanz-bau", trial_mail_sent_at: null, weekly_mail_last: null, geofence_radius_m: null, geo_retention_days: 90, datev_consultant_no: 1001, datev_client_no: 1, datev_skr: "03", datev_accounts: {}, vat_rate: 19, small_business: false,
      task_fields: { description: true, address: true, due_time: true, checklist: true, client_price: true, fixed_pay: true, photos: true }, created_at: ago(5 * 24) }],
    user_settings: [],
    login_events: [],
    consents: [
      { id: id(2201), user_id: e1.user, member_id: e1.member, kind: "geolocation", version: "2026-11-04", granted: true, created_at: ago(48) },
    ],
    site_content: [],
    plans: [{ id: "start", price_cents: null, position: 0, updated_at: now }, { id: "pro", price_cents: null, position: 1, updated_at: now }],
    reviews: [],
    feature_flags: ([
      ["templates", true], ["requests", true], ["reports", true], ["excel_export", true], ["custom_statuses", true], ["demo_firm", true],
      ["kanban", true], ["clients", true], ["expenses", true], ["shifts", true], ["geolocation", false], ["invoices", false], ["public_form", false], ["team", true], ["knowledge", true], ["materials", true], ["datev", true],
    ] as const).map(([key, on]) => ({ key, default_enabled: on, description: null, updated_at: now })),
    firm_features: [],
    admin_audit: [],
    shifts: [
      { id: id(1301), firm_id: DEMO.firm, member_id: e1.member, started_at: ago(1.5), ended_at: null, break_minutes: 0, break_started_at: null, rate_cents: 0, auto_closed: false, needs_review: false, created_at: ago(1.5) },
      { id: id(1302), firm_id: DEMO.firm, member_id: e2.member, started_at: ago(30), ended_at: ago(21), break_minutes: 30, break_started_at: null, rate_cents: 0, auto_closed: false, needs_review: false, created_at: ago(30) },
      { id: id(1303), firm_id: DEMO.firm, member_id: e2.member, started_at: ago(10), ended_at: null, break_minutes: 0, break_started_at: null, rate_cents: 0, auto_closed: false, needs_review: false, created_at: ago(10) },
    ],
    expenses: [
      { id: id(1401), firm_id: DEMO.firm, task_id: id(405), member_id: e2.member, amount_cents: 2380, description: "2 Säcke Fugenmörtel", receipt_path: null, reimburse: true, status: "pending", decided_by: null, decided_at: null, created_at: ago(22), source: "manual" },
      { id: id(1402), firm_id: DEMO.firm, task_id: id(408), member_id: e2.member, amount_cents: 6450, description: "Farbe & Abdeckfolie", receipt_path: null, reimburse: false, status: "approved", decided_by: DEMO.boss, decided_at: ago(2), created_at: ago(30), source: "manual" },
    ],
    materials: [
      { id: id(3101), firm_id: DEMO.firm, name: "Fugenmörtel grau 5 kg", unit: "Sack", stock: 3, min_stock: 4, unit_cost_cents: 1190, low_notified_at: ago(20), archived_at: null, created_at: now },
      { id: id(3102), firm_id: DEMO.firm, name: "Allzweckreiniger 10 l", unit: "Kanister", stock: 6, min_stock: 2, unit_cost_cents: 2450, low_notified_at: null, archived_at: null, created_at: now },
      { id: id(3103), firm_id: DEMO.firm, name: "Müllsäcke 120 l", unit: "Rolle", stock: 25, min_stock: 10, unit_cost_cents: 390, low_notified_at: null, archived_at: null, created_at: now },
    ],
    material_moves: [
      { id: id(3201), firm_id: DEMO.firm, material_id: id(3101), kind: "in", qty: 5, unit_cost_cents: 1190, task_id: null, member_id: DEMO.boss, expense_id: null, note: "Lieferung Baumarkt", created_at: ago(200) },
    ],
    time_edits: [],
    clients: [
      { id: id(1601), firm_id: DEMO.firm, name: "Hausverwaltung Schmidt", email: "kontakt@hv-schmidt.invalid", phone: "+49 30 1234567", address: "Karl-Marx-Allee 12, 10243 Berlin", notes: null, hide_price: false, created_at: now },
      { id: id(1602), firm_id: DEMO.firm, name: "Praxis Dr. Klein", email: "praxis@klein.invalid", phone: null, address: "Schönhauser Allee 40, 10435 Berlin", notes: null, hide_price: true, created_at: now },
    ],
    task_links: [
      { id: id(1701), firm_id: DEMO.firm, task_id: id(405), token: DEMO_LINK_TOKEN, expires_at: new Date(Date.now() + 60 * 864e5).toISOString(), revoked: false, created_by: DEMO.boss, created_at: now },
    ],
    checklist_templates: [
      { id: id(1901), firm_id: DEMO.firm, name: "Treppenhaus", items: ["Erdgeschoss", "Obergeschosse", "Geländer", "Briefkästen"], created_at: now },
      { id: id(1902), firm_id: DEMO.firm, name: "Fenster", items: ["Innen", "Außen", "Rahmen", "Fensterbänke"], created_at: now },
    ],
    task_files: [],
    notification_prefs: [],
    shift_plans: [0, 1, 2, 3, 4].flatMap((d) => [
      { id: id(2300 + d), firm_id: DEMO.firm, member_id: e1.member, date: day(d), start_time: "07:00:00", end_time: "15:00:00", note: null, created_at: now },
      { id: id(2310 + d), firm_id: DEMO.firm, member_id: e2.member, date: day(d), start_time: "08:00:00", end_time: "16:30:00", note: d === 2 ? "Baustelle Sonnenallee" : null, created_at: now },
    ]),
    shift_swaps: [{ id: id(2401), firm_id: DEMO.firm, plan_id: id(2303), from_member: e1.member, to_member: e2.member, status: "accepted", created_at: ago(6), decided_at: null }],
    vacation_requests: [
      { id: id(2501), firm_id: DEMO.firm, member_id: e3.member, date_from: day(-2), date_to: day(6), days: 7, note: null, status: "approved", decided_by: DEMO.boss, decided_at: ago(200), created_at: ago(240) },
      { id: id(2502), firm_id: DEMO.firm, member_id: e1.member, date_from: day(20), date_to: day(24), days: 5, note: "Familienbesuch", status: "pending", decided_by: null, decided_at: null, created_at: ago(30) },
    ],
    announcements: [
      { id: id(2701), firm_id: DEMO.firm, group_id: null, title: "Neue Arbeitskleidung", body: "Ab Montag liegen die neuen Jacken im Lager. Bitte bis Freitag abholen.", created_by: DEMO.boss, created_at: ago(26) },
    ],
    announcement_reads: [{ announcement_id: id(2701), member_id: e2.member, read_at: ago(20) }],
    daily_reports: [
      { id: id(2801), firm_id: DEMO.firm, member_id: e2.member, date: day(-1), task_id: id(405), done_text: "Alte Fugen entfernt, Bad vorbereitet.", problems: "Fugenmörtel fehlt – 2 Säcke gekauft.", photo_paths: [], created_at: ago(20) },
    ],
    form_templates: [
      { id: id(2901), firm_id: DEMO.firm, name: "Abnahmeprotokoll", fields: [
        { id: "f1", type: "checkbox", label: "Arbeitsbereich sauber hinterlassen" },
        { id: "f2", type: "select", label: "Zustand", options: ["Sehr gut", "Gut", "Mängel"] },
        { id: "f3", type: "number", label: "Verbrauchte Stunden" },
        { id: "f4", type: "text", label: "Bemerkungen" },
      ], created_at: now },
    ],
    form_submissions: [],
    member_documents: [
      { id: id(3001), firm_id: DEMO.firm, member_id: e2.member, name: "Führerschein Klasse B", expires_on: day(21), file_path: null, reminded_at: null, created_at: now },
      { id: id(3002), firm_id: DEMO.firm, member_id: e1.member, name: "Erste-Hilfe-Kurs", expires_on: day(200), file_path: null, reminded_at: null, created_at: now },
    ],
    kb_articles: [
      { id: id(2601), firm_id: DEMO.firm, title: "Treppenhausreinigung – Standard", body: "1. Von oben nach unten arbeiten.\n2. Geländer mit Desinfektionsmittel.\n3. Briefkästen nicht nass wischen.\n4. Fotos vorher/nachher machen.", updated_at: now },
    ],
    geo_points: [
      { id: id(2101), firm_id: DEMO.firm, member_id: e1.member, kind: "task_start", task_id: id(401), shift_id: null, lat: 52.5178, lng: 13.4366, accuracy_m: 12, created_at: ago(0.75) },
      { id: id(2102), firm_id: DEMO.firm, member_id: e1.member, kind: "shift_start", task_id: null, shift_id: id(1301), lat: 52.5172, lng: 13.4381, accuracy_m: 20, created_at: ago(1.5) },
    ],
    activity: [
      { id: id(2001), firm_id: DEMO.firm, member_id: e2.member, kind: "status", task_id: id(405), payload: { from: "in_progress", to: "review", title: "Badfliesen verfugen" }, created_at: ago(20) },
      { id: id(2002), firm_id: DEMO.firm, member_id: e1.member, kind: "shift_start", task_id: null, payload: {}, created_at: ago(1.5) },
      { id: id(2003), firm_id: DEMO.firm, member_id: e2.member, kind: "expense", task_id: id(405), payload: { amount_cents: 2380, description: "2 Säcke Fugenmörtel" }, created_at: ago(22) },
      { id: id(2004), firm_id: DEMO.firm, member_id: e1.member, kind: "request", task_id: null, payload: { title: "Mülltonnenplatz Haus A säubern" }, created_at: ago(5) },
      { id: id(2005), firm_id: DEMO.firm, member_id: DEMO.boss, kind: "status", task_id: id(408), payload: { from: "review", to: "done", title: "Malerarbeiten Flur" }, created_at: ago(1) },
    ],
    inbound_requests: [
      { id: id(1801), firm_id: DEMO.firm, name: "Maria Hoffmann", contact: "0171 2345678", address: "Boxhagener Str. 20, 10245 Berlin", message: "Bitte Angebot für Endreinigung nach Umzug, 3 Zimmer, ca. 75 m².", status: "new", task_id: null, client_id: null, created_at: ago(5) },
    ],
    adjustments: [
      { id: id(1501), firm_id: DEMO.firm, member_id: e1.member, amount_cents: 2500, reason: "Sonntagseinsatz Hausverwaltung", effective_date: day(0), created_by: DEMO.boss, created_at: ago(3) },
    ],
    data_requests: [],
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
      created_by: DEMO.boss, expires_at: at(14, 0), max_uses: 50, used_count: 3, revoked: false, member_id: null, created_at: now }],
    task_templates: [
      { id: id(801), firm_id: DEMO.firm, title: "Treppenhaus reinigen – Haus A", description: null, address: "Karl-Marx-Allee 12, 10243 Berlin",
        assignee_id: e1.member, priority: "normal", recurrence: "weekly", weekdays: [1, 4], month_day: null, client_price_cents: 12000,
        fixed_pay_cents: null, checklist: ["Erdgeschoss", "1.–3. OG", "4.–5. OG", "Geländer"], active: true, last_run_on: day(-1), kb_article_id: id(2601), created_at: now },
      { id: id(802), firm_id: DEMO.firm, title: "Monatsinventur Lager", description: null, address: null, assignee_id: e2.member,
        priority: "normal", recurrence: "monthly", weekdays: [], month_day: 1, client_price_cents: 15000, fixed_pay_cents: 6000,
        checklist: [], active: true, last_run_on: null, kb_article_id: null, created_at: now },
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
