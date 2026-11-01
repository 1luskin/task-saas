"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";

export function ArchiveSearch({ initial }: { initial: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initial);
  useEffect(() => {
    const h = setTimeout(() => {
      if (q !== initial) router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname);
    }, 300);
    return () => clearTimeout(h);
  }, [q, initial, pathname, router]);
  return <input type="search" className="input" placeholder={`${t("common.search")}: ${t("archive.placeholder")}`} value={q} onChange={(e) => setQ(e.target.value)} />;
}
