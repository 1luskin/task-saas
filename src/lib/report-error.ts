/**
 * Fehlerbericht an Sentry (EU-Region per DSN, z. B. https://key@o1.ingest.de.sentry.io/2).
 * Ohne SENTRY_DSN aus. Keine personenbezogenen Daten: keine Header, Cookies, Bodies,
 * E-Mail-Adressen und UUIDs werden aus Texten entfernt.
 */
export function scrub(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[id]")
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, "[ip]")
    .slice(0, 2000);
}

export async function reportError(err: unknown, tags: Record<string, string> = {}) {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/\//g, "");
    const key = u.username;
    const eventId = crypto.randomUUID().replace(/-/g, "");
    const e = err instanceof Error ? err : new Error(String(err));
    const event = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: "javascript",
      level: "error",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      exception: { values: [{ type: e.name, value: scrub(e.message), stacktrace: { frames: scrub(e.stack ?? "").split("\n").slice(1, 20).map((l) => ({ function: l.trim() })) } }] },
      tags: Object.fromEntries(Object.entries(tags).map(([k, v]) => [k, scrub(v).slice(0, 200)])),
    };
    const body = `${JSON.stringify({ event_id: eventId, dsn })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}`;
    await fetch(`${u.protocol}//${u.host}/api/${project}/envelope/?sentry_key=${key}&sentry_version=7`, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
    });
  } catch {
    /* Fehlerbericht darf nie selbst fehlschlagen */
  }
}
