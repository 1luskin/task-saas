import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { getMembers } from "@/server/queries";
import { EmptyState, PageTitle } from "@/components/ui";
import { TaskRow } from "@/components/tasks/task-row";
import { ArchiveSearch } from "@/components/tasks/archive-search";

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireBossPage();
  const { t, locale } = await getI18n();
  const { q } = await searchParams;
  const members = await getMembers(ctx, { includeArchived: true });
  let query = ctx.supabase.from("tasks").select("*").eq("firm_id", ctx.firm.id).eq("status", "done").order("completed_at", { ascending: false }).limit(200);
  const term = (q ?? "").trim().slice(0, 100).replace(/[%,()*\\]/g, " ");
  if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%,address.ilike.%${term}%`);
  const { data } = await query;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle>{t("archive.title")}</PageTitle>
      <ArchiveSearch initial={q ?? ""} />
      <div className="space-y-2">
        {(data ?? []).length === 0 && <EmptyState>{t("archive.empty")}</EmptyState>}
        {(data ?? []).map((task) => (
          <TaskRow key={task.id} task={task} href={`/boss/tasks/${task.id}`} assigneeName={members.find((m) => m.id === task.assignee_id)?.full_name ?? null} t={t} locale={locale} />
        ))}
      </div>
    </div>
  );
}
