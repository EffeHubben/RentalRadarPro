"use client";

import { useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { i18n } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

type AuthMode = "login" | "register";

export default function AccountPage() {
  const auth = useAuth();
  const { language, changeLanguage } = useLanguagePreference();
  const copy = i18n[language].accountPage;
  const authCopy = i18n[language].auth;
  const [modalMode, setModalMode] = useState<AuthMode>("login");
  const [modalOpen, setModalOpen] = useState(false);

  function openAuth(mode: AuthMode) {
    setModalMode(mode);
    setModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-[#070a10] text-cream">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />
      <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">{copy.title}</h1>
          <p className="mt-5 text-lg leading-8 text-white/60">{copy.subtitle}</p>
        </section>

        {!auth.isAuthenticated ? (
          <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.035] p-6 shadow-premium">
            <h2 className="text-xl font-semibold text-white">{copy.signedOutTitle}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/58">{copy.signedOutBody}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openAuth("login")}
                className="h-11 rounded-lg bg-brass px-5 text-sm font-semibold text-ink transition hover:bg-[#e3bd6a]"
              >
                {copy.signIn}
              </button>
              <button
                type="button"
                onClick={() => openAuth("register")}
                className="h-11 rounded-lg border border-white/12 bg-white/[0.045] px-5 text-sm font-semibold text-white/72 transition hover:border-white/24 hover:text-white"
              >
                {copy.createAccount}
              </button>
            </div>
          </section>
        ) : (
          <section className="mt-10 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
              <h2 className="text-xl font-semibold text-white">{copy.signedInTitle}</h2>
              <div className="mt-5 space-y-3 text-sm">
                <div>
                  <div className="text-white/38">{copy.email}</div>
                  <div className="mt-1 font-medium text-white">{auth.user?.email}</div>
                </div>
                <div>
                  <div className="text-white/38">{copy.name}</div>
                  <div className="mt-1 font-medium text-white">
                    {auth.user?.display_name || authCopy.guestMode}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void auth.logout()}
                className="mt-6 h-10 rounded-lg border border-white/12 bg-white/[0.045] px-4 text-sm font-semibold text-white/70 transition hover:border-white/24 hover:text-white"
              >
                {authCopy.logout}
              </button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/18 p-6">
              <p className="text-sm leading-7 text-white/58">{copy.guestExplanation}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[copy.savedSearches, copy.listingProgress, copy.preferences].map((item) => (
                  <div key={item} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <div className="text-sm font-semibold text-white">{item}</div>
                    <div className="mt-2 text-xs leading-5 text-white/42">{copy.placeholder}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
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
