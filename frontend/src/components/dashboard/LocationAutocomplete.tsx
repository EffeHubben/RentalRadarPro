"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LocationSuggestion } from "@/types/listing";
import { fetchLocationSuggestions } from "@/lib/api";
import { i18n, type Language } from "@/lib/i18n";

type Props = {
  value: string;
  language: Language;
  onSelect: (suggestion: LocationSuggestion) => void;
  onClear: () => void;
  className?: string;
  autoFocus?: boolean;
};

export function LocationAutocomplete({ value, language, onSelect, onClear, className = "", autoFocus }: Props) {
  const copy = i18n[language].filters;
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasSelected, setHasSelected] = useState(!!value);
  const [showHint, setShowHint] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
    setHasSelected(!!value);
  }, [value]);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await fetchLocationSuggestions(q);
        setSuggestions(results);
        setOpen(results.length > 0 || q.trim().length >= 2);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setInputValue(q);
    setHasSelected(false);
    setShowHint(false);
    if (!q.trim()) {
      onClear();
      setSuggestions([]);
      setOpen(false);
    } else {
      search(q);
    }
  }

  function handleSelect(s: LocationSuggestion) {
    setInputValue(s.label);
    setHasSelected(true);
    setShowHint(false);
    setSuggestions([]);
    setOpen(false);
    onSelect(s);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleBlur() {
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setOpen(false);
        if (inputValue.trim() && !hasSelected) {
          setShowHint(true);
        }
      }
    }, 120);
  }

  const noResults = open && !loading && suggestions.length === 0 && inputValue.trim().length >= 2;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        autoFocus={autoFocus}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
          setShowHint(false);
        }}
        onBlur={handleBlur}
        className="rs-input h-12 w-full"
        placeholder={copy.locationPlaceholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-haspopup="listbox"
      />

      {loading && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <span className="block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
        </span>
      )}

      {open && (suggestions.length > 0 || noResults) && (
        <ul
          role="listbox"
          className="rs-card absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[var(--color-border)] py-1 shadow-lg"
        >
          {noResults ? (
            <li className="px-4 py-3 text-sm text-[var(--color-muted)]">
              {copy.locationNoResults}
            </li>
          ) : (
            suggestions.map((s, i) => (
              <li
                key={`${s.lat}-${s.lng}-${s.label}`}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                className={`flex cursor-pointer flex-col px-4 py-2.5 text-sm transition-colors ${
                  i === activeIndex
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]"
                    : "text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
                }`}
              >
                <span className="font-medium">{s.label}</span>
                {s.province && (
                  <span className="text-xs text-[var(--color-muted)]">{s.province}</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}

      {showHint && !open && (
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">{copy.locationHint}</p>
      )}
    </div>
  );
}
