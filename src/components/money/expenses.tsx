"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { isDemo } from "@/lib/demo/mode";
import { createExpense, decideExpense, deleteExpense } from "@/server/actions/money";
import { formatMoney } from "@/lib/money";
import { useAction, ErrorText } from "../use-action";
import { Field, Input, cx } from "../ui";
import { IconTrash } from "../icons";

type Row = { id: string; amount_cents: number; description: string; status: string; reimburse: boolean; member_id: string; receiptUrl: string | null; memberName: string };

/** Bild im Browser verkleinern (entfernt auch EXIF/GPS) */
async function compress(file: File): Promise<Blob> {
  if (file.type === "application/pdf") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.82));
  } catch {
    return file;
  }
}

export function Expenses({ taskId, firmId, rows, isBoss, myMemberId, canAdd }: { taskId: string; firmId: string; rows: Row[]; isBoss: boolean; myMemberId: string; canAdd: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ amount: "", description: "", reimburse: false });
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let receiptPath: string | null = null;
    const file = fileRef.current?.files?.[0];
    if (file && !isDemo()) {
      if (file.size > 10 * 1024 * 1024) return setError(t("common.invalid"));
      const blob = await compress(file);
      const ext = file.type === "application/pdf" ? "pdf" : "jpg";
      const path = `${firmId}/${taskId}/${crypto.randomUUID()}.${ext}`;
      const up = await createClient().storage.from("receipts").upload(path, blob, { contentType: ext === "pdf" ? "application/pdf" : "image/jpeg" });
      if (up.error) return setError(t("common.error"));
      receiptPath = path;
    }
    run(() => createExpense({ taskId, ...v, receiptPath }), {
      onOk: () => {
        setV({ amount: "", description: "", reimburse: false });
        setOpen(false);
        router.refresh();
      },
    });
  }

  const label: Record<string, string> = { pending: t("expense.pending"), approved: t("expense.approved"), rejected: t("expense.rejected") };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t("expense.title")}</h2>
        {canAdd && !open && <button className="btn-secondary !min-h-10 text-sm" onClick={() => setOpen(true)}>{t("expense.add")}</button>}
      </div>
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-[12px] bg-card px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate">{r.description}</div>
            <div className="text-xs text-muted">{r.memberName}{r.reimburse ? ` · ${t("expense.reimbursements")}` : ""}{r.receiptUrl && <> · <a className="text-link" href={r.receiptUrl} target="_blank" rel="noreferrer">{t("expense.viewReceipt")}</a></>}</div>
          </div>
          <span className="font-semibold tabular-nums">{formatMoney(r.amount_cents, locale)}</span>
          <span className={cx("chip", r.status === "approved" ? "bg-ok-soft text-ok" : r.status === "rejected" ? "bg-danger-soft text-danger" : "bg-review-soft text-review")}>{label[r.status]}</span>
          {isBoss && r.status === "pending" && (
            <>
              <button className="btn-primary !min-h-9 !px-3 text-sm" disabled={pending} onClick={() => run(() => decideExpense(r.id, true))}>{t("expense.approve")}</button>
              <button className="btn-secondary !min-h-9 !px-3 text-sm" disabled={pending} onClick={() => run(() => decideExpense(r.id, false))}>{t("expense.reject")}</button>
            </>
          )}
          {(isBoss || (r.member_id === myMemberId && r.status === "pending")) && (
            <button className="btn-ghost !min-h-9 !px-2 text-muted" aria-label={t("common.delete")} onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteExpense(r.id))}>
              <IconTrash className="size-4" />
            </button>
          )}
        </div>
      ))}
      {open && (
        <form className="space-y-3 rounded-[14px] bg-card p-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("expense.amount")}><Input inputMode="decimal" required placeholder="0,00" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></Field>
            <Field label={t("expense.what")}><Input required maxLength={300} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
          </div>
          {!isDemo() && <Field label={t("expense.receipt")}><input ref={fileRef} type="file" accept="image/*,application/pdf" className="block w-full text-sm" /></Field>}
          <label className="flex min-h-12 items-center gap-3">
            <input type="checkbox" className="size-5" checked={v.reimburse} onChange={(e) => setV({ ...v, reimburse: e.target.checked })} />
            {t("expense.reimburse")}
          </label>
          <ErrorText error={error} />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={pending}>{t("common.save")}</button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
          </div>
        </form>
      )}
    </div>
  );
}
