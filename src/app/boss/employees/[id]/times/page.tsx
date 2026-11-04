import { notFound } from "next/navigation";
import Link from "next/link";
import { requireBossPage } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { TimesView } from "@/components/shifts/times-view";
import { PageTitle } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";

export default async function MemberTimes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireBossPage();
  const { t, locale } = await getI18n();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: m } = await ctx.supabase.from("members").select("id, full_name").eq("id", id).eq("firm_id", ctx.firm.id).maybeSingle();
  if (!m) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/boss/employees" className="inline-flex min-h-10 items-center gap-1 text-muted hover:text-ink"><IconChevronLeft className="size-5" />{t("common.back")}</Link>
      <PageTitle>{t("times.title")} · {m.full_name}</PageTitle>
      <TimesView ctx={ctx} memberId={m.id} t={t} locale={locale} editable />
    </div>
  );
}
