/** Benachrichtigungsarten. "new_task" für Mitarbeiter ist immer an (Anforderung). */
export const NOTIFY_TYPES = {
  boss: ["task_review", "overdue", "new_request", "expense_pending", "client_accepted", "new_review", "inbound", "mention", "vacation_request", "shift_swap"],
  employee: ["task_rework", "task_accepted", "mention", "due_soon", "vacation_answer", "shift_swap"],
} as const;
export type NotifyType = (typeof NOTIFY_TYPES)["boss"][number] | (typeof NOTIFY_TYPES)["employee"][number] | "new_task";
