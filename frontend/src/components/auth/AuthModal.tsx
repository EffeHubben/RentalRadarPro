"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { i18n, type Language } from "@/lib/i18n";
import {
  evaluatePasswordRules,
  MIN_PASSWORD_LENGTH,
  passwordMeetsRequirements,
} from "@/lib/passwordRules";

type AuthMode = "login" | "register";
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

function inputClass() {
  return "rs-modal-input h-11 px-3 text-sm";
}

function getPasswordChecks(password: string, copy: (typeof i18n)[Language]["auth"]) {
  const checks = evaluatePasswordRules(password);

  return [
    {
      key: "length",
      valid: checks.length,
      label: copy.passwordRuleLength,
    },
    {
      key: "uppercase",
      valid: checks.uppercase,
      label: copy.passwordRuleUppercase,
    },
    {
      key: "lowercase",
      valid: checks.lowercase,
      label: copy.passwordRuleLowercase,
    },
    {
      key: "number",
      valid: checks.number,
      label: copy.passwordRuleNumber,
    },
    {
      key: "special",
      valid: checks.special,
      label: copy.passwordRuleSpecial,
    },
  ] as const;
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
  const [captchaToken, setCaptchaToken] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const passwordChecks = getPasswordChecks(password, copy);
  const passwordValid = passwordMeetsRequirements(password);
  const confirmPasswordMismatch =
    mode === "register" && confirmPassword.length > 0 && password !== confirmPassword;
  const registerBlocked =
    mode === "register" &&
    (!passwordValid || confirmPasswordMismatch || (Boolean(turnstileSiteKey) && !captchaToken));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setCaptchaToken("");
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

    if (mode === "register" && !passwordValid) {
      setError(copy.passwordInvalid);
      return;
    }

    setSubmitting(true);

    try {
      if (mode === "login") {
        await auth.login({ email, password, remember_me: rememberMe });
      } else {
        await auth.register({
          email,
          password,
          display_name: displayName.trim() || undefined,
          preferred_language: language,
          captcha_token: captchaToken || undefined,
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
    setCaptchaToken("");
    setError("");
  }

  if (!mounted) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="rs-modal-backdrop fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto px-4 py-6 sm:py-10"
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
            className="rs-modal-panel my-auto flex max-h-[calc(100dvh-3rem)] w-full max-w-md flex-col overflow-hidden rounded-[1.5rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[var(--color-border)] bg-[var(--color-modal-panel-subtle)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
                    RentScout
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                    {mode === "login" ? copy.loginTitle : copy.registerTitle}
                  </h2>
                  <p className="mt-2 text-sm leading-5 text-[var(--color-muted)]">
                    {mode === "login" ? copy.loginSubtitle : copy.registerSubtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rs-control h-10 w-10 rounded-xl text-sm font-semibold"
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
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                        {copy.displayName}
                      </span>
                      <input
                        className={inputClass()}
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder={copy.displayNamePlaceholder}
                        autoComplete="name"
                      />
                    </label>
                  ) : null}

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
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
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                      {copy.password}
                    </span>
                    <input
                      className={inputClass()}
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                    />
                    {mode === "register" ? (
                      <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)]/70 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                          {copy.passwordRequirements}
                        </p>
                        <div className="mt-2 grid gap-2">
                          {passwordChecks.map((check) => (
                            <div
                              key={check.key}
                              className={`flex items-center gap-2 text-xs ${
                                check.valid ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--color-muted)]"
                              }`}
                            >
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                  check.valid ? "bg-emerald-500" : "bg-[var(--color-border)]"
                                }`}
                                aria-hidden="true"
                              />
                              <span>{check.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </label>

                  {mode === "login" ? (
                    <div className="flex items-center justify-between">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(event) => setRememberMe(event.target.checked)}
                          className="h-4 w-4 rounded border-[var(--color-border)] accent-brass"
                        />
                        <span className="text-xs font-semibold text-[var(--color-subtle)]">
                          {copy.rememberMe}
                        </span>
                      </label>
                      <Link
                        href="/reset-password"
                        onClick={onClose}
                        className="text-xs font-semibold text-[var(--color-accent-strong)] transition hover:text-[var(--color-text)]"
                      >
                        {copy.forgotPassword}
                      </Link>
                    </div>
                  ) : null}

                  {mode === "register" ? (
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                        {copy.confirmPassword}
                      </span>
                      <input
                        className={inputClass()}
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                      />
                      {confirmPasswordMismatch ? (
                        <p className="mt-2 text-xs text-danger">{copy.passwordsDoNotMatch}</p>
                      ) : null}
                    </label>
                  ) : null}

                  {mode === "register" && turnstileSiteKey ? (
                    <TurnstileWidget
                      language={language}
                      siteKey={turnstileSiteKey}
                      onTokenChange={setCaptchaToken}
                    />
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
                disabled={submitting || registerBlocked}
                className="h-11 w-full rounded-xl border border-brass/40 bg-brass/14 px-4 text-sm font-semibold text-brass transition hover:bg-brass hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="rs-control h-10 rounded-xl px-3 text-xs font-semibold"
                >
                  {mode === "login" ? copy.switchToRegister : copy.switchToLogin}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rs-control h-10 rounded-xl px-3 text-xs font-semibold"
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
