"use client";
import { useRef } from "react";
import { useI18n } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { isDemo } from "@/lib/demo/mode";
import { compressImage } from "@/lib/image";
import { setMyAvatar } from "@/server/actions/members";
import { useAction, ErrorText } from "./use-action";
import { Avatar } from "./ui";

export function AvatarUpload({ firmId, memberId, name, avatarPath }: { firmId: string; memberId: string; name: string; avatarPath: string | null }) {
  const { t } = useI18n();
  const { run, pending, error, setError } = useAction();
  const ref = useRef<HTMLInputElement>(null);
  async function pick(file: File) {
    if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) return setError(t("common.invalid"));
    const blob = await compressImage(file, 512); // verkleinert + ohne EXIF/GPS
    const path = `${firmId}/${memberId}/${crypto.randomUUID()}.jpg`;
    const up = await createClient().storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
    if (up.error) return setError(t("common.error"));
    run(() => setMyAvatar(path));
  }
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} memberId={memberId} avatarPath={avatarPath} className="size-14 text-lg" />
      {!isDemo() && (
        <div className="flex flex-wrap gap-2">
          <input ref={ref} type="file" accept="image/*" className="sr-only" aria-label={t("profile.photo")} onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }} />
          <button type="button" className="btn-secondary !min-h-11 text-sm" disabled={pending} onClick={() => ref.current?.click()}>{t("profile.photo")}</button>
          {avatarPath && <button type="button" className="btn-ghost !min-h-11 text-sm" disabled={pending} onClick={() => run(() => setMyAvatar(null))}>{t("profile.removePhoto")}</button>}
          <ErrorText error={error} />
        </div>
      )}
    </div>
  );
}
