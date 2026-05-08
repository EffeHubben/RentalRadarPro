"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { verifyEmailToken } from "@/lib/auth";
import type { Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

const copy: Record<
  Language,
  {
    eyebrow: string;
    title: string;
    success: string;
    invalid: string;
    missing: string;
    loading: string;
    openSearch: string;
    account: string;
  }
> = {
  nl: {
    eyebrow: "E-mailverificatie",
    title: "Bevestig je e-mailadres",
    success: "Je e-mailadres is bevestigd. Je account blijft gewoon bruikbaar, maar staat nu klaar voor veiligere herstelacties.",
    invalid: "Deze verificatielink is ongeldig of verlopen.",
    missing: "Er ontbreekt een verificatietoken in deze link.",
    loading: "Verificatie wordt gecontroleerd...",
    openSearch: "Open zoeken",
    account: "Bekijk account",
  },
  en: {
    eyebrow: "Email verification",
    title: "Verify your email",
    success: "Your email address has been verified. Your account remains usable as before, and it is now prepared for safer recovery actions.",
    invalid: "This verification link is invalid or has expired.",
    missing: "This link is missing a verification token.",
    loading: "Checking verification link...",
    openSearch: "Open search",
    account: "View account",
  },
};

export default function VerifyEmailPage() {
  const { language, changeLanguage } = useLanguagePreference();
  const pageCopy = copy[language];
  const [status, setStatus] = useState<"loading" | "success" | "error" | "missing">("loading");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token"));
  }, []);

  useEffect(() => {
    if (token === null) {
      return;
    }

    if (!token) {
      setStatus("missing");
      return;
    }

    verifyEmailToken(token)
      .then(() => {
        setStatus("success");
      })
      .catch(() => {
        setStatus("error");
      });
  }, [token]);

  const message =
    status === "success"
      ? pageCopy.success
      : status === "error"
        ? pageCopy.invalid
        : status === "missing"
          ? pageCopy.missing
          : pageCopy.loading;

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="rs-card rounded-[1.75rem] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
            {pageCopy.eyebrow}
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-[var(--color-text)] sm:text-4xl">
            {pageCopy.title}
          </h1>
          <div
            className={`mt-6 rounded-[1.25rem] border px-5 py-5 text-sm leading-7 ${
              status === "success"
                ? "border-emerald-500/25 bg-emerald-500/10 text-[var(--color-text)]"
                : status === "error"
                  ? "border-danger/25 bg-danger/10 text-[var(--color-text)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)]"
            }`}
          >
            {message}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/search"
              className="rs-primary-button inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
            >
              {pageCopy.openSearch}
            </Link>
            <Link
              href="/account"
              className="rs-control inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
            >
              {pageCopy.account}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter language={language} />
    </div>
  );
}
