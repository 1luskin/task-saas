import { requireSuperadmin } from "@/lib/superadmin";
import { getI18n } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { ReviewModeration } from "@/components/admin/content-forms";
import { PageTitle, cx } from "@/components/ui";

export default async function AdminReviews() {
  const { admin } = await requireSuperadmin();
  const { t, locale } = await getI18n();
  const { data } = await admin.from("reviews").select("*").order("created_at", { ascending: false }).limit(200);
  return (
    <div className="space-y-4">
      <PageTitle>{t("admin.reviews")}</PageTitle>
      {!data?.length && <p className="text-muted">{t("admin.noReviews")}</p>}
      {(data ?? []).map((r) => (
        <div key={r.id} className="card-white flex flex-wrap items-start gap-3 p-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-sm text-muted">{formatDate(r.created_at.slice(0, 10), locale)} · {r.client_name ?? "—"} · <span className="tabular-nums">{r.rating}/5</span></div>
            <p className="whitespace-pre-wrap break-words">{r.comment}</p>
            <div className={cx("text-xs", r.allow_publish ? "text-ok" : "text-muted")}>{r.allow_publish ? t("admin.allowPublish") : t("admin.notAllowed")} · {r.moderation}</div>
          </div>
          {r.allow_publish && r.moderation === "pending" && <ReviewModeration id={r.id} />}
        </div>
      ))}
    </div>
  );
}
