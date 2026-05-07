"use client";

import { useTheme } from "@/lib/theme";
import { i18n, type Language } from "@/lib/i18n";

export function ThemeToggle({ language }: { language: Language }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const copy = i18n[language].site;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="group inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-muted)] shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] active:translate-y-0"
      aria-label={dark ? copy.switchToLightMode : copy.switchToDarkMode}
      aria-pressed={dark}
    >
      <span
        className="relative h-5 w-9 rounded-full border border-[var(--color-border)] bg-[var(--color-soft)] transition"
        aria-hidden="true"
      >
        <span className="absolute left-1 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[var(--color-accent)] opacity-70" />
        <span className="absolute right-1 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[var(--color-subtle)] opacity-60" />
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--color-surface)] shadow-[0_2px_7px_rgba(15,23,42,0.16)] ring-1 ring-[var(--color-border)] transition-all duration-300 ease-out ${
            dark ? "left-[1.05rem]" : "left-0.5"
          }`}
        />
      </span>
      <span>{dark ? copy.darkMode : copy.lightMode}</span>
    </button>
  );
}
