import { getI18n } from "@/i18n/server";

export const dynamic = "force-static";

export default async function OfflinePage() {
  const { t } = await getI18n();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <img src="/icons/icon.svg" alt="" className="size-16 rounded-2xl" />
      <h1 className="text-xl font-semibold">{t("offline.title")}</h1>
      <p className="text-muted">{t("offline.text")}</p>
    </main>
  );
}
