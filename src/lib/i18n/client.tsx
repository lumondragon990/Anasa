"use client";

import { createContext, useContext } from "react";
import { dictionaries, type Locale } from "./dictionaries";
import { translateMessage } from "./messages";

const LocaleContext = createContext<Locale>("en");

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

/** Dictionary for Client Components. */
export function useT() {
  return dictionaries[useContext(LocaleContext)];
}

/** Translates a message returned by the server, validation or the database. */
export function useTr() {
  const locale = useContext(LocaleContext);
  return (message: string | undefined | null) => translateMessage(message, locale);
}
