"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { i18n, type Language } from "@/lib/i18n";

type AuthMode = "login" | "register";

function inputClass() {
  return "h-11 w-full rounded-lg border border-white/10 bg-white/[0.055] px-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-brass/70 focus:bg-white/[0.08] focus:ring-2 focus:ring-brass/20";
}

export function AuthModal({
  open,
  initialMode,
  language,
  onClose,
  onAuthenticated,
}: {
  open: boolean;
  initialMode: AuthMode;
  language: Language;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  const auth = useAuth();
  const copy = i18n[language].auth;
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
    }
  }, [initialMode, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [open]);

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (mode === "register" && password !== confirmPassword) {
      setError(copy.passwordsDoNotMatch);
      return;
    }

    setSubmitting(true);

    try {
      if (mode === "login") {
        await auth.login({ email, password });
      } else {
        await auth.register({
          email,
          password,
          display_name: displayName.trim() || undefined,
          preferred_language: language,
        });
      }

      onAuthenticated();
      onClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : copy.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
  }

  if (!mounted) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/74 px-4 py-6 backdrop-blur-md sm:py-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            className="my-auto flex max-h-[calc(100dvh-3rem)] w-full max-w-md flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#10131a] shadow-premium"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(215,168,79,0.16),transparent_16rem),rgba(255,255,255,0.035)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
                    RentScout
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {mode === "login" ? copy.loginTitle : copy.registerTitle}
                  </h2>
                  <p className="mt-2 text-sm leading-5 text-white/50">
                    {mode === "login" ? copy.loginSubtitle : copy.registerSubtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 w-10 rounded-xl border border-white/10 bg-black/18 text-white/55 transition hover:border-white/24 hover:text-white"
                  aria-label={copy.continueAsGuest}
                >
                  x
                </button>
              </div>
            </div>

            <form className="min-h-0 space-y-4 overflow-y-auto p-5" onSubmit={submitForm}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, x: mode === "register" ? 18 : -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: mode === "register" ? -18 : 18 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="space-y-4"
                >
                  {mode === "register" ? (
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
                        {copy.displayName}
                      </span>
                      <input
                        className={inputClass()}
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder="Efecan"
                      />
                    </label>
                  ) : null}

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
                      {copy.email}
                    </span>
                    <input
                      className={inputClass()}
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="user@example.com"
                      autoComplete="email"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
                      {copy.password}
                    </span>
                    <input
                      className={inputClass()}
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      required
                      minLength={8}
                    />
                  </label>

                  {mode === "register" ? (
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
                        {copy.confirmPassword}
                      </span>
                      <input
                        className={inputClass()}
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        required
                        minLength={8}
                      />
                    </label>
                  ) : null}
                </motion.div>
              </AnimatePresence>

              {error ? (
                <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="h-11 w-full rounded-xl border border-brass/40 bg-brass/14 px-4 text-sm font-semibold text-brass transition hover:bg-brass hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? copy.loading
                  : mode === "login"
                    ? copy.loginAction
                    : copy.registerAction}
              </button>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => switchMode(mode === "login" ? "register" : "login")}
                  className="h-10 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/62 transition hover:border-white/24 hover:text-white"
                >
                  {mode === "login" ? copy.switchToRegister : copy.switchToLogin}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 rounded-xl border border-white/10 bg-black/18 px-3 text-xs font-semibold text-white/50 transition hover:border-white/24 hover:text-white"
                >
                  {copy.continueAsGuest}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
