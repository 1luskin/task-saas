/**
 * Demo-Modus: aktiv, wenn keine Supabase-URL gesetzt ist oder NEXT_PUBLIC_DEMO_MODE=1.
 * Dann arbeitet die App mit Testdaten im Arbeitsspeicher (siehe fake-client.ts).
 */
export function isDemo(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "1" || !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export const DEMO_COOKIE = "demo_uid";
