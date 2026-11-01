import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./types";
import { serverEnv } from "@/lib/env";

/** Supabase-Client im Namen des eingeloggten Nutzers (RLS greift). */
export async function createClient() {
  const cookieStore = await cookies();
  const env = serverEnv();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // In Server Components nicht setzbar – der Proxy erneuert die Session.
        }
      },
    },
  });
}

/**
 * Service-Role-Client: umgeht RLS. NUR für Cron, Push-Versand und
 * signierte Foto-URLs nach vorheriger Berechtigungsprüfung verwenden.
 */
export function createAdminClient() {
  const env = serverEnv();
  return createPlainClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
