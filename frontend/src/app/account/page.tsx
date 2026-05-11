"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import {
  changeEmailAddress,
  changePassword,
  resendVerificationEmail,
  updateProfile,
} from "@/lib/auth";
import {
  createBillingSession,
  formatProPlanPrice,
  formatProPlanPriceSuffix,
  useBillingConfig,
} from "@/lib/billing";
import { i18n, type Language } from "@/lib/i18n";
import {
  evaluatePasswordRules,
  MIN_PASSWORD_LENGTH,
  passwordMeetsRequirements,
} from "@/lib/passwordRules";
import {
  describeSubscriptionState,
  formatAccountDate,
  hasPro,
} from "@/lib/subscription";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

type AuthMode = "login" | "register";

const accountCopy: Record<
  Language,
  {
    title: string;
    subtitle: string;
    signedOutTitle: string;
    signedOutBody: string;
    signIn: string;
    createAccount: string;
    forgotPassword: string;
    accountOverview: string;
    profileSettings: string;
    profileHelp: string;
    overviewHelp: string;
    displayName: string;
    email: string;
    emailVerification: string;
    emailVerified: string;
    emailUnverified: string;
    resendVerification: string;
    resendVerificationSent: string;
    language: string;
    joined: string;
    plan: string;
    freePlan: string;
    proPlan: string;
    saveProfile: string;
    profileSaved: string;
    security: string;
    securityHelp: string;
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
    savePassword: string;
    passwordSaved: string;
    passwordDifferent: string;
    passwordMismatch: string;
    passwordRequirements: string;
    emailAddress: string;
    emailAddressHelp: string;
    newEmail: string;
    saveEmail: string;
    emailSaved: string;
    emailSavedVerify: string;
    subscription: string;
    subscriptionHelp: string;
    status: string;
    validity: string;
    currentPrice: string;
    manageSubscription: string;
    upgradeToPro: string;
    renews: string;
    activeUntil: string;
    canceledActiveUntil: string;
    paymentFailed: string;
    inactive: string;
    freePlanHelp: string;
    proPlanHelp: string;
    checkoutUnavailable: string;
    working: string;
    resetEntry: string;
    resetHelp: string;
    proFeatures: string[];
  }
