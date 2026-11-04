"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { deletePhoto, registerPhoto } from "@/server/actions/tasks";
import { IconCamera, IconTrash } from "../icons";
import { isDemo } from "@/lib/demo/mode";
import { putOfflineFile } from "@/lib/offline/files";

/** Bild im Browser verkleinern (spart mobile Daten): max. 1600px, JPEG 0.82 */
async function compress(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.82));
  } catch {
    return file;
  }
}

export function Photos({
  taskId, firmId, photos, myMemberId, isBoss,
}: { taskId: string; firmId: string; photos: { id: string; url: string | null; uploaded_by: string | null; kind?: string }[]; myMemberId: string; isBoss: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<"general" | "before" | "after">("general");
  const [queued, setQueued] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      for (const f of Array.from(files).slice(0, 10)) {
        const blob = await compress(f);
        if (!navigator.onLine) {
          // offline: in IndexedDB merken, Upload später automatisch
          await putOfflineFile({ id: crypto.randomUUID(), kind: "photo", taskId, firmId, blob, photoKind: kind, createdAt: new Date().toISOString() });
          setQueued((q) => q + 1);
          continue;
        }
        const path = `${firmId}/${taskId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from("task-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        const r = await registerPhoto(taskId, path, kind);
        if (!r.ok) throw new Error(r.error);
      }
      router.refresh();
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{t("task.photos")}</span>
        <div className="inline-flex rounded-[10px] bg-card p-0.5" role="radiogroup" aria-label={t("task.photos")}>
          {(["general", "before", "after"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`min-h-9 rounded-[8px] px-3 text-sm ${kind === k ? "bg-surface-3 text-ink" : "text-muted"}`}>
              {k === "general" ? t("task.photos") : k === "before" ? t("cl.before") : t("cl.after")}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} className="group relative aspect-square overflow-hidden rounded-[12px] bg-card">
            {p.url && (
              <a href={p.url} target="_blank" rel="noreferrer">
                <img src={p.url} alt="" className="size-full object-cover" loading="lazy" />
              </a>
            )}
            {p.kind && p.kind !== "general" && <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{p.kind === "before" ? t("cl.before") : t("cl.after")}</span>}
            {(isBoss || p.uploaded_by === myMemberId) && (
              <button
                className="absolute right-1 top-1 rounded-full bg-white/50 p-1.5 text-white"
                onClick={async () => {
                  if (!confirm(t("common.confirmDelete"))) return;
                  await deletePhoto(p.id);
                  router.refresh();
                }}
                aria-label={t("common.delete")}
              >
                <IconTrash className="size-4" />
              </button>
            )}
          </div>
        ))}
        {isDemo() ? (
          <div className="col-span-2 flex items-center rounded-[12px] bg-card p-3 text-sm text-muted">{t("demo.photosDisabled")}</div>
        ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[12px] border-2 border-dashed border-line text-sm text-muted hover:border-accent hover:text-link"
        >
          <IconCamera />
          {busy ? t("task.uploading") : t("task.addPhoto")}
        </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      {queued > 0 && <p className="mt-1 text-sm text-review">{t("offline.filesQueued", { n: queued })}</p>}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
