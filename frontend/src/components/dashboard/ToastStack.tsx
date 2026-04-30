"use client";

import { AnimatePresence, motion } from "framer-motion";

export type Toast = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
};

const toastStyles: Record<Toast["type"], string> = {
  success: "border-mint/30 bg-mint/12 text-mint",
  error: "border-danger/35 bg-danger/12 text-danger",
  info: "border-brass/30 bg-brass/12 text-brass",
};

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed right-4 top-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 24, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.96 }}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-premium backdrop-blur-xl ${toastStyles[toast.type]}`}
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
