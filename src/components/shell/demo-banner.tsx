import Link from "next/link";
import { isDemo } from "@/lib/demo/mode";
import { getI18n } from "@/i18n/server";

export async function DemoBanner() {
  if (!isDemo()) return null;
  const { t } = await getI18n();
  return (
    <div className="flex items-center justify-between gap-2 bg-accent px-4 py-1.5 text-sm text-white">
      <span>{t("demo.banner")}</span>
      <Link href="/login" className="font-medium underline underline-offset-2">{t("demo.switchRole")}</Link>
    </div>
  );
}
