"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { i18n, type Language } from "@/lib/i18n";
import { listingWorkflowStorageKey } from "@/lib/listingWorkflow";
import { searchProfilesStorageKey } from "@/lib/searchProfiles";

const localDataKeys = [
  listingWorkflowStorageKey,
  searchProfilesStorageKey,
  "rental-radar-onboarding-complete-v1",
  "rental-radar-scan-sources-v1",
];

function hasLocalData() {
  return localDataKeys.some((key) => {
    const value = window.localStorage.getItem(key);
    return value !== null && value !== "" && value !== "{}" && value !== "[]";
  });
}

export function AccountButton({ language }: { language: Language }) {
  const auth = useAuth();
  const copy = i18n[language].auth;
  const [modalOpen, setModalOpen] = useState(false);
  const [showLocalNotice, setShowLocalNotice] = useState(false);

  useEffect(() => {
    if (auth.isAuthenticated && hasLocalData()) {
      setShowLocalNotice(true);
    }
  }, [auth.isAuthenticated]);

  async function handleLogout() {
    await auth.logout();
    setShowLocalNotice(false);
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {!auth.isAuthenticated ? (
          <span className="rounded-full border border-white/10 bg-black/18 px-3 py-1.5 text-xs font-semibold text-white/42">
            {copy.guestMode}
          </span>
        ) : null}

        {auth.isAuthenticated ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-mint/25 bg-mint/10 px-3 py-1.5 text-xs font-semibold text-mint">
              {auth.user?.display_name || auth.user?.email}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-semibold text-white/62 transition hover:border-white/24 hover:text-white"
            >
              {copy.logout}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-full border border-brass/35 bg-brass/12 px-4 py-2 text-sm font-semibold text-brass transition hover:bg-brass hover:text-ink"
          >
            {copy.login}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showLocalNotice ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="max-w-sm rounded-xl border border-white/10 bg-black/24 px-3 py-2 text-xs leading-5 text-white/52"
          >
            {copy.localDataNotice}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AuthModal
        open={modalOpen}
        initialMode="login"
        language={language}
        onClose={() => setModalOpen(false)}
        onAuthenticated={() => setShowLocalNotice(hasLocalData())}
      />
    </div>
  );
}