> = {
  nl: {
    title: "Account",
    subtitle:
      "Beheer je gegevens, beveiliging en abonnement in een rustig overzicht.",
    signedOutTitle: "Log in om je account en abonnement te beheren",
    signedOutBody:
      "Met een account kun je je gegevens beheren, je wachtwoord resetten en Pro activeren wanneer facturering beschikbaar is.",
    signIn: "Inloggen",
    createAccount: "Account maken",
    forgotPassword: "Wachtwoord vergeten?",
    accountOverview: "Accountoverzicht",
    profileSettings: "Profiel en voorkeuren",
    profileHelp: "Werk je naam en taalvoorkeur bij voor een consistenter account.",
    overviewHelp: "Je belangrijkste account- en abonnementsgegevens op een plek.",
    displayName: "Naam",
    email: "E-mail",
    emailVerification: "E-mailstatus",
    emailVerified: "Bevestigd",
    emailUnverified: "Nog niet bevestigd",
    resendVerification: "Verificatie-e-mail versturen",
    resendVerificationSent: "Verificatie-e-mail verzonden. Controleer je inbox en spammap.",
    language: "Taal",
    joined: "Account sinds",
    plan: "Abonnement",
    freePlan: "Gratis",
    proPlan: "Pro",
    saveProfile: "Profiel opslaan",
    profileSaved: "Profiel bijgewerkt.",
    security: "Beveiliging",
    securityHelp: "Wijzig je wachtwoord met dezelfde regels als bij registratie.",
    currentPassword: "Huidig wachtwoord",
    newPassword: "Nieuw wachtwoord",
    confirmNewPassword: "Nieuw wachtwoord herhalen",
    savePassword: "Wachtwoord wijzigen",
    passwordSaved: "Wachtwoord bijgewerkt.",
    passwordDifferent: "Je nieuwe wachtwoord moet verschillen van het huidige wachtwoord.",
    passwordMismatch: "De wachtwoorden komen niet overeen.",
    passwordRequirements: "Wachtwoordvereisten",
    emailAddress: "E-mailadres wijzigen",
    emailAddressHelp:
      "Voer je nieuwe e-mailadres in en bevestig met je huidige wachtwoord.",
    newEmail: "Nieuw e-mailadres",
    saveEmail: "E-mailadres wijzigen",
    emailSaved: "E-mailadres bijgewerkt.",
    emailSavedVerify:
      "E-mailadres bijgewerkt. Controleer je inbox om het nieuwe adres te bevestigen.",
    subscription: "Abonnement",
    subscriptionHelp:
      "Bekijk je huidige status, verlengdatum of einddatum en open indien nodig het Stripe-portaal.",
    status: "Status",
    validity: "Geldigheid",
    currentPrice: "Prijs",
    manageSubscription: "Abonnement beheren",
    upgradeToPro: "Upgrade naar Pro",
    renews: "Verlengt op",
    activeUntil: "Toegang actief tot",
    canceledActiveUntil: "Abonnement opgezegd — Pro-toegang blijft tot",
    paymentFailed: "Betaling mislukt — werk je betaalmethode bij om Pro te behouden",
    inactive: "Gratis account actief",
    freePlanHelp: "Upgrade naar Pro voor volledige woningdetails en e-mailnotificaties.",
    proPlanHelp: "Je Pro-toegang en Stripe-status worden hieronder bijgewerkt.",
    checkoutUnavailable: "Facturering is nog niet geconfigureerd.",
    working: "Even wachten...",
    resetEntry: "Reset via e-mail",
    resetHelp: "Geen toegang meer? Vraag direct een resetlink aan.",
    proFeatures: [
      "Volledige woningdetails, foto's en links",
      "Opgeslagen zoekprofielen",
      "Voortgang per woning",
      "E-mailnotificaties bij nieuwe woningen",
    ],
  },
  en: {
    title: "Account",
    subtitle:
      "Manage your details, security, and subscription in one calm workspace.",
    signedOutTitle: "Log in to manage your account and subscription",
    signedOutBody:
      "An account lets you manage your details, reset your password, and activate Pro when billing is available.",
    signIn: "Log in",
    createAccount: "Create account",
    forgotPassword: "Forgot password?",
    accountOverview: "Account overview",
    profileSettings: "Profile and preferences",
    profileHelp: "Update your name and language preference for a more consistent account.",
    overviewHelp: "Your main account and subscription details in one place.",
    displayName: "Name",
    email: "Email",
    emailVerification: "Email status",
    emailVerified: "Verified",
    emailUnverified: "Not verified yet",
    resendVerification: "Send verification email",
    resendVerificationSent: "Verification email sent. Check your inbox and spam folder.",
    language: "Language",
    joined: "Joined",
    plan: "Plan",
    freePlan: "Free",
    proPlan: "Pro",
    saveProfile: "Save profile",
    profileSaved: "Profile updated.",
    security: "Security",
    securityHelp: "Change your password using the same policy as registration.",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmNewPassword: "Confirm new password",
    savePassword: "Change password",
    passwordSaved: "Password updated.",
    passwordDifferent: "Your new password must be different from your current password.",
    passwordMismatch: "The passwords do not match.",
    passwordRequirements: "Password requirements",
    emailAddress: "Change email address",
    emailAddressHelp:
      "Enter your new email address and confirm with your current password.",
    newEmail: "New email address",
    saveEmail: "Change email address",
    emailSaved: "Email address updated.",
    emailSavedVerify:
      "Email address updated. Check your inbox to verify the new address.",
    subscription: "Subscription",
    subscriptionHelp:
      "Review your current status, renewal or end date, and open the Stripe portal when needed.",
    status: "Status",
    validity: "Validity",
    currentPrice: "Price",
    manageSubscription: "Manage subscription",
    upgradeToPro: "Upgrade to Pro",
    renews: "Renews on",
    activeUntil: "Access active until",
    canceledActiveUntil: "Subscription canceled — Pro access remains until",
    paymentFailed: "Payment failed — update your payment method to keep Pro access",
    inactive: "Free plan active",
    freePlanHelp: "Upgrade to Pro for full listing details and email notifications.",
    proPlanHelp: "Your Pro access and Stripe status are summarized below.",
    checkoutUnavailable: "Billing is not configured yet.",
    working: "Working...",
    resetEntry: "Reset by email",
    resetHelp: "Locked out? Request a reset link directly.",
    proFeatures: [
      "Full listing details, photos, and links",
      "Saved search profiles",
      "Listing progress tracking",
      "Email notifications for new listings",
    ],
  },
};

