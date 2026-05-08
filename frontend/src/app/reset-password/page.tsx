"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { confirmPasswordReset, requestPasswordReset } from "@/lib/auth";
import { evaluatePasswordRules, MIN_PASSWORD_LENGTH, passwordMeetsRequirements } from "@/lib/passwordRules";
import type { Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

const copy: Record<
  Language,
  {
    requestEyebrow: string;
    requestTitle: string;
    requestBody: string;
    requestAction: string;
    requestSuccess: string;
    resetEyebrow: string;
    resetTitle: string;
    resetBody: string;
    resetAction: string;
    resetSuccess: string;
    email: string;
    password: string;
    confirmPassword: string;
    passwordRequirements: string;
    passwordRuleLength: string;
    passwordRuleUppercase: string;
    passwordRuleLowercase: string;
    passwordRuleNumber: string;
    passwordRuleSpecial: string;
    passwordInvalid: string;
    passwordsDoNotMatch: string;
    missingToken: string;
    openAccount: string;
    openSearch: string;
    loading: string;
  }
> = {
  nl: {
    requestEyebrow: "Wachtwoord resetten",
    requestTitle: "Vraag een resetlink aan",
    requestBody: "Voer het e-mailadres van je account in. Als het account bestaat, sturen we een resetlink.",
    requestAction: "Stuur resetlink",
    requestSuccess: "Als er een account bestaat voor dit e-mailadres, ontvang je zo een resetlink.",
    resetEyebrow: "Nieuw wachtwoord",
    resetTitle: "Stel een nieuw wachtwoord in",
    resetBody: "Gebruik een sterk nieuw wachtwoord om weer toegang te krijgen tot je account.",
    resetAction: "Wachtwoord opslaan",
    resetSuccess: "Je wachtwoord is bijgewerkt. Log opnieuw in met je nieuwe wachtwoord.",
    email: "E-mail",
    password: "Wachtwoord",
    confirmPassword: "Wachtwoord herhalen",
    passwordRequirements: "Wachtwoordvereisten",
    passwordRuleLength: `Minimaal ${MIN_PASSWORD_LENGTH} tekens`,
    passwordRuleUppercase: "Minstens 1 hoofdletter",
    passwordRuleLowercase: "Minstens 1 kleine letter",
    passwordRuleNumber: "Minstens 1 cijfer",
    passwordRuleSpecial: "Minstens 1 speciaal teken",
    passwordInvalid:
      "Gebruik minimaal 8 tekens met een hoofdletter, kleine letter, cijfer en speciaal teken.",
    passwordsDoNotMatch: "De wachtwoorden komen niet overeen.",
    missingToken: "Deze resetlink is ongeldig of incompleet.",
    openAccount: "Ga naar account",
    openSearch: "Open zoeken",
    loading: "Bezig...",
  },
  en: {
    requestEyebrow: "Password reset",
    requestTitle: "Request a reset link",
    requestBody: "Enter the email address for your account. If the account exists, we will send a reset link.",
    requestAction: "Send reset link",
    requestSuccess: "If an account exists for this email address, you will receive a reset link shortly.",
    resetEyebrow: "New password",
    resetTitle: "Set a new password",
    resetBody: "Use a strong new password to regain access to your account.",
    resetAction: "Save password",
    resetSuccess: "Your password has been updated. Log in again with your new password.",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    passwordRequirements: "Password requirements",
    passwordRuleLength: `At least ${MIN_PASSWORD_LENGTH} characters`,
    passwordRuleUppercase: "At least 1 uppercase letter",
    passwordRuleLowercase: "At least 1 lowercase letter",
    passwordRuleNumber: "At least 1 number",
    passwordRuleSpecial: "At least 1 special character",
    passwordInvalid:
      "Use at least 8 characters with an uppercase letter, lowercase letter, number, and special character.",
    passwordsDoNotMatch: "The passwords do not match.",
    missingToken: "This reset link is invalid or incomplete.",
    openAccount: "Go to account",
    openSearch: "Open search",
    loading: "Working...",
  },
};

function inputClass() {
  return "rs-modal-input h-11 px-3 text-sm";
}

export default function ResetPasswordPage() {
  const { language, changeLanguage } = useLanguagePreference();
  const pageCopy = copy[language];
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") ?? "");
  }, []);

  const passwordChecks = useMemo(() => evaluatePasswordRules(password), [password]);
  const passwordValid = passwordMeetsRequirements(password);
  const confirmPasswordMismatch = token ? confirmPassword.length > 0 && password !== confirmPassword : false;

  async function submitRequestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      await requestPasswordReset(email);
      setMessage(pageCopy.requestSuccess);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : pageCopy.requestSuccess);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitNewPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError(pageCopy.missingToken);
      return;
    }

    if (!passwordValid) {
      setError(pageCopy.passwordInvalid);
      return;
    }

    if (password !== confirmPassword) {
      setError(pageCopy.passwordsDoNotMatch);
      return;
    }

    setSubmitting(true);

    try {
      await confirmPasswordReset(token, password);
      setMessage(pageCopy.resetSuccess);
      setPassword("");
      setConfirmPassword("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : pageCopy.missingToken);
    } finally {
      setSubmitting(false);
    }
  }

  const isResetMode = Boolean(token);

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="rs-card rounded-[1.75rem] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
            {isResetMode ? pageCopy.resetEyebrow : pageCopy.requestEyebrow}
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-[var(--color-text)] sm:text-4xl">
            {isResetMode ? pageCopy.resetTitle : pageCopy.requestTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
            {isResetMode ? pageCopy.resetBody : pageCopy.requestBody}
          </p>

          <form
            className="mt-8 space-y-4"
            onSubmit={isResetMode ? submitNewPassword : submitRequestReset}
          >
            {!isResetMode ? (
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                  {pageCopy.email}
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
            ) : (
              <>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                    {pageCopy.password}
                  </span>
                  <input
                    className={inputClass()}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                  />
                  <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)]/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                      {pageCopy.passwordRequirements}
                    </p>
                    <div className="mt-2 grid gap-2">
                      {[
                        { key: "length", valid: passwordChecks.length, label: pageCopy.passwordRuleLength },
                        { key: "uppercase", valid: passwordChecks.uppercase, label: pageCopy.passwordRuleUppercase },
                        { key: "lowercase", valid: passwordChecks.lowercase, label: pageCopy.passwordRuleLowercase },
                        { key: "number", valid: passwordChecks.number, label: pageCopy.passwordRuleNumber },
                        { key: "special", valid: passwordChecks.special, label: pageCopy.passwordRuleSpecial },
                      ].map((check) => (
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
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                    {pageCopy.confirmPassword}
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
                    <p className="mt-2 text-xs text-danger">{pageCopy.passwordsDoNotMatch}</p>
                  ) : null}
                </label>
              </>
            )}

            {error ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            ) : null}

            {message ? (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-[var(--color-text)]">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting || (isResetMode && (!passwordValid || confirmPasswordMismatch))}
              className="rs-primary-button h-11 rounded-lg px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? pageCopy.loading
                : isResetMode
                  ? pageCopy.resetAction
                  : pageCopy.requestAction}
            </button>
          </form>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/account"
              className="rs-control inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
            >
              {pageCopy.openAccount}
            </Link>
            <Link
              href="/search"
              className="rs-control inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
            >
              {pageCopy.openSearch}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter language={language} />
    </div>
  );
}
