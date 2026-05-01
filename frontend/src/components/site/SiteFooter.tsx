"use client";

import Link from "next/link";
import { i18n, type Language } from "@/lib/i18n";

export function SiteFooter({ language }: { language: Language }) {
  const copy = i18n[language].site;

  return (
    <footer className="border-t border-white/8 bg-black/16">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-white/45 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold text-white">RentScout</div>
            <p className="mt-1">{copy.footerText}</p>
          </div>
          <nav className="flex flex-wrap gap-4">
            <Link className="hover:text-white" href="/">{copy.nav.home}</Link>
            <Link className="hover:text-white" href="/about">{copy.nav.about}</Link>
            <Link className="hover:text-white" href="/search">{copy.nav.search}</Link>
            <Link className="hover:text-white" href="/account">{copy.nav.account}</Link>
          </nav>
        </div>
        <div className="text-xs text-white/35">{copy.contactEmail}</div>
      </div>
    </footer>
  );
}
