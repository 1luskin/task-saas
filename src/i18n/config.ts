import de, { type Messages } from "./messages/de";
import ru from "./messages/ru";

/** Neue Sprache: Datei in messages/ anlegen und hier eintragen. */
export const LOCALES = ["de", "ru"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "de";
export const LOCALE_COOKIE = "locale";
export const LOCALE_LABELS: Record<AppLocale, string> = { de: "Deutsch", ru: "Русский" };

export const dictionaries: Record<AppLocale, Messages> = { de, ru };

export function isLocale(v: unknown): v is AppLocale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends readonly string[]
      ? never
      : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type Vars = Record<string, string | number>;
export type TFunction = (key: MessageKey, vars?: Vars) => string;

export function createT(messages: Messages): TFunction {
  return (key, vars) => {
    let cur: unknown = messages;
    for (const part of key.split(".")) {
      cur = (cur as Record<string, unknown> | undefined)?.[part];
    }
    let s = typeof cur === "string" ? cur : key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}
