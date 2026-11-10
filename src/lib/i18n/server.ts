import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, dictionaries, isLocale, type Locale } from "./dictionaries";

/** The viewer's language, from the cookie set by the language switch. */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

/** Dictionary for Server Components. */
export async function getT() {
  const locale = await getLocale();
  return { t: dictionaries[locale], locale };
}
