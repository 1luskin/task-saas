import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { isEnabled } from "@/lib/features";
import { formatMoney } from "@/lib/money";
import { clientStats } from "@/server/client-stats";
import { ClientForm } from "@/components/clients/client-form";
import { LoadMore, parseLimit } from "@/components/load-more";
import { EmptyState, PageTitle } from "@/components/ui";
import { IconUsers } from "@/components/icons";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ limit?: string }> }) {
  const limit = parseLimit((await searchParams).limit);
  const ctx = await requireBossPage();
  if (!(await isEnabled(ctx, "clients"))) notFound();
  const { t, locale } = await getI18n();
  const [{ data: clients }, stats] = await Promise.all([
    ctx.supabase.from("clients").select("*").eq("firm_id", ctx.firm.id).order("name").limit(limit),
    clientStats(ctx),
  ]);
  return (
    <div className="space-y-4">
      <PageTitle>{t("clients.title")}</PageTitle>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="card-white divide-y divide-line/60">
          {(clients ?? []).map((c) => {
            const s = stats.get(c.id);
            return (
              <Link key={c.id} href={`/boss/clients/${c.id}`} className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-3 hover:bg-card">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{c.name}</div>
                  <div className="truncate text-sm text-muted">{[c.phone, c.email, c.address].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="tabular-nums">{t("clients.revenue")}: {formatMoney(s?.revenue ?? 0, locale)}</div>
                  <div className="tabular-nums text-link">{t("clients.profit")}: {formatMoney(s?.profit ?? 0, locale)}</div>
                </div>
              </Link>
            );
          })}
          {!clients?.length && <EmptyState icon={<IconUsers />}>{t("clients.none")}</EmptyState>}
          <LoadMore shown={(clients ?? []).length} limit={limit} href={(n) => `/boss/clients?limit=${n}`} />
        </div>
        <section className="card-white space-y-3 p-4">
          <h2 className="font-semibold">{t("clients.new")}</h2>
          <ClientForm />
        </section>
      </div>
    </div>
  );
}
