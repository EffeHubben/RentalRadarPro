"use client";

import { useEffect, useId, useState } from "react";
import Script from "next/script";
import type { Language } from "@/lib/i18n";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

const turnstileCopy: Record<Language, { label: string; error: string }> = {
  nl: {
    label: "Controleer dat je geen bot bent",
    error: "De verificatie kon niet worden geladen. Probeer het opnieuw.",
  },
  en: {
    label: "Confirm that you are not a bot",
    error: "The verification challenge could not be loaded. Please try again.",
  },
};

export function TurnstileWidget({
  language,
  siteKey,
  onTokenChange,
}: {
  language: Language;
  siteKey: string;
  onTokenChange: (token: string) => void;
}) {
  const [scriptReady, setScriptReady] = useState(false);
  const [widgetError, setWidgetError] = useState("");
  const containerId = useId().replace(/:/g, "");
  const copy = turnstileCopy[language];

  useEffect(() => {
    if (!scriptReady || !window.turnstile) {
      return;
    }

    setWidgetError("");
    const widgetId = window.turnstile.render(`#${containerId}`, {
      sitekey: siteKey,
      callback: (token) => {
        setWidgetError("");
        onTokenChange(token);
      },
      "expired-callback": () => {
        onTokenChange("");
      },
      "error-callback": () => {
        onTokenChange("");
        setWidgetError(copy.error);
      },
      theme: "auto",
    });

    return () => {
      onTokenChange("");
      if (window.turnstile && widgetId) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [containerId, copy.error, onTokenChange, scriptReady, siteKey]);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)]/70 p-3">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
        {copy.label}
      </p>
      <div id={containerId} />
      {widgetError ? (
        <p className="mt-3 text-xs text-danger">{widgetError}</p>
      ) : null}
    </div>
  );
}
