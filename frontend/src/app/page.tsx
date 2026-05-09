"use client";

import { useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { useLanguagePreference } from "@/lib/useLanguagePreference";
import { CinematicLanding } from "@/components/landing/CinematicLanding";

type AuthMode = "login" | "register";

export default function HomePage() {
  const auth = useAuth();
  const { language, changeLanguage } = useLanguagePreference();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<AuthMode>("register");

  function openAuth(mode: AuthMode) {
    setModalMode(mode);
    setModalOpen(true);
  }

  function closeAuth() {
    setModalOpen(false);
  }

  function handleAuthenticated() {
    window.location.assign("/search");
  }

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />

      <CinematicLanding
        language={language}
        onHeroPrimary={
          !auth.isAuthenticated
            ? () => openAuth("register")
            : () => window.location.assign("/search")
        }
      />

      <SiteFooter language={language} />

      <AuthModal
        open={modalOpen}
        initialMode={modalMode}
        language={language}
        onClose={closeAuth}
        onAuthenticated={handleAuthenticated}
      />
    </div>
  );
}
