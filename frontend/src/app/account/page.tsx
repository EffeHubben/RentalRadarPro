"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { i18n } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

type AuthMode = "login" | "register";

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.22 }}
      transition={{ duration: 0.42, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function AccountPage() {
  const auth = useAuth();
  const { language, changeLanguage } = useLanguagePreference();
  const copy = i18n[language].accountPage;
  const authCopy = i18n[language].auth;
  const [modalMode, setModalMode] = useState<AuthMode>("login");
  const [modalOpen, setModalOpen] = useState(false);

  const accountItems = [
    copy.savedSearches,
    copy.listingProgress,
    copy.preferences,
  ];

  function openAuth(mode: AuthMode) {
    setModalMode(mode);
    setModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />

      <main>
        <section className="relative overflow-hidden border-b border-[var(--color-border)]">
          <div className="animate-warm-drift absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_72%_18%,var(--color-hero-glow),transparent_34rem)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-20">
            <div className="max-w-3xl self-center">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-strong)]"
              >
                RentScout
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.05 }}
                className="mt-6 text-4xl font-semibold leading-[1.06] text-[var(--color-text)] sm:text-5xl lg:text-6xl"
              >
                {copy.title}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1 }}
                className="mt-6 max-w-2xl text-base leading-7 text-[var(--color-muted)] sm:text-lg"
              >
                {copy.subtitle}
              </motion.p>
            </div>

            <Reveal>
              <section className="rs-card rounded-[1.5rem] p-5">
                {!auth.isAuthenticated ? (
                  <div className="rounded-[1.1rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-2xl font-semibold text-[var(--color-text)]">
                          {copy.signedOutTitle}
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
                          {copy.signedOutBody}
                        </p>
                      </div>
                      <span className="rs-chip rounded-full px-3 py-1 text-xs font-semibold">
                        {authCopy.guestMode}
                      </span>
                    </div>
                    <div className="mt-7 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => openAuth("login")}
                        className="rs-primary-button h-11 rounded-lg px-5 text-sm font-semibold"
                      >
                        {copy.signIn}
                      </button>
                      <button
                        type="button"
                        onClick={() => openAuth("register")}
                        className="rs-control h-11 rounded-lg px-5 text-sm font-semibold"
                      >
                        {copy.createAccount}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                    <div className="rounded-[1.1rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="text-xl font-semibold text-[var(--color-text)]">
                            {copy.signedInTitle}
                          </h2>
                          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                            {copy.guestExplanation}
                          </p>
                        </div>
                        <span className="rs-chip-positive rounded-full px-3 py-1 text-xs font-semibold">
                          {copy.signedInBadge}
                        </span>
                      </div>

                      <div className="mt-6 grid gap-3 text-sm">
                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-page)] p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                            {copy.email}
                          </div>
                          <div className="mt-2 font-semibold text-[var(--color-text)]">
                            {auth.user?.email}
                          </div>
                        </div>
                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-page)] p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                            {copy.name}
                          </div>
                          <div className="mt-2 font-semibold text-[var(--color-text)]">
                            {auth.user?.display_name || authCopy.guestMode}
                          </div>
                        </div>
                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-page)] p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                            {copy.plan}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="font-semibold text-[var(--color-text)]">
                              {auth.user?.plan === "pro" ? copy.planPro : copy.planFree}
                            </span>
                            {auth.user?.plan === "pro" ? (
                              <span className="rounded-full bg-[var(--color-teal-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-teal)]">
                                {copy.planPro}
                              </span>
                            ) : (
                              <span className="rs-chip rounded-full px-2.5 py-0.5 text-xs font-medium">
                                {copy.planFree}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void auth.logout()}
                        className="rs-control mt-6 h-10 rounded-lg px-4 text-sm font-semibold"
                      >
                        {authCopy.logout}
                      </button>
                    </div>

                    <div className="rounded-[1.1rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                      <div className="text-sm font-semibold text-[var(--color-text)]">
                        {copy.workspace}
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        {accountItems.map((item, index) => (
                          <motion.div
                            key={item}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.28, delay: index * 0.06 }}
                            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-page)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-soft)]"
                          >
                            <div className="mb-4 h-1.5 w-10 rounded-full bg-[var(--color-accent)]" />
                            <div className="text-sm font-semibold text-[var(--color-text)]">{item}</div>
                            <div className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
                              {copy.placeholder}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                      {auth.user?.plan !== "pro" ? (
                        <div className="mt-4 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-elevated)] p-4 shadow-[var(--shadow-premium)]">
                          <div className="text-sm font-semibold text-[var(--color-text)]">
                            {copy.upgradeTitle}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
                            {copy.upgradeBody}
                          </p>
                          <ul className="mt-3 space-y-1.5">
                            {copy.proFeatures.map((feat) => (
                              <li key={feat} className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                                <span className="shrink-0 text-[var(--color-teal)]">✓</span>
                                {feat}
                              </li>
                            ))}
                          </ul>
                          <button
                            type="button"
                            disabled
                            className="mt-4 inline-flex h-9 w-full cursor-not-allowed items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-xs font-semibold text-[var(--color-subtle)]"
                          >
                            {copy.upgradeComingSoon}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>
            </Reveal>
          </div>
        </section>

        {!auth.isAuthenticated ? (
          <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="grid gap-4 md:grid-cols-3">
              {accountItems.map((item, index) => (
                <Reveal key={item} delay={index * 0.06}>
                  <article className="rs-card-solid h-full rounded-2xl p-5">
                    <div className="mb-4 h-2 w-12 rounded-full bg-[var(--color-accent)]" />
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">{item}</h2>
                    <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                      {copy.placeholder}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <SiteFooter language={language} />
      <AuthModal
        open={modalOpen}
        initialMode={modalMode}
        language={language}
        onClose={() => setModalOpen(false)}
        onAuthenticated={() => undefined}
      />
    </div>
  );
}
