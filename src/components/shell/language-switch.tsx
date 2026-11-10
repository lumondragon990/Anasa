"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/dictionaries";
import { useLocale, useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** EN / ES switch. The choice is kept in a cookie on this device for a year. */
export function LanguageSwitch({ tone = "rail" }: { tone?: "rail" | "page" }) {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    start(() => router.refresh());
  }

  const base = tone === "rail" ? "text-rail-muted hover:text-rail-fg" : "text-muted hover:text-fg";
  const on = tone === "rail" ? "bg-rail-active text-rail-fg" : "bg-surface-2 text-fg";

  return (
    <div role="group" aria-label={t.common.language} className={cn("inline-flex rounded-[var(--radius-control)] p-0.5 text-xs font-medium", pending && "opacity-60")}>
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={locale === l}
          lang={l}
          title={l === "en" ? "English" : "Español"}
          className={cn("h-7 w-8 rounded-[4px] uppercase transition-colors", locale === l ? on : base)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
