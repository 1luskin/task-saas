import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, createT, dictionaries, isLocale, type AppLocale } from "./config";

export async function getLocale(): Promise<AppLocale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const accept = (await headers()).get("accept-language") ?? "";
  if (/^ru|,\s*ru/i.test(accept)) return "ru";
  return DEFAULT_LOCALE;
}

export async function getI18n() {
  const locale = await getLocale();
  const messages = dictionaries[locale];
  return { locale, messages, t: createT(messages) };
}
