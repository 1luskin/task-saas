"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { isDemo } from "@/lib/demo/mode";
import { deleteFile, registerFile } from "@/server/actions/views";
import { IconDownload, IconTrash } from "../icons";

const MAX = 10 * 1024 * 1024;
const TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "application/msword", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

export function TaskFiles({ taskId, firmId, files, myMemberId, isBoss }: { taskId: string; firmId: string; files: { id: string; name: string; size: number; url: string | null; uploaded_by: string | null }[]; myMemberId: string; isBoss: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    setError(null);
    if (f.size > MAX || !TYPES.includes(f.type)) return setError(t("views.fileHint"));
    setBusy(true);
    try {
      const safe = f.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-80);
      const path = `${firmId}/${taskId}/${crypto.randomUUID()}-${safe}`;
      const up = await createClient().storage.from("task-files").upload(path, f, { contentType: f.type });
      if (up.error) throw up.error;
      const r = await registerFile({ taskId, path, name: f.name, mime: f.type, size: f.size });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t("views.files")}</h2>
        {!isDemo() && <button className="btn-secondary !min-h-10 text-sm" disabled={busy} onClick={() => ref.current?.click()}>{busy ? t("task.uploading") : t("views.addFile")}</button>}
      </div>
      <input ref={ref} type="file" hidden accept={TYPES.join(",")} onChange={(e) => upload(e.target.files)} />
      {files.map((f) => (
        <div key={f.id} className="flex items-center gap-2 rounded-[12px] bg-card px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{f.name}</span>
          <span className="text-xs tabular-nums text-muted">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
          {f.url && <a href={f.url} target="_blank" rel="noreferrer" className="btn-ghost !min-h-9 !px-2" aria-label={f.name}><IconDownload className="size-4" /></a>}
          {(isBoss || f.uploaded_by === myMemberId) && (
            <button className="btn-ghost !min-h-9 !px-2 text-muted" aria-label={t("common.delete")} onClick={async () => { if (confirm(t("common.confirmDelete"))) { await deleteFile(f.id); router.refresh(); } }}><IconTrash className="size-4" /></button>
          )}
        </div>
      ))}
      {!files.length && <p className="text-sm text-muted">{isDemo() ? t("demo.photosDisabled") : t("views.fileHint")}</p>}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
