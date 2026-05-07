"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type SelectOption<T extends string> = {
  label: string;
  value: T;
};

export function CustomSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function moveSelection(direction: 1 | -1) {
    const currentIndex = options.findIndex((option) => option.value === value);
    const nextIndex = Math.min(
      options.length - 1,
      Math.max(0, currentIndex + direction),
    );
    onChange(options[nextIndex].value);
  }

  return (
    <div ref={containerRef} className="relative">
      {label ? (
        <span className="rs-subtle mb-2 block text-xs font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      ) : null}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              return;
            }
            moveSelection(1);
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              return;
            }
            moveSelection(-1);
          }

          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className="rs-control flex h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)]"
      >
        <span className="truncate">{activeOption?.label}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          className="rs-subtle ml-3 text-xs"
        >
          v
        </motion.span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 6, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 right-0 top-full z-50 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-hover)] backdrop-blur-xl"
            role="listbox"
          >
            {options.map((option) => {
              const selected = option.value === value;

              return (
                <button
                  key={option.value || "empty"}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    selected
                      ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <span>{option.label}</span>
                  {selected ? <span className="text-xs">●</span> : null}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
