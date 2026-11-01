"use client";
/**
 * Offline-Warteschlange für Mitarbeiter-Aktionen (Status, Checkliste, Begonnen/Fertig).
 * Alle diese Aktionen laufen IMMER über die Queue → ein einziger Codepfad online & offline.
 * Persistenz: localStorage (synchron, überlebt Neustart der App).
 */
import { useSyncExternalStore } from "react";

export type QueuedOp =
  | { id: string; op: "status"; taskId: string; status: "new" | "in_progress" | "done"; at: string }
  | { id: string; op: "checklist"; itemId: string; taskId: string; done: boolean; at: string }
  | { id: string; op: "start"; taskId: string; entryId: string; at: string }
  | { id: string; op: "finish"; taskId: string; at: string };

type NewOp = QueuedOp extends infer O ? (O extends QueuedOp ? Omit<O, "id" | "at"> : never) : never;

const KEY = "werkplan.queue.v1";
const listeners = new Set<() => void>();
let snapshot: QueuedOp[] | null = null;
let flushing = false;
let onSynced: (() => void) | null = null;

function read(): QueuedOp[] {
  if (snapshot) return snapshot;
  try {
    snapshot = JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedOp[];
  } catch {
    snapshot = [];
  }
  return snapshot;
}

function write(ops: QueuedOp[]) {
  snapshot = ops;
  try {
    localStorage.setItem(KEY, JSON.stringify(ops));
  } catch {
    /* Speicher voll / privat – Ops bleiben im RAM */
  }
  listeners.forEach((l) => l());
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function enqueue(op: NewOp) {
  const full = { ...op, id: uuid(), at: new Date().toISOString() } as QueuedOp;
  write([...read(), full]);
  void flush();
  return full;
}

export async function flush(): Promise<void> {
  if (flushing || typeof navigator === "undefined" || !navigator.onLine) return;
  const ops = read();
  if (!ops.length) return;
  flushing = true;
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ops: ops.map(({ ...o }) => o) }),
    });
    if (!res.ok) return;
    const { results } = (await res.json()) as { results: { id: string; ok: boolean; error?: string }[] };
    const done = new Set(results.filter((r) => r.ok || r.error === "rejected").map((r) => r.id));
    write(read().filter((o) => !done.has(o.id)));
    if (done.size) onSynced?.();
  } catch {
    /* offline – später erneut */
  } finally {
    flushing = false;
  }
}

/** Startet Sync bei Netzrückkehr, Sichtbarkeit und alle 30 s. */
export function startSyncLoop(): () => void {
  const tick = () => void flush();
  window.addEventListener("online", tick);
  document.addEventListener("visibilitychange", tick);
  const iv = window.setInterval(tick, 30_000);
  tick();
  return () => {
    window.removeEventListener("online", tick);
    document.removeEventListener("visibilitychange", tick);
    window.clearInterval(iv);
  };
}

export function setOnSynced(fn: (() => void) | null) {
  onSynced = fn;
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      snapshot = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: QueuedOp[] = [];
export function useQueue(): QueuedOp[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function clearQueue() {
  write([]);
}

/** Offline-Zustand über Serverdaten legen (zuletzt gequeuter Wert gewinnt). */
export function overlayTask(
  task: { id: string; status: "new" | "in_progress" | "done" },
  queue: QueuedOp[],
  serverRunningSince: string | null = null,
): { status: "new" | "in_progress" | "done"; running: string | null; extraMinutes: number; checklist: Map<string, boolean> } {
  let status = task.status;
  let running = serverRunningSince;
  let extraMinutes = 0;
  const checklist = new Map<string, boolean>();
  const stop = (at: string) => {
    if (running) extraMinutes += Math.max(0, (new Date(at).getTime() - new Date(running).getTime()) / 60000);
    running = null;
  };
  for (const o of queue) {
    if (o.taskId !== task.id) continue;
    if (o.op === "status") {
      status = o.status;
      if (o.status !== "in_progress") stop(o.at);
    } else if (o.op === "start") {
      status = "in_progress";
      if (!running) running = o.at;
    } else if (o.op === "finish") {
      status = "done";
      stop(o.at);
    } else if (o.op === "checklist") {
      checklist.set(o.itemId, o.done);
    }
  }
  return { status, running, extraMinutes, checklist };
}
