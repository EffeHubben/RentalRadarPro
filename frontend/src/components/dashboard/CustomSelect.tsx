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
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
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
        className="flex h-11 w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.045] px-3 text-left text-sm text-white outline-none transition hover:border-white/20 hover:bg-white/[0.065] focus:border-brass/70 focus:ring-2 focus:ring-brass/20"
      >
        <span className="truncate">{activeOption?.label}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          className="ml-3 text-xs text-white/45"
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
            className="absolute left-0 right-0 top-full z-50 overflow-hidden rounded-xl border border-white/10 bg-[#121722] p-1 shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl"
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
                      ? "bg-brass/14 text-brass"
                      : "text-white/68 hover:bg-white/[0.06] hover:text-white"
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
