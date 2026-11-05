/**
 * Datenbanktypen (entspricht supabase/migrations).
 * Kann später durch `supabase gen types typescript` ersetzt werden.
 */

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Role = "boss" | "employee";
export type MemberStatus = "active" | "vacation" | "sick";
export type PayMode = "hourly" | "fixed" | "both";
export type TaskStatus = "new" | "in_progress" | "review" | "rework" | "done";
export type StatusColor = "slate" | "blue" | "amber" | "red" | "green" | "violet" | "teal";
export type Priority = "normal" | "urgent";
export type Recurrence = "daily" | "weekly" | "monthly";
export type RequestStatus = "pending" | "approved" | "rejected";
export type Locale = "de" | "ru";
export type FirmPlan = "trial" | "paid" | "expired" | "blocked";

export type Firm = {
  id: string;
  name: string;
  timezone: string;
  auto_accept_days: number | null;
  trial_ends_at: string;
  plan: FirmPlan;
  is_demo: boolean;
  contact_email: string | null;
  deletion_requested_at: string | null;
  deletion_scheduled_for: string | null;
  logo_path: string | null;
  public_slug: string | null;
  trial_mail_sent_at: string | null;
  geofence_radius_m: number | null;
  geo_retention_days: number;
  weekly_mail_last: string | null;
  task_fields: TaskFields;
  shift_autoclose_hours: number;
  created_at: string;
};
export type TaskFields = {
  description: boolean;
  address: boolean;
  due_time: boolean;
  checklist: boolean;
  client_price: boolean;
  fixed_pay: boolean;
  photos: boolean;
};
export type SiteContent = { key: "landing"; locale: Locale; data: Record<string, unknown>; updated_at: string };
export type PlanRow = { id: "start" | "pro"; price_cents: number | null; position: number; updated_at: string };
export type Review = {
  id: string;
  firm_id: string;
  task_id: string | null;
  client_name: string | null;
  rating: number;
  comment: string | null;
  allow_publish: boolean;
  moderation: "pending" | "approved" | "rejected";
  created_at: string;
};
export type FeatureFlag = { key: string; default_enabled: boolean; description: string | null; updated_at: string };
export type FirmFeature = { firm_id: string; key: string; enabled: boolean; set_by: "admin" | "boss"; updated_at: string };
export type AdminAudit = { id: string; admin_email: string; action: string; target: string | null; details: Record<string, unknown>; created_at: string };
export type Expense = {
  id: string; firm_id: string; task_id: string; member_id: string; amount_cents: number; description: string;
  receipt_path: string | null; reimburse: boolean; status: "pending" | "approved" | "rejected";
  decided_by: string | null; decided_at: string | null; created_at: string;
};
export type Shift = {
  id: string; firm_id: string; member_id: string; started_at: string; ended_at: string | null; break_minutes: number;
  break_started_at: string | null; rate_cents: number; auto_closed: boolean; needs_review: boolean; created_at: string;
};
export type TimeEdit = {
  id: string; firm_id: string; member_id: string; kind: "shift" | "time_entry"; record_id: string; changed_by: string | null;
  before: Record<string, unknown>; after: Record<string, unknown>; reason: string; created_at: string;
};
export type Adjustment = {
  id: string; firm_id: string; member_id: string; amount_cents: number; reason: string; effective_date: string;
  created_by: string | null; created_at: string;
};
export type Client = {
  id: string; firm_id: string; name: string; email: string | null; phone: string | null; address: string | null;
  notes: string | null; hide_price: boolean; created_at: string;
};
export type TaskLink = { id: string; firm_id: string; task_id: string; token: string; expires_at: string; revoked: boolean; created_by: string | null; created_at: string };
export type InboundRequest = {
  id: string; firm_id: string; name: string; contact: string; address: string | null; message: string;
  status: "new" | "converted" | "dismissed"; task_id: string | null; client_id: string | null; created_at: string;
};
export type ChecklistTemplate = { id: string; firm_id: string; name: string; items: string[]; created_at: string };
export type TaskFile = {
  id: string; task_id: string; firm_id: string; comment_id: string | null; storage_path: string; file_name: string;
  mime_type: string; size_bytes: number; uploaded_by: string | null; created_at: string;
};
export type Activity = { id: string; firm_id: string; member_id: string | null; kind: string; task_id: string | null; payload: Record<string, unknown>; created_at: string };
export type NotificationPref = { member_id: string; type: string; enabled: boolean; updated_at: string };
export type GeoPoint = {
  id: string; firm_id: string; member_id: string; kind: "task_start" | "task_finish" | "shift_start" | "shift_end";
  task_id: string | null; shift_id: string | null; lat: number; lng: number; accuracy_m: number | null; created_at: string;
};
export type ShiftPlan = { id: string; firm_id: string; member_id: string; date: string; start_time: string; end_time: string; note: string | null; created_at: string };
export type ShiftSwap = { id: string; firm_id: string; plan_id: string; from_member: string; to_member: string; status: "pending" | "accepted" | "approved" | "rejected"; created_at: string; decided_at: string | null };
export type VacationRequest = {
  id: string; firm_id: string; member_id: string; date_from: string; date_to: string; days: number; note: string | null;
  status: "pending" | "approved" | "rejected"; decided_by: string | null; decided_at: string | null; created_at: string;
};
export type Announcement = { id: string; firm_id: string; group_id: string | null; title: string; body: string; created_by: string | null; created_at: string };
export type AnnouncementRead = { announcement_id: string; member_id: string; read_at: string };
export type DailyReport = { id: string; firm_id: string; member_id: string; date: string; task_id: string | null; done_text: string; problems: string | null; photo_paths: string[]; created_at: string };
export type FormField = { id: string; type: "text" | "number" | "checkbox" | "select" | "photo"; label: string; options?: string[] };
export type FormTemplate = { id: string; firm_id: string; name: string; fields: FormField[]; created_at: string };
export type FormSubmission = { id: string; firm_id: string; task_id: string; template_id: string; values: Record<string, unknown>; submitted_by: string | null; created_at: string };
export type MemberDocument = { id: string; firm_id: string; member_id: string; name: string; expires_on: string | null; file_path: string | null; reminded_at: string | null; created_at: string };
export type KbArticle = { id: string; firm_id: string; title: string; body: string; updated_at: string };
export type Consent = {
  id: string;
  user_id: string | null;
  member_id: string | null;
  kind: "cookies" | "geolocation" | "review_publish" | "terms";
  version: string;
  granted: boolean;
  created_at: string;
};
export type DataRequest = {
  id: string;
  firm_id: string;
  member_id: string;
  kind: "delete" | "export";
  status: "open" | "done" | "rejected";
  note: string | null;
  created_at: string;
  resolved_at: string | null;
};
export type Group = {
  id: string;
  firm_id: string;
  name: string;
  created_at: string;
};
export type Member = {
  id: string;
  firm_id: string;
  user_id: string | null;
  role: Role;
  full_name: string;
  email: string | null;
  phone: string | null;
  group_id: string | null;
  status: MemberStatus;
  pay_mode: PayMode;
  hourly_rate_cents: number;
  locale: Locale;
  notify_overdue: boolean;
  notify_done: boolean;
  archived_at: string | null;
  is_demo: boolean;
  hourly_basis: "tasks" | "shifts";
  vacation_days_per_year: number;
  created_at: string;
  updated_at: string;
};
export type UserSettings = {
  user_id: string;
  active_member_id: string | null;
  acting_member_id: string | null;
  onboarding_done: boolean;
  hints_dismissed: string[];
  reauth_at: string | null;
  updated_at: string;
};
export type LoginEvent = {
  id: string;
  user_id: string;
  kind: "login" | "reauth" | "logout" | "logout_all";
  user_agent: string | null;
  ip_hash: string | null;
  created_at: string;
};
export type Invite = {
  id: string;
  firm_id: string;
  token: string;
  role: Role;
  group_id: string | null;
  created_by: string | null;
  expires_at: string;
  max_uses: number;
  used_count: number;
  revoked: boolean;
  member_id: string | null;
  created_at: string;
};
export type TaskTemplate = {
  id: string;
  firm_id: string;
  title: string;
  description: string | null;
  address: string | null;
  assignee_id: string | null;
  priority: Priority;
  recurrence: Recurrence;
  weekdays: number[];
  month_day: number | null;
  client_price_cents: number | null;
  fixed_pay_cents: number | null;
  checklist: string[];
  active: boolean;
  last_run_on: string | null;
  kb_article_id: string | null;
  created_at: string;
};
export type Task = {
  id: string;
  firm_id: string;
  title: string;
  description: string | null;
  address: string | null;
  assignee_id: string | null;
  due_date: string | null;
  due_time: string | null;
  status: TaskStatus;
  priority: Priority;
  fixed_pay_cents: number | null;
  template_id: string | null;
  created_by: string | null;
  completed_at: string | null;
  overdue_notified_at: string | null;
  submitted_at: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  rating: number | null;
  rework_count: number;
  review_reminded_at: string | null;
  custom_status_id: string | null;
  client_id: string | null;
  accepted_via: "boss" | "auto" | "client" | null;
  pinned: boolean;
  reminder_sent_at: string | null;
  lat: number | null;
  lng: number | null;
  kb_article_id: string | null;
  created_at: string;
  updated_at: string;
};
export type TaskStatusRow = {
  id: string;
  firm_id: string;
  name: string;
  color: StatusColor;
  position: number;
  kind: TaskStatus;
  is_system: boolean;
  created_at: string;
};
export type TaskFinance = {
  task_id: string;
  firm_id: string;
  client_price_cents: number;
  updated_at: string;
};
export type ChecklistItem = {
  id: string;
  task_id: string;
  firm_id: string;
  text: string;
  done: boolean;
  position: number;
  updated_at: string;
};
export type TaskComment = {
  id: string;
  task_id: string;
  firm_id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
};
export type TaskPhoto = {
  id: string;
  task_id: string;
  firm_id: string;
  storage_path: string;
  uploaded_by: string | null;
  kind: "general" | "before" | "after";
  created_at: string;
};
export type TimeEntry = {
  id: string;
  task_id: string;
  firm_id: string;
  member_id: string;
  started_at: string;
  ended_at: string | null;
  rate_cents: number;
  created_at: string;
};
export type TaskRequest = {
  id: string;
  firm_id: string;
  created_by: string;
  title: string;
  description: string | null;
  address: string | null;
  due_date: string | null;
  status: RequestStatus;
  task_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};
