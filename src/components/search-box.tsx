"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { searchAll } from "@/server/actions/search";
import { IconSearch } from "./icons";
import { cx } from "./ui";

type Hit = Awaited<ReturnType<typeof searchAll>>[number];

/** Suche mit Vorschlägen beim Tippen; Strg/⌘+K fokussiert */
export function SearchBox({ className }: { className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;
    let cancelled = false;
    const h = setTimeout(async () => {
      const r = await searchAll(q).catch(() => []);
      if (!cancelled) {
        setHits(r);
        setActive(0);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(h);
    };
  }, [q]);

  const shown = q.trim().length >= 2 ? hits : [];
  const label: Record<string, string> = { task: t("nav.tasks"), member: t("nav.employees"), client: t("nav.clientsNav"), request: t("nav.requests") };
  const go = (h: Hit) => {
    setOpen(false);
    setQ("");
    router.push(h.href);
  };
  return (
    <div className={cx("relative", className)}>
      <label className="flex min-h-11 items-center gap-2 rounded-[14px] bg-surface px-3 text-muted">
        <IconSearch className="size-[18px]" />
        <span className="sr-only">{t("search.label")}</span>
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={open && shown.length > 0}
          aria-controls="search-results"
          placeholder={t("search.placeholder")}
          className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter" && shown[active]) { e.preventDefault(); go(shown[active]!); }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        <kbd className="hidden rounded-[6px] border border-surface-3 px-1.5 text-xs lg:inline">Ctrl K</kbd>
      </label>
      {open && shown.length > 0 && (
        <ul id="search-results" role="listbox" className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-[14px] bg-card shadow-2xl shadow-black/40">
          {shown.map((h, i) => (
            <li key={`${h.kind}-${h.id}`} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go(h)} className={cx("flex min-h-11 w-full items-center gap-3 px-3 text-left", i === active && "bg-surface-3")}>
                <span className="chip bg-surface text-muted">{label[h.kind]}</span>
                <span className="min-w-0 flex-1 truncate">{h.title}</span>
                <span className="truncate text-xs text-muted">{h.subtitle}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
