"use client";

import headerIcon from "@/app/icon.png";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AccountButton } from "@/components/auth/AccountButton";
import { LanguageToggle } from "@/components/dashboard/LanguageToggle";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { i18n, type Language } from "@/lib/i18n";

const navItems = [
  { href: "/", key: "home" },
  { href: "/about", key: "about" },
  { href: "/search", key: "search" },
  { href: "/account", key: "account" },
] as const;

export function SiteHeader({
  language,
  onLanguageChange,
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const copy = i18n[language].site;

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-header)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 py-2" aria-label="RentScout home">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_1px_1px_rgba(50,42,31,0.03)]">
            <Image
              src={headerIcon}
              alt=""
              width={28}
              height={28}
              sizes="40px"
              className="h-7 w-7 object-contain"
              priority
            />
          </span>
          <span className="hidden whitespace-nowrap text-sm font-semibold tracking-[0.08em] text-[var(--color-text)] sm:inline">
            RentScout
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label={copy.primaryNavigation}>
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--color-soft)] text-[var(--color-text)]"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-text)]"
                }`}
              >
                {copy.nav[item.key]}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageToggle language={language} onChange={onLanguageChange} />
          <ThemeToggle language={language} />
          <AccountButton language={language} />
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] md:hidden"
          aria-label={copy.toggleNavigation}
        >
          <span className="text-lg leading-none">{mobileOpen ? "x" : "="}</span>
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-page)] px-4 py-4 md:hidden">
          <nav className="grid gap-1" aria-label={copy.mobileNavigation}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-text)]"
              >
                {copy.nav[item.key]}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
            <LanguageToggle language={language} onChange={onLanguageChange} />
            <ThemeToggle language={language} />
            <AccountButton language={language} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
