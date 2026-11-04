import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { getMembers } from "@/server/queries";
import { EmptyState, PageTitle } from "@/components/ui";
import { RequestDecision } from "./decision";
import Link from "next/link";
import { IconPin } from "@/components/icons";

export default async function RequestsPage() {
  const ctx = await requireBossPage();
  const { t, locale } = await getI18n();
  const [{ data: requests }, members] = await Promise.all([
    ctx.supabase.from("task_requests").select("*").eq("firm_id", ctx.firm.id).order("created_at", { ascending: false }).limit(100),
    getMembers(ctx, { includeArchived: true }),
  ]);
  const name = (id: string | null) => members.find((m) => m.id === id)?.full_name ?? "?";
  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const done = (requests ?? []).filter((r) => r.status !== "pending");
  const active = members.filter((m) => !m.archived_at).map((m) => ({ id: m.id, full_name: m.full_name, status: m.status, pay_mode: m.pay_mode }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle>{t("requests.title")}</PageTitle>
      {pending.length === 0 && <EmptyState>{t("requests.none")}</EmptyState>}
      {pending.map((r) => (
        <div key={r.id} className="card-white space-y-3 p-4">
          <div>
            <div className="text-sm text-muted">{t("requests.from", { name: name(r.created_by) })} · {formatDate(r.created_at.slice(0, 10), locale)}</div>
            <div className="text-lg font-semibold">{r.title}</div>
            {r.description && <p className="mt-1 whitespace-pre-wrap text-muted">{r.description}</p>}
            {r.address && <p className="mt-1 flex items-center gap-1 text-sm"><IconPin className="size-4 text-muted" />{r.address}</p>}
          </div>
          <RequestDecision id={r.id} dueDate={r.due_date ?? ""} members={active} />
        </div>
      ))}
      {done.length > 0 && (
        <div className="card-white divide-y divide-line/70">
          {done.map((r) => (
            <div key={r.id} className="flex min-h-12 items-center justify-between gap-2 px-4 py-2 text-sm">
              <span className="min-w-0 truncate">
                {r.task_id ? <Link className="text-link" href={`/boss/tasks/${r.task_id}`}>{r.title}</Link> : r.title}
                <span className="text-muted"> · {name(r.created_by)}</span>
              </span>
              <span className={r.status === "approved" ? "chip bg-ok-soft text-ok" : "chip bg-card text-muted"}>{t(`requests.${r.status}`)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
