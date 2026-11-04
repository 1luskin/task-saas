"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { moveTaskToStatus } from "@/server/actions/views";
import { STATUS_COLORS } from "../settings/statuses-editor";
import type { StatusColor, TaskStatus } from "@/lib/supabase/types";
import { tap } from "@/lib/haptics";
import { Avatar, cx } from "../ui";

export interface KCol { id: string; name: string; color: StatusColor; kind: TaskStatus; is_system: boolean }
export interface KCard { id: string; title: string; column: string; assigneeName: string | null; urgent: boolean; overdue: boolean; due: string | null }

/** Kanban mit Drag & Drop für Maus und Finger (Pointer-Events, ohne Bibliothek) */
export function Kanban({ columns, cards: initial }: { columns: KCol[]; cards: KCard[] }) {
  const { t } = useI18n();
  const [cards, setCards] = useState(initial);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; dx: number; dy: number; moved: boolean } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean }>({ x: 0, y: 0, moved: false });
  const dragging = (id: string) => drag?.id === id && drag.moved;

  function colAt(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y)?.closest("[data-col]");
    return el?.getAttribute("data-col") ?? null;
  }

  async function drop(cardId: string, colId: string) {
    const prev = cards;
    setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, column: colId } : c)));
    tap();
    const r = await moveTaskToStatus(cardId, colId);
    if (!r.ok) setCards(prev);
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 lg:mx-0 lg:px-0">
      <p className="mb-3 text-sm text-muted">{t("views.dragHint")}</p>
      <div className="flex min-w-max gap-3">
        {columns.map((col) => {
          const list = cards.filter((c) => c.column === col.id);
          return (
            <section key={col.id} data-col={col.id} aria-label={col.name} className={cx("flex w-72 shrink-0 flex-col rounded-[18px] bg-surface p-2 transition", over === col.id && drag && "ring-2 ring-accent-2")}>
              <header className="flex items-center justify-between px-2 py-2">
                <span className={cx("chip", STATUS_COLORS[col.color])}>{col.name}</span>
                <span className="text-sm tabular-nums text-muted">{list.length}</span>
              </header>
              <ul className="flex min-h-24 flex-col gap-2">
                {list.map((c) => (
                  <li
                    key={c.id}
                    onPointerDown={(e) => {
                      if ((e.target as HTMLElement).closest("a") && e.pointerType === "mouse" && e.button !== 0) return;
                      start.current = { x: e.clientX, y: e.clientY, moved: false };
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      setDrag({ id: c.id, x: e.clientX, y: e.clientY, dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false });
                    }}
                    onPointerMove={(e) => {
                      if (!drag || drag.id !== c.id) return;
                      if (Math.abs(e.clientX - start.current.x) + Math.abs(e.clientY - start.current.y) > 6) start.current.moved = true;
                      setDrag({ ...drag, x: e.clientX, y: e.clientY, moved: start.current.moved });
                      setOver(colAt(e.clientX, e.clientY));
                    }}
                    onPointerUp={(e) => {
                      const target = start.current.moved ? colAt(e.clientX, e.clientY) : null;
                      setDrag(null);
                      setOver(null);
                      if (target && target !== c.column) void drop(c.id, target);
                    }}
                    onPointerCancel={() => { setDrag(null); setOver(null); }}
                    onClickCapture={(e) => { if (start.current.moved) e.preventDefault(); }}
                    style={dragging(c.id) && drag ? { position: "fixed", left: drag.x - drag.dx, top: drag.y - drag.dy, width: 272, zIndex: 50, pointerEvents: "none" } : undefined}
                    className={cx("touch-none select-none rounded-[14px] bg-card p-3 shadow-sm", dragging(c.id) && "rotate-1 shadow-2xl shadow-black/40", c.overdue && "ring-1 ring-danger/40")}
                  >
                    <Link href={`/boss/tasks/${c.id}`} className="block space-y-2" draggable={false}>
                      <div className="font-medium leading-snug">{c.title}</div>
                      <div className="flex items-center gap-2 text-sm text-muted">
                        {c.urgent && <span className="chip bg-danger-soft text-danger">{t("priority.urgent")}</span>}
                        {c.due && <span className={cx("tabular-nums", c.overdue && "text-danger")}>{c.due}</span>}
                        <span className="ml-auto"><Avatar name={c.assigneeName ?? "–"} className="size-7 text-[10px]" /></span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
