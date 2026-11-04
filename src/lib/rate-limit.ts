import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { isDemo } from "@/lib/demo/mode";

/** Grenzwerte (Treffer pro Fenster in Sekunden) */
export const LIMITS = {
  otpEmail: { max: 5, window: 3600 },
  otpIp: { max: 20, window: 3600 },
  otpVerify: { max: 5, window: 900 }, // 5 Versuche, dann 15 min Pause
  sync: { max: 120, window: 60 },
  upload: { max: 60, window: 3600 },
  publicLink: { max: 60, window: 600 },
  publicForm: { max: 5, window: 3600 },
} as const;
export type LimitName = keyof typeof LIMITS;

const memory = new Map<string, { start: number; hits: number }>();

/** Gehashte Client-IP (keine Klartext-IP in Logs/DB) */
export async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  return createHash("sha256").update(`${ip}|${process.env.CRON_SECRET ?? "salt"}`).digest("hex").slice(0, 24);
}

/** true = erlaubt. Zählt den Treffer. Postgres (serverless-tauglich), im Demo-Modus Speicher. */
export async function hit(name: LimitName, key: string): Promise<boolean> {
  const { max, window } = LIMITS[name];
  const bucket = `${name}:${key}`.slice(0, 200);
  if (isDemo()) {
    const now = Date.now();
    const start = Math.floor(now / (window * 1000)) * window * 1000;
    const cur = memory.get(bucket);
    const rec = cur && cur.start === start ? cur : { start, hits: 0 };
    rec.hits++;
    memory.set(bucket, rec);
    return rec.hits <= max;
  }
  const { data, error } = await createAdminClient().rpc("rate_limit_hit", { p_bucket: bucket, p_max: max, p_window_seconds: window });
  if (error) {
    console.error("[rate-limit]", error.message);
    return true; // im Zweifel nicht aussperren
  }
  return data === true;
}