function inputClass() {
  return "rs-modal-input h-11 px-3 text-sm";
}

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.42, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function RequirementRow({
  valid,
  label,
}: {
  valid: boolean;
  label: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-xs ${
        valid ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--color-muted)]"
      }`}
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          valid ? "bg-emerald-500" : "bg-[var(--color-border)]"
        }`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "warning";
}) {
  const classes =
    tone === "positive"
      ? "bg-[var(--color-teal-soft)] text-[var(--color-teal)] border-[var(--color-teal)]/25"
      : tone === "warning"
        ? "bg-brass/12 text-[var(--color-accent-strong)] border-brass/25"
        : "bg-[var(--color-soft)] text-[var(--color-muted)] border-[var(--color-border)]";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}>
      {children}
    </span>
  );
}

export default function AccountPage() {
  const auth = useAuth();
  const { language, changeLanguage } = useLanguagePreference();
  const siteAuthCopy = i18n[language].auth;
  const copy = accountCopy[language];
  const {
    billingEnabled,
    monthlyPriceAmount,
    monthlyPriceCurrency,
    monthlyPriceInterval,
  } = useBillingConfig();
  const [modalMode, setModalMode] = useState<AuthMode>("login");
  const [modalOpen, setModalOpen] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<Language>("nl");
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");

  const isPro = hasPro(auth.user);
  const subscriptionSummary = describeSubscriptionState(auth.user, language);
  const joinedDate = formatAccountDate(auth.user?.created_at ?? null, language);
  const subscriptionEndDate = formatAccountDate(
    auth.user?.subscription_current_period_end ?? null,
    language,
  );
  const monthlyPrice = formatProPlanPrice(language, monthlyPriceAmount, monthlyPriceCurrency);
  const monthlyPriceSuffix = formatProPlanPriceSuffix(language, monthlyPriceInterval);
  const passwordChecks = evaluatePasswordRules(newPassword);
  const passwordValid = passwordMeetsRequirements(newPassword);
  const passwordMismatch =
    confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;

  useEffect(() => {
    setDisplayName(auth.user?.display_name ?? "");
    setPreferredLanguage(auth.user?.preferred_language ?? language);
    setNewEmail(auth.user?.email ?? "");
  }, [auth.user, language]);

  function openAuth(mode: AuthMode) {
    setModalMode(mode);
    setModalOpen(true);
  }

  async function handleResendVerification() {
    if (!auth.accessToken) return;

    setResendLoading(true);
    setResendMessage("");
    setResendError("");

    try {
      await resendVerificationEmail(auth.accessToken);
      setResendMessage(copy.resendVerificationSent);
    } catch (caughtError) {
      setResendError(caughtError instanceof Error ? caughtError.message : siteAuthCopy.genericError);
    } finally {
      setResendLoading(false);
    }
  }

  async function redirectToBillingSession(mode: "checkout" | "portal") {
    setBillingError("");

    if (!auth.isAuthenticated || !auth.accessToken) {
      openAuth(mode === "checkout" ? "register" : "login");
      return;
    }

    if (!billingEnabled) {
      setBillingError(copy.checkoutUnavailable);
      return;
    }

    setBillingLoading(true);

    try {
      const session = await createBillingSession(mode, auth.accessToken);
      window.location.assign(session.url);
    } catch (caughtError) {
      setBillingError(
        caughtError instanceof Error ? caughtError.message : copy.checkoutUnavailable,
      );
    } finally {
      setBillingLoading(false);
    }
  }

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!auth.accessToken) {
      return;
    }

    setProfileSaving(true);
    setProfileMessage("");
    setProfileError("");

    try {
      const response = await updateProfile(auth.accessToken, {
        display_name: displayName.trim() || undefined,
        preferred_language: preferredLanguage,
      });
      changeLanguage(preferredLanguage);
      await auth.refreshSession();
      setProfileMessage(response.message || copy.profileSaved);
    } catch (caughtError) {
      setProfileError(caughtError instanceof Error ? caughtError.message : siteAuthCopy.genericError);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleEmailSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!auth.accessToken) {
      return;
    }

    setEmailSaving(true);
    setEmailMessage("");
    setEmailError("");

    try {
      const response = await changeEmailAddress(auth.accessToken, {
        new_email: newEmail.trim(),
        current_password: emailPassword,
      });
      await auth.refreshSession();
      setEmailPassword("");
      setEmailMessage(response.message || copy.emailSaved);
    } catch (caughtError) {
      setEmailError(caughtError instanceof Error ? caughtError.message : siteAuthCopy.genericError);
    } finally {
      setEmailSaving(false);
    }
  }

  async function handlePasswordSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!auth.accessToken) {
      return;
    }

    setPasswordMessage("");
    setPasswordError("");

    if (!passwordValid) {
      setPasswordError(siteAuthCopy.passwordInvalid);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError(copy.passwordMismatch);
      return;
    }

    setPasswordSaving(true);

    try {
      const response = await changePassword(auth.accessToken, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      await auth.refreshSession();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordMessage(response.message || copy.passwordSaved);
    } catch (caughtError) {
      setPasswordError(caughtError instanceof Error ? caughtError.message : siteAuthCopy.genericError);
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />

      <main>
        <section className="relative overflow-hidden border-b border-[var(--color-border)]">
          <div className="animate-warm-drift absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_72%_18%,var(--color-hero-glow),transparent_34rem)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <p className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-strong)]">
              RentScout
            </p>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.06] text-[var(--color-text)] sm:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-muted)] sm:text-lg">
              {copy.subtitle}
            </p>
          </div>
        </section>

        {!auth.isAuthenticated ? (
          <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="rs-card rounded-[1.5rem] p-6 sm:p-8">
              <h2 className="text-2xl font-semibold text-[var(--color-text)]">
                {copy.signedOutTitle}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
                {copy.signedOutBody}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openAuth("login")}
                  className="rs-primary-button h-11 rounded-lg px-5 text-sm font-semibold"
                >
                  {copy.signIn}
                </button>
                <button
                  type="button"
                  onClick={() => openAuth("register")}
                  className="rs-control h-11 rounded-lg px-5 text-sm font-semibold"
                >
                  {copy.createAccount}
                </button>
                <Link
                  href="/reset-password"
                  className="rs-control inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
                >
                  {copy.forgotPassword}
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <Reveal>
                <section className="rs-card rounded-[1.5rem] p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-[var(--color-text)]">
                        {copy.accountOverview}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                        {copy.overviewHelp}
                      </p>
                    </div>
                    <StatusPill tone={isPro ? "positive" : "neutral"}>
                      {isPro ? copy.proPlan : copy.freePlan}
                    </StatusPill>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                        {copy.displayName}
                      </div>
                      <div className="mt-2 font-semibold text-[var(--color-text)]">
                        {auth.user?.display_name || siteAuthCopy.guestMode}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                        {copy.email}
                      </div>
                      <div className="mt-2 font-semibold text-[var(--color-text)]">
                        {auth.user?.email}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                        {copy.emailVerification}
                      </div>
                      <div className="mt-2">
                        <StatusPill tone={auth.user?.email_verified ? "positive" : "warning"}>
                          {auth.user?.email_verified ? copy.emailVerified : copy.emailUnverified}
                        </StatusPill>
                      </div>
                      {!auth.user?.email_verified && (
                        <div className="mt-3">
                          {resendMessage ? (
                            <p className="text-xs leading-5 text-[var(--color-text)]">{resendMessage}</p>
                          ) : (
                            <button
                              type="button"
                              disabled={resendLoading}
                              onClick={() => void handleResendVerification()}
                              className="text-xs font-semibold text-[var(--color-accent-strong)] transition hover:text-[var(--color-text)] disabled:opacity-60"
                            >
                              {resendLoading ? copy.working : copy.resendVerification}
                            </button>
                          )}
                          {resendError ? (
                            <p className="mt-1 text-xs text-danger">{resendError}</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                        {copy.joined}
                      </div>
                      <div className="mt-2 font-semibold text-[var(--color-text)]">
                        {joinedDate || "—"}
                      </div>
                    </div>
                  </div>
                </section>
              </Reveal>

              <Reveal delay={0.04}>
                <section className="rs-card rounded-[1.5rem] p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-[var(--color-text)]">
                        {copy.subscription}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                        {copy.subscriptionHelp}
                      </p>
                    </div>
                    <StatusPill tone={isPro ? "positive" : "neutral"}>
                      {auth.user?.subscription_status}
                    </StatusPill>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                        {copy.plan}
                      </div>
                      <div className="mt-2 font-semibold text-[var(--color-text)]">
                        {isPro ? copy.proPlan : copy.freePlan}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                        {copy.currentPrice}
                      </div>
                      <div className="mt-2 font-semibold text-[var(--color-text)]">
                        {monthlyPrice}
                        <span className="ml-2 text-sm font-medium text-[var(--color-muted)]">
                          {monthlyPriceSuffix}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                        {copy.validity}
                      </div>
                      <div className="mt-2 font-semibold text-[var(--color-text)]">
                        {subscriptionSummary || copy.inactive}
                      </div>
                      {subscriptionEndDate ? (
                        <p className="mt-2 text-sm text-[var(--color-muted)]">
                          {auth.user?.plan === "pro" && auth.user.subscription_status === "active" && !auth.user.subscription_cancel_at_period_end
                            ? `${copy.renews} ${subscriptionEndDate}`
                            : auth.user?.plan === "pro" && auth.user.subscription_cancel_at_period_end
                              ? `${copy.canceledActiveUntil} ${subscriptionEndDate}`
                              : `${copy.activeUntil} ${subscriptionEndDate}`}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-6 text-[var(--color-muted)]">
                    {isPro ? copy.proPlanHelp : copy.freePlanHelp}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {copy.proFeatures.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-[var(--color-muted)]">
                        <span className="mt-0.5 shrink-0 text-[var(--color-accent-strong)]">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={billingLoading || !billingEnabled}
                      onClick={() => void redirectToBillingSession(isPro ? "portal" : "checkout")}
                      className="rs-primary-button h-11 rounded-lg px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {billingLoading
                        ? copy.working
                        : isPro
                          ? copy.manageSubscription
                          : copy.upgradeToPro}
                    </button>
                  </div>

                  {billingError ? (
                    <p className="mt-3 text-sm leading-6 text-danger">{billingError}</p>
                  ) : null}
                </section>
              </Reveal>

              <Reveal delay={0.06}>
                <section className="rs-card rounded-[1.5rem] p-6">
                  <h2 className="text-xl font-semibold text-[var(--color-text)]">
                    {copy.profileSettings}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                    {copy.profileHelp}
                  </p>

                  <form className="mt-6 space-y-4" onSubmit={handleProfileSave}>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                        {copy.displayName}
                      </span>
                      <input
                        className={inputClass()}
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder={siteAuthCopy.displayNamePlaceholder}
                        autoComplete="name"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                        {copy.language}
                      </span>
                      <select
                        className={inputClass()}
                        value={preferredLanguage}
                        onChange={(event) => setPreferredLanguage(event.target.value as Language)}
                      >
                        <option value="nl">Nederlands</option>
                        <option value="en">English</option>
                      </select>
                    </label>

                    {profileError ? (
                      <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                        {profileError}
                      </div>
                    ) : null}
                    {profileMessage ? (
                      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-[var(--color-text)]">
                        {profileMessage}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="rs-primary-button h-11 rounded-lg px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {profileSaving ? copy.working : copy.saveProfile}
                    </button>
                  </form>
                </section>
              </Reveal>

              <Reveal delay={0.08}>
                <section className="rs-card rounded-[1.5rem] p-6">
                  <h2 className="text-xl font-semibold text-[var(--color-text)]">
                    {copy.emailAddress}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                    {copy.emailAddressHelp}
                  </p>

                  <form className="mt-6 space-y-4" onSubmit={handleEmailSave}>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                        {copy.newEmail}
                      </span>
                      <input
                        className={inputClass()}
                        type="email"
                        value={newEmail}
                        onChange={(event) => setNewEmail(event.target.value)}
                        autoComplete="email"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                        {copy.currentPassword}
                      </span>
                      <input
                        className={inputClass()}
                        type="password"
                        value={emailPassword}
                        onChange={(event) => setEmailPassword(event.target.value)}
                        autoComplete="current-password"
                        required
                      />
                    </label>

                    {emailError ? (
                      <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                        {emailError}
                      </div>
                    ) : null}
                    {emailMessage ? (
                      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-[var(--color-text)]">
                        {emailMessage}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={emailSaving}
                      className="rs-primary-button h-11 rounded-lg px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {emailSaving ? copy.working : copy.saveEmail}
                    </button>
                  </form>
                </section>
              </Reveal>

              <Reveal delay={0.1}>
                <section className="rs-card rounded-[1.5rem] p-6 xl:col-span-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-[var(--color-text)]">
                        {copy.security}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                        {copy.securityHelp}
                      </p>
                    </div>
                    <div className="text-sm text-[var(--color-muted)]">
                      {copy.resetHelp}
                    </div>
                  </div>

                  <form className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]" onSubmit={handlePasswordSave}>
                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                          {copy.currentPassword}
                        </span>
                        <input
                          className={inputClass()}
                          type="password"
                          value={currentPassword}
                          onChange={(event) => setCurrentPassword(event.target.value)}
                          autoComplete="current-password"
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                          {copy.newPassword}
                        </span>
                        <input
                          className={inputClass()}
                          type="password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          autoComplete="new-password"
                          required
                          minLength={MIN_PASSWORD_LENGTH}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                          {copy.confirmNewPassword}
                        </span>
                        <input
                          className={inputClass()}
                          type="password"
                          value={confirmNewPassword}
                          onChange={(event) => setConfirmNewPassword(event.target.value)}
                          autoComplete="new-password"
                          required
                          minLength={MIN_PASSWORD_LENGTH}
                        />
                        {passwordMismatch ? (
                          <p className="mt-2 text-xs text-danger">{copy.passwordMismatch}</p>
                        ) : null}
                      </label>
                    </div>

                    <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-soft)]/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                        {copy.passwordRequirements}
                      </p>
                      <div className="mt-3 grid gap-2">
                        <RequirementRow valid={passwordChecks.length} label={siteAuthCopy.passwordRuleLength} />
                        <RequirementRow valid={passwordChecks.uppercase} label={siteAuthCopy.passwordRuleUppercase} />
                        <RequirementRow valid={passwordChecks.lowercase} label={siteAuthCopy.passwordRuleLowercase} />
                        <RequirementRow valid={passwordChecks.number} label={siteAuthCopy.passwordRuleNumber} />
                        <RequirementRow valid={passwordChecks.special} label={siteAuthCopy.passwordRuleSpecial} />
                      </div>
                      <Link
                        href="/reset-password"
                        className="mt-5 inline-flex text-sm font-semibold text-[var(--color-accent-strong)] transition hover:text-[var(--color-text)]"
                      >
                        {copy.resetEntry}
                      </Link>
                    </div>

                    <div className="lg:col-span-2">
                      {passwordError ? (
                        <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                          {passwordError}
                        </div>
                      ) : null}
                      {passwordMessage ? (
                        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-[var(--color-text)]">
                          {passwordMessage}
                        </div>
                      ) : null}
                    </div>

                    <div className="lg:col-span-2">
                      <button
                        type="submit"
                        disabled={passwordSaving || !passwordValid || passwordMismatch}
                        className="rs-primary-button h-11 rounded-lg px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {passwordSaving ? copy.working : copy.savePassword}
                      </button>
                    </div>
                  </form>
                </section>
              </Reveal>
            </div>
          </section>
        )}
      </main>

      <SiteFooter language={language} />
      <AuthModal
        open={modalOpen}
        initialMode={modalMode}
        language={language}
        onClose={() => setModalOpen(false)}
        onAuthenticated={() => undefined}
      />
    </div>
  );
}
