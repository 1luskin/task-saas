"use client";
import { useI18n } from "@/i18n/client";
import { logout } from "@/server/actions/auth";
import { clearQueue } from "@/lib/offline/queue";
import { cx } from "./ui";

export function LogoutButton({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <form
      action={logout}
      onSubmit={() => {
        clearQueue();
        navigator.serviceWorker?.controller?.postMessage("clear-pages");
      }}
    >
      <button className={cx("btn-ghost w-full text-muted", className)}>{t("auth.logout")}</button>
    </form>
  );
}
