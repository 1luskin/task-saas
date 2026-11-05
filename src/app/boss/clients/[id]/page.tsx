import { notFound } from "next/navigation";
import Link from "next/link";
import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { clientStats } from "@/server/client-stats";
import { ClientForm } from "@/components/clients/client-form";
import { TaskRow } from "@/components/tasks/task-row";
import { PageTitle, Stat } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await requireBossPage();
  const { t, locale } = await getI18n();
  const { data: client } = await ctx.supabase.from("clients").select("*").eq("id", id).eq("firm_id", ctx.firm.id).maybeSingle();
  if (!client) notFound();
  const [{ data: tasks }, stats] = await Promise.all([
    ctx.supabase.from("tasks").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(100),
    clientStats(ctx, [id]),
  ]);
  const taskIds = (tasks ?? []).map((x) => x.id);
  const { data: clientReviews } = taskIds.length ? await ctx.supabase.from("reviews").select("*").in("task_id", taskIds).order("created_at", { ascending: false }) : { data: [] };
  const s = stats.get(id);
  return (
    <div className="space-y-4">
      <Link href="/boss/clients" className="inline-flex min-h-10 items-center gap-1 text-muted hover:text-ink"><IconChevronLeft className="size-5" />{t("common.back")}</Link>
      <PageTitle actions={<a className="btn-secondary" href={`/api/qr/client/${client.id}`}>{t("qr.sticker")}</a>}>{client.name}</PageTitle>
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t("clients.tasks")} value={s?.tasks ?? 0} />
        <Stat label={t("clients.revenue")} value={<span className="text-xl sm:text-2xl">{formatMoney(s?.revenue ?? 0, locale)}</span>} />
        <Stat label={t("clients.profit")} value={<span className="text-xl sm:text-2xl">{formatMoney(s?.profit ?? 0, locale)}</span>} tone="accent" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-semibold">{t("clients.history")}</h2>
          {(tasks ?? []).map((task) => <TaskRow key={task.id} task={task} href={`/boss/tasks/${task.id}`} assigneeName={null} t={t} locale={locale} showAssignee={false} />)}
        </section>
        <div className="space-y-4">
          <section className="card-white p-4"><ClientForm client={client} /></section>
          <section className="card-white space-y-2 p-4">
            <h2 className="font-semibold">{t("clients.reviews")}</h2>
            {(clientReviews ?? []).map((r) => (
              <div key={r.id} className="rounded-[12px] bg-card px-3 py-2 text-sm">
                <div className="flex justify-between"><span className="tabular-nums font-semibold text-review">{r.rating}/5</span><span className="text-muted">{formatDate(r.created_at.slice(0, 10), locale)}</span></div>
                {r.comment && <p className="mt-1 whitespace-pre-wrap break-words text-ink-2">{r.comment}</p>}
              </div>
            ))}
            {!clientReviews?.length && <p className="text-sm text-muted">—</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
