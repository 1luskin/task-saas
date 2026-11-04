"use client";
/**
 * Offline-Dateien (Fotos, Belege) in IndexedDB – localStorage ist für Binärdaten ungeeignet.
 * Wird beim Wieder-Online-Gehen hochgeladen und registriert; idempotent über die Eintrags-ID.
 */
import { createClient } from "@/lib/supabase/client";
import { registerPhoto } from "@/server/actions/tasks";
import { createExpense } from "@/server/actions/money";

export type OfflineFile =
  | { id: string; kind: "photo"; taskId: string; firmId: string; blob: Blob; photoKind: "general" | "before" | "after"; createdAt: string }
  | { id: string; kind: "expense"; taskId: string; firmId: string; blob: Blob | null; ext: "jpg" | "pdf" | null; amount: string; description: string; reimburse: boolean; createdAt: string };

const DB = "app-offline";
const STORE = "files";
const listeners = new Set<() => void>();

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function putOfflineFile(item: OfflineFile) {
  await tx("readwrite", (s) => s.put(item));
  listeners.forEach((l) => l());
}
export async function listOfflineFiles(): Promise<OfflineFile[]> {
  if (typeof indexedDB === "undefined") return [];
  return (await tx("readonly", (s) => s.getAll())) as OfflineFile[];
}
async function removeOfflineFile(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  listeners.forEach((l) => l());
}
export function onOfflineFilesChange(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

let flushing = false;
/** Hochladen, sobald Netz da ist. Fehler → Eintrag bleibt für den nächsten Versuch. */
export async function flushOfflineFiles(): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let done = 0;
  try {
    const supabase = createClient();
    for (const item of await listOfflineFiles()) {
      try {
        if (item.kind === "photo") {
          const path = `${item.firmId}/${item.taskId}/${item.id}.jpg`;
          const up = await supabase.storage.from("task-photos").upload(path, item.blob, { contentType: "image/jpeg", upsert: true });
          if (up.error) throw up.error;
          const r = await registerPhoto(item.taskId, path, item.photoKind);
          if (!r.ok && r.error !== "error") { await removeOfflineFile(item.id); continue; } // fachlich abgelehnt → verwerfen
          if (!r.ok) throw new Error(r.error);
        } else {
          let receiptPath: string | null = null;
          if (item.blob && item.ext) {
            receiptPath = `${item.firmId}/${item.taskId}/${item.id}.${item.ext}`;
            const up = await supabase.storage.from("receipts").upload(receiptPath, item.blob, { contentType: item.ext === "pdf" ? "application/pdf" : "image/jpeg", upsert: true });
            if (up.error) throw up.error;
          }
          const r = await createExpense({ taskId: item.taskId, amount: item.amount, description: item.description, reimburse: item.reimburse, receiptPath });
          if (!r.ok && r.error === "error") throw new Error(r.error);
        }
        await removeOfflineFile(item.id);
        done++;
      } catch {
        /* später erneut */
      }
    }
  } finally {
    flushing = false;
  }
  return done;
}
