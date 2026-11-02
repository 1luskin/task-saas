import "server-only";
import { z } from "zod";
import { isDemo } from "./demo/mode";

/** Serverseitige Umgebungsvariablen – werden erst beim Zugriff geprüft. */
const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:admin@example.de"),
  CRON_SECRET: z.string().optional(),
});

let cached: z.infer<typeof serverSchema> | null = null;

export function serverEnv() {
  if (!cached) {
    // Demo-Modus: Platzhalter statt echter Schlüssel (werden nie benutzt)
    const src = isDemo()
      ? {
          NEXT_PUBLIC_SUPABASE_URL: "http://demo.invalid",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "demo-anon-key",
          SUPABASE_SERVICE_ROLE_KEY: "demo-service-key",
          ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v)),
        }
      : process.env;
    cached = serverSchema.parse(src);
  }
  return cached;
}
