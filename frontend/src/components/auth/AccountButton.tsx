"use client";

import { useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { i18n, type Language } from "@/lib/i18n";

export function AccountButton({ language }: { language: Language }) {
  const auth = useAuth();
  const copy = i18n[language].auth;
  const [modalOpen, setModalOpen] = useState(false);

  async function handleLogout() {
    await auth.logout();
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {!auth.isAuthenticated ? (
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)]">
            {copy.guestMode}
          </span>
        ) : null}

        {auth.isAuthenticated ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--color-teal)]/25 bg-[var(--color-teal-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-teal)]">
              {auth.user?.display_name || auth.user?.email}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
            >
              {copy.logout}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rs-primary-button rounded-full px-4 py-2 text-sm font-semibold"
          >
            {copy.login}
          </button>
        )}
      </div>

      <AuthModal
        open={modalOpen}
        initialMode="login"
        language={language}
        onClose={() => setModalOpen(false)}
        onAuthenticated={() => undefined}
      />
    </div>
  );
}
