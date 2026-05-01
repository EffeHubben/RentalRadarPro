"use client";

import { useCallback, useEffect, useState } from "react";
import type { Language } from "@/lib/i18n";

export function useLanguagePreference() {
  const [language, setLanguage] = useState<Language>("nl");

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("rental-radar-language");

    if (storedLanguage === "nl" || storedLanguage === "en") {
      setLanguage(storedLanguage);
    }
  }, []);

  const changeLanguage = useCallback((nextLanguage: Language) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem("rental-radar-language", nextLanguage);
  }, []);

  return { language, changeLanguage };
}
