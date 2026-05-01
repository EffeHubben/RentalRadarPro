"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AccountButton } from "@/components/auth/AccountButton";
import { LanguageToggle } from "@/components/dashboard/LanguageToggle";
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
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#070a10]/88 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-sm font-semibold text-brass">
            RS
          </span>
          <span className="text-sm font-semibold tracking-wide text-white">RentScout</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-white/[0.07] text-white"
                    : "text-white/55 hover:bg-white/[0.045] hover:text-white"
                }`}
              >
                {copy.nav[item.key]}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageToggle language={language} onChange={onLanguageChange} />
          <AccountButton language={language} />
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.045] text-white/70 md:hidden"
          aria-label="Toggle navigation"
        >
          <span className="text-lg leading-none">{mobileOpen ? "x" : "="}</span>
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-white/8 bg-[#070a10] px-4 py-4 md:hidden">
          <nav className="grid gap-1" aria-label="Mobile primary">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/[0.045] hover:text-white"
              >
                {copy.nav[item.key]}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
            <LanguageToggle language={language} onChange={onLanguageChange} />
            <AccountButton language={language} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
