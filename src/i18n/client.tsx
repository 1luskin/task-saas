"use client";
import { createContext, useContext, useMemo } from "react";
import { createT, dictionaries, type AppLocale, type TFunction } from "./config";
import type { Messages } from "./messages/de";

const Ctx = createContext<{ locale: AppLocale; messages: Messages; t: TFunction } | null>(null);

export function I18nProvider({ locale, children }: { locale: AppLocale; children: React.ReactNode }) {
  const value = useMemo(() => {
    const messages = dictionaries[locale];
    return { locale, messages, t: createT(messages) };
  }, [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("I18nProvider fehlt");
  return v;
}
