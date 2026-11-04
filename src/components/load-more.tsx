import Link from "next/link";
import { getI18n } from "@/i18n/server";

/** "Mehr laden": erhöht den Limit-Parameter (Server-Rendering, kein Nachladen aller Daten) */
export async function LoadMore({ shown, limit, href }: { shown: number; limit: number; href: (nextLimit: number) => string }) {
  if (shown < limit) return null;
  const { t } = await getI18n();
  return (
    <div className="flex justify-center pt-2">
      <Link href={href(limit + 50)} scroll={false} className="btn-secondary">{t("common.loadMore")}</Link>
    </div>
  );
}

export function parseLimit(v: string | undefined, def = 50, max = 1000): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : def;
}
