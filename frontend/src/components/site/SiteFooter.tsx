"use client";

import Link from "next/link";
import { i18n, type Language } from "@/lib/i18n";

export function SiteFooter({ language }: { language: Language }) {
  const copy = i18n[language].site;

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-footer)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 text-sm text-[var(--color-muted)] sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="font-semibold text-[var(--color-text)]">RentScout</div>
            <p className="mt-2 max-w-md leading-6">{copy.footerText}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <nav className="flex flex-wrap gap-x-4 gap-y-2">
              <Link className="hover:text-[var(--color-text)]" href="/search">{copy.nav.search}</Link>
              <Link className="hover:text-[var(--color-text)]" href="/account">{copy.nav.account}</Link>
              <Link className="hover:text-[var(--color-text)]" href="/contact">{copy.nav.contact}</Link>
            </nav>
            <nav className="flex flex-wrap gap-x-4 gap-y-2">
              <Link className="hover:text-[var(--color-text)]" href="/pricing">{copy.nav.pricing}</Link>
              <Link className="hover:text-[var(--color-text)]" href="/privacy">{copy.nav.privacy}</Link>
              <Link className="hover:text-[var(--color-text)]" href="/terms">{copy.nav.terms}</Link>
              <Link className="hover:text-[var(--color-text)]" href="/refund-policy">{copy.nav.refundPolicy}</Link>
              <Link className="hover:text-[var(--color-text)]" href="/about">{copy.nav.about}</Link>
            </nav>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-4 text-xs text-[var(--color-subtle)] sm:flex-row sm:items-center sm:justify-between">
          <div>{copy.contactEmail}</div>
          <div>RentScout</div>
        </div>
      </div>
    </footer>
  );
}
