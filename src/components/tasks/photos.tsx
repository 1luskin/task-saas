"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { deletePhoto, registerPhoto } from "@/server/actions/tasks";
import { IconCamera, IconTrash } from "../icons";

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
}: { taskId: string; firmId: string; photos: { id: string; url: string | null; uploaded_by: string | null }[]; myMemberId: string; isBoss: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      for (const f of Array.from(files).slice(0, 10)) {
        const blob = await compress(f);
        const path = `${firmId}/${taskId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from("task-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        const r = await registerPhoto(taskId, path);
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
      <div className="mb-2 font-medium">{t("task.photos")}</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} className="group relative aspect-square overflow-hidden rounded-[12px] bg-card">
            {p.url && (
              <a href={p.url} target="_blank" rel="noreferrer">
                <img src={p.url} alt="" className="size-full object-cover" loading="lazy" />
              </a>
            )}
            {(isBoss || p.uploaded_by === myMemberId) && (
              <button
                className="absolute right-1 top-1 rounded-full bg-black/50 p-1.5 text-white"
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
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[12px] border-2 border-dashed border-line text-sm text-muted hover:border-accent hover:text-accent"
        >
          <IconCamera />
          {busy ? t("task.uploading") : t("task.addPhoto")}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
