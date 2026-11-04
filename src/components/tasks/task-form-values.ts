import type { Priority, TaskStatus } from "@/lib/supabase/types";

// Bewusst NICHT in task-form.tsx ("use client"): Server-Seiten importieren diese Werte.
export interface TaskFormValues {
  title: string;
  description: string;
  assignee_id: string;
  due_date: string;
  due_time: string;
  priority: Priority;
  status: TaskStatus;
  address: string;
  client_price: string;
  fixed_pay: string;
  checklist: string;
  client_id?: string;
}
export const emptyTaskForm: TaskFormValues = {
  title: "", description: "", assignee_id: "", due_date: "", due_time: "", priority: "normal",
  status: "new", address: "", client_price: "", fixed_pay: "", checklist: "", client_id: "",
};
