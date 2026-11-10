"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import { NAV } from "./nav";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { LanguageSwitch } from "./language-switch";

export function Sidebar({
  userName,
  roleLabel,
  isAdmin,
  signOut,
}: {
  userName: string;
  roleLabel: string;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);

  const ready = NAV.filter((n) => n.ready && (!n.adminOnly || isAdmin));
  const upcoming = NAV.filter((n) => !n.ready).sort((a, b) => a.phase - b.phase);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.split("/").slice(0, 2).join("/")));

  const nav = (
    <nav aria-label={t.nav.mainNav} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
      <ul className="flex flex-col gap-0.5">
        {ready.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm text-rail-muted transition-colors hover:bg-rail-active hover:text-rail-fg",
                isActive(item.href) && "bg-rail-active text-rail-fg shadow-[inset_2px_0_0_var(--accent)]",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {t.nav[item.label]}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-rail-line pt-4">
        <button
          type="button"
          onClick={() => setShowUpcoming((v) => !v)}
          aria-expanded={showUpcoming}
          className="flex w-full items-center justify-between px-3 text-xs text-rail-muted hover:text-rail-fg"
        >
          {t.nav.roadmap}
          <ChevronDown className={cn("size-3.5 transition-transform", showUpcoming && "rotate-180")} />
        </button>
        {showUpcoming ? (
          <ul className="mt-2 flex flex-col">
            {upcoming.map((item) => (
              <li
                key={item.href}
                className="flex h-8 items-center gap-3 px-3 text-sm text-rail-muted/70"
                title={t.nav.arrivesInPhase(item.phase)}
              >
                <item.icon className="size-4 shrink-0 opacity-60" />
                <span className="flex-1 truncate">{t.nav[item.label]}</span>
                <span className="text-[11px] tabular-nums">P{item.phase}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-rail-line bg-rail px-4 text-rail-fg lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] hover:bg-rail-active"
          aria-label={t.nav.openMenu}
        >
          <Menu className="size-5" />
        </button>
      </div>

      {open ? <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden /> : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-rail text-rail-fg transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-rail-line px-5">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] hover:bg-rail-active lg:hidden"
            aria-label={t.nav.closeMenu}
          >
            <X className="size-4" />
          </button>
        </div>
        {nav}
        <div className="border-t border-rail-line px-3 py-3">
          <div className="min-w-0 px-2">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-rail-muted">{roleLabel}</p>
          </div>
          <div className="mt-2 flex items-center gap-1">
          <LanguageSwitch />
          <span className="flex-1" />
          <ThemeToggle />
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-rail-muted hover:bg-rail-active hover:text-rail-fg"
              aria-label={t.common.signOut}
            >
              <LogOut className="size-4" />
            </button>
          </form>
          </div>
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-baseline gap-2">
      <span className="text-[17px] font-semibold tracking-[0.08em]">ANASA</span>
      <span className="text-xs text-rail-muted">Command Center</span>
    </Link>
  );
}
