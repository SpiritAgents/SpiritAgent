"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { getLocalePath, type AppLocale } from "@/i18n/config";
import { messagesByLocale, type Messages } from "@/i18n/messages";

type LocaleContextValue = {
  locale: AppLocale;
  messages: Messages;
  localizedPath: (suffix?: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ locale, children }: { locale: AppLocale; children: ReactNode }) {
  const messages = messagesByLocale[locale];
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      messages,
      localizedPath: (suffix = "") => getLocalePath(locale, suffix),
    }),
    [locale, messages],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useI18n must be used within LocaleProvider");
  }

  return context;
}
