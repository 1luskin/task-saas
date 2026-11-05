import { notFound } from "next/navigation";
import { NewDocButton } from "@/components/invoices/offer-editor";
import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { loadTaskDetail } from "@/server/task-detail";
import { getMembers } from "@/server/queries";
import { TaskDetail } from "@/components/tasks/task-detail";
import { isEnabled } from "@/lib/features";
import { BossTaskTools } from "@/components/tasks/boss-task-tools";
import { centsToInput } from "@/lib/money";
import { ClientLinkPanel } from "@/components/clients/link-panel";
import { serverEnv } from "@/lib/env";
import Link from "next/link";

/** gültiger (nicht abgelaufener) Link – außerhalb des Renderns, da zeitabhängig */
function activeLink<T extends { expires_at: string }>(links: T[], now = Date.now()): T | null {
  return links.find((l) => new Date(l.expires_at).getTime() > now) ?? null;
}

export default async function BossTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireBossPage();
  const { t, locale } = await getI18n();
  const [d, members, clientsOn] = await Promise.all([loadTaskDetail(ctx, id), getMembers(ctx), isEnabled(ctx, "clients")]);
  if (!d) notFound();
  const { task } = d;
  const [{ data: clients }, { data: links }] = clientsOn
    ? await Promise.all([
        ctx.supabase.from("clients").select("id, name").eq("firm_id", ctx.firm.id).order("name"),
        ctx.supabase.from("task_links").select("*").eq("task_id", task.id).eq("revoked", false).order("created_at", { ascending: false }).limit(1),
      ])
    : [{ data: [] }, { data: [] }];
  const link = activeLink(links ?? []);
  const invoicesOn = await isEnabled(ctx, "invoices");
  const { data: taskInvoices } = invoicesOn ? await ctx.supabase.from("invoices").select("id, number, status, kind").eq("task_id", task.id).order("created_at") : { data: [] };
  return (
    <TaskDetail
      d={d}
      ctx={ctx}
      t={t}
      locale={locale}
      backHref="/boss"
      expensesOn={await isEnabled(ctx, "expenses")}
      geoOn={await isEnabled(ctx, "geolocation")}
      checklistTemplates={(await ctx.supabase.from("checklist_templates").select("id, name").eq("firm_id", ctx.firm.id).order("name")).data ?? []}
      clientPanel={
        clientsOn ? (
          <div className="card-white space-y-2 p-4 sm:p-6">
            {task.client_id && (
              <div className="text-sm text-muted">
                {t("clients.client")}: <Link className="text-link" href={`/boss/clients/${task.client_id}`}>{clients?.find((c) => c.id === task.client_id)?.name ?? "—"}</Link>
              </div>
            )}
            {invoicesOn && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {(taskInvoices ?? []).map((i) => <Link key={i.id} className="chip bg-surface-3 text-ink-2" href={`/boss/invoices/${i.id}`}>{i.number ?? t("inv.draft")}</Link>)}
                {task.status === "done" && !(taskInvoices ?? []).some((i) => i.kind === "invoice" && i.status !== "cancelled") && <NewDocButton kind="invoice" taskId={task.id} label={t("inv.fromTask")} className="btn-secondary !min-h-10 text-sm" />}
              </div>
            )}
            <ClientLinkPanel taskId={task.id} title={task.title} appUrl={serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")} link={link ? { id: link.id, token: link.token, expires_at: link.expires_at } : null} />
          </div>
        ) : null
      }
      bossTools={
        <BossTaskTools
          clients={clients ?? []}
          taskId={task.id}
          fields={ctx.firm.task_fields}
          members={members.map((m) => ({ id: m.id, full_name: m.full_name, status: m.status, pay_mode: m.pay_mode }))}
          initial={{
            title: task.title,
            description: task.description ?? "",
            assignee_id: task.assignee_id ?? "",
            due_date: task.due_date ?? "",
            due_time: task.due_time?.slice(0, 5) ?? "",
            priority: task.priority,
            status: task.status,
            address: task.address ?? "",
            client_price: centsToInput(d.clientPriceCents),
            fixed_pay: centsToInput(task.fixed_pay_cents),
            checklist: "",
            client_id: task.client_id ?? "",
          }}
        />
      }
    />
  );
}
