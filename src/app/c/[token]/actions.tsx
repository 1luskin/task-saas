"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { clientAccept, clientReview } from "@/server/actions/public";
import { cx } from "@/components/ui";

export function ClientActions({ token, status, reviewed }: { token: string; status: string; reviewed: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [allow, setAllow] = useState(false);
  const [done, setDone] = useState(reviewed);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="card-white space-y-4 p-5">
      {status === "review" && (
        <button className="btn-primary btn-xl w-full" disabled={pending} onClick={() => start(async () => { const r = await clientAccept(token); if (!r.ok) setError(t("common.error")); router.refresh(); })}>
          {t("cl.accept")}
        </button>
      )}
      {status === "done" && <p className="font-semibold text-ok">{t("cl.accepted")}</p>}
      {status !== "review" && status !== "done" && <p className="text-muted">{t("cl.waiting")}</p>}
      {status === "done" &&
        (done ? (
          <p className="text-ink-2">{t("cl.thanks")}</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!rating) return;
              start(async () => {
                const r = await clientReview(token, { rating, comment, allowPublish: allow, name });
                if (r.ok) setDone(true);
                else setError(t("common.error"));
              });
            }}
          >
            <h2 className="font-semibold">{t("cl.rateTitle")}</h2>
            <div className="flex gap-1" role="radiogroup" aria-label={t("cl.rateTitle")}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}/5`} onClick={() => setRating(n)} className="flex size-12 items-center justify-center rounded-[12px] hover:bg-white/5">
                  <Star strokeWidth={1.8} className={cx("size-7", n <= rating ? "fill-review text-review" : "text-muted")} />
                </button>
              ))}
            </div>
            <textarea className="input min-h-24 py-3" placeholder={t("cl.comment")} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
            <input className="input" placeholder={t("pub.name")} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            <label className="flex min-h-12 items-start gap-3 text-sm text-ink-2">
              <input type="checkbox" className="mt-1 size-5" checked={allow} onChange={(e) => setAllow(e.target.checked)} />
              {t("cl.allowPublish")}
            </label>
            <button className="btn-primary w-full" disabled={pending || !rating}>{t("cl.send")}</button>
          </form>
        ))}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </section>
  );
}
