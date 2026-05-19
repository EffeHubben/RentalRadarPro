"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const CONSENT_KEY = "cookie_consent";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

type Consent = "accepted" | "declined" | null;

export function CookieBanner() {
  const [consent, setConsent] = useState<Consent>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY) as Consent;
    if (stored) {
      setConsent(stored);
    } else {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setConsent("accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setConsent("declined");
    setVisible(false);
  };

  return (
    <>
      {consent === "accepted" && GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}</Script>
        </>
      )}

      {visible && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop — blocks interaction with the page */}
          <div className="absolute inset-0 rs-modal-backdrop" aria-hidden="true" />

          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-premium)]">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              Cookies
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              We gebruiken Google Analytics om te begrijpen hoe bezoekers RentScout gebruiken. Er worden geen persoonlijke gegevens gedeeld.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={accept}
                className="flex-1 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Accepteren
              </button>
              <button
                onClick={decline}
                className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-2 text-sm font-semibold text-[var(--color-muted)] transition-opacity hover:opacity-80"
              >
                Alleen noodzakelijk
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