export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  member_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      firms: Table<Firm, "name">;
      groups: Table<Group, "firm_id" | "name">;
      members: Table<Member, "firm_id" | "role" | "full_name">;
      invites: Table<Invite, "firm_id">;
      task_templates: Table<TaskTemplate, "firm_id" | "title" | "recurrence">;
      tasks: Table<Task, "firm_id" | "title">;
      task_statuses: Table<TaskStatusRow, "firm_id" | "name" | "kind">;
      user_settings: Table<UserSettings, "user_id">;
      login_events: Table<LoginEvent, "user_id" | "kind">;
      consents: Table<Consent, "kind" | "version" | "granted">;
      site_content: Table<SiteContent, "key" | "locale">;
      plans: Table<PlanRow, "id">;
      reviews: Table<Review, "firm_id" | "rating">;
      feature_flags: Table<FeatureFlag, "key">;
      firm_features: Table<FirmFeature, "firm_id" | "key" | "enabled">;
      admin_audit: Table<AdminAudit, "admin_email" | "action">;
      expenses: Table<Expense, "task_id" | "member_id" | "amount_cents" | "description">;
      shifts: Table<Shift, "firm_id" | "member_id" | "started_at">;
      time_edits: Table<TimeEdit, "firm_id" | "member_id" | "kind" | "record_id" | "before" | "after" | "reason">;
      adjustments: Table<Adjustment, "firm_id" | "member_id" | "amount_cents" | "reason" | "effective_date">;
      clients: Table<Client, "firm_id" | "name">;
      task_links: Table<TaskLink, "task_id">;
      inbound_requests: Table<InboundRequest, "firm_id" | "name" | "contact" | "message">;
      checklist_templates: Table<ChecklistTemplate, "firm_id" | "name">;
      task_files: Table<TaskFile, "task_id" | "storage_path" | "file_name" | "mime_type" | "size_bytes">;
      activity: Table<Activity, "firm_id" | "kind">;
      notification_prefs: Table<NotificationPref, "member_id" | "type" | "enabled">;
      geo_points: Table<GeoPoint, "firm_id" | "member_id" | "kind" | "lat" | "lng">;
      shift_plans: Table<ShiftPlan, "firm_id" | "member_id" | "date" | "start_time" | "end_time">;
      shift_swaps: Table<ShiftSwap, "firm_id" | "plan_id" | "from_member" | "to_member">;
      vacation_requests: Table<VacationRequest, "firm_id" | "member_id" | "date_from" | "date_to" | "days">;
      announcements: Table<Announcement, "firm_id" | "title" | "body">;
      announcement_reads: Table<AnnouncementRead, "announcement_id" | "member_id">;
      daily_reports: Table<DailyReport, "firm_id" | "member_id" | "date" | "done_text">;
      form_templates: Table<FormTemplate, "firm_id" | "name">;
      form_submissions: Table<FormSubmission, "task_id" | "template_id">;
      member_documents: Table<MemberDocument, "firm_id" | "member_id" | "name">;
      kb_articles: Table<KbArticle, "firm_id" | "title" | "body">;
      data_requests: Table<DataRequest, "firm_id" | "member_id" | "kind">;
      task_finance: Table<TaskFinance, "task_id">;
      checklist_items: Table<ChecklistItem, "task_id" | "text">;
      task_comments: Table<TaskComment, "task_id" | "author_name" | "body">;
      task_photos: Table<TaskPhoto, "task_id" | "storage_path">;
      time_entries: Table<TimeEntry, "task_id" | "member_id" | "started_at">;
      task_requests: Table<TaskRequest, "firm_id" | "created_by" | "title">;
      push_subscriptions: Table<PushSubscriptionRow, "user_id" | "member_id" | "endpoint" | "p256dh" | "auth">;
    };
    Views: { [_ in never]: never };
    Functions: {
      create_firm: {
        Args: { p_firm_name: string; p_full_name: string; p_locale?: string };
        Returns: string;
      };
      accept_invite: {
        Args: { p_token: string; p_full_name: string; p_locale?: string };
        Returns: string;
      };
      current_context: {
        Args: Record<string, never>;
        Returns: { member_id: string | null; real_member_id: string | null; own_member_id: string | null; demo_member_id: string | null; acting: boolean }[];
      };
      switch_firm: { Args: { p_target: "own" | "demo" }; Returns: undefined };
      set_acting: { Args: { p_member: string | null }; Returns: undefined };
      create_demo_firm: { Args: Record<string, never>; Returns: string };
      reset_demo_firm: { Args: Record<string, never>; Returns: string };
      dismiss_hint: { Args: { p_key: string }; Returns: undefined };
      finish_onboarding: { Args: Record<string, never>; Returns: undefined };
      rate_limit_hit: { Args: { p_bucket: string; p_max: number; p_window_seconds: number }; Returns: boolean };
      published_reviews: {
        Args: { p_limit?: number };
        Returns: { client_name: string; rating: number; comment: string; created_at: string }[];
      };
      admin_firm_overview: {
        Args: Record<string, never>;
        Returns: {
          id: string; name: string; created_at: string; plan: FirmPlan; trial_ends_at: string; is_demo: boolean;
          members: number; tasks: number; last_activity: string; owner_email: string | null; deletion_scheduled_for: string | null;
        }[];
      };
      edit_time_record: {
        Args: { p_kind: "shift" | "time_entry"; p_id: string; p_started_at: string; p_ended_at: string | null; p_break_minutes: number; p_reason: string };
        Returns: undefined;
      };
      search_all: { Args: { p_q: string; p_limit?: number }; Returns: { kind: "task" | "member" | "client" | "request"; id: string; title: string; subtitle: string }[] };
      colleagues: { Args: Record<string, never>; Returns: { id: string; full_name: string }[] };
      decide_swap: { Args: { p_swap: string; p_action: "accept" | "approve" | "reject" }; Returns: undefined };
      invite_info: {
        Args: { p_token: string };
        Returns: { firm_name: string; role: Role; valid: boolean }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
