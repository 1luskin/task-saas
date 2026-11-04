import { APP_NAME } from "@/config/app";

export const dynamic = "force-static";

/** Wird vom Service Worker per importScripts geladen → Name nur in src/config/app.ts */
export function GET() {
  return new Response(`self.__APP_NAME = ${JSON.stringify(APP_NAME)};\n`, {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
