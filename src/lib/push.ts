import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";
import { serverEnv } from "./env";
import { createT, dictionaries } from "@/i18n/config";
import type { Locale } from "@/lib/supabase/types";

let configured = false;
function configure(): boolean {
  const env = serverEnv();
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/** Push an Mitglieder senden. Inhalt wird pro Mitglied in dessen Sprache gebaut. */
export async function sendPushToMembers(
  memberIds: string[],
  build: (t: ReturnType<typeof createT>, locale: Locale) => PushPayload,
): Promise<void> {
  if (!memberIds.length || !configure()) return;
  const admin = createAdminClient();
  const [{ data: subs }, { data: members }] = await Promise.all([
    admin.from("push_subscriptions").select("*").in("member_id", memberIds),
    admin.from("members").select("id, locale").in("id", memberIds),
  ]);
  if (!subs?.length) return;
  const localeOf = new Map((members ?? []).map((m) => [m.id, m.locale]));

  await Promise.all(
    subs.map(async (s) => {
      const locale = localeOf.get(s.member_id) ?? "de";
      const payload = build(createT(dictionaries[locale]), locale);
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 },
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("[push]", status, (err as Error).message);
        }
      }
    }),
  );
}

/** Fehler beim Push dürfen die eigentliche Aktion nie scheitern lassen. */
export function firePush(p: Promise<void>) {
  p.catch((e) => console.error("[push]", e));
}
