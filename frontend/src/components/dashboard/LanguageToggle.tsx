"use client";

import { motion } from "framer-motion";
import { languageLabels, type Language } from "@/lib/i18n";

export function LanguageToggle({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[inset_0_1px_0_rgba(15,23,42,0.04)]">
      {(Object.keys(languageLabels) as Language[]).map((option) => {
        const selected = option === language;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`relative h-9 min-w-11 rounded-full px-3 text-xs font-semibold transition ${
              selected ? "text-white" : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
            }`}
            aria-pressed={selected}
          >
            {selected ? (
              <motion.span
                layoutId="language-toggle-pill"
                className="absolute inset-0 rounded-full bg-[var(--color-accent)]"
                transition={{ type: "spring", damping: 24, stiffness: 280 }}
              />
            ) : null}
            <span className="relative z-10">{languageLabels[option]}</span>
          </button>
        );
      })}
    </div>
  );
}
