"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { languageRecord } from "@/components/site/InfoPageLayout";
import { i18n, type Language } from "@/lib/i18n";
import {
  emptyTenantProfile,
  fetchTenantProfile,
  generateTenantProfileExample,
  updateTenantProfile,
} from "@/lib/tenantProfile";
import { useLanguagePreference } from "@/lib/useLanguagePreference";
import type { TenantProfile, TenantResponseStyle } from "@/types/tenant";

const copy = languageRecord(
  {
    title: "Huurdersprofiel",
    intro:
      "Vul alleen praktische informatie in. We vragen niet om BSN, scans, bankbestanden of documentuploads.",
    signedOutTitle: "Log in om je huurdersprofiel te beheren",
    signedOutBody:
      "Met een account kun je je profiel bewaren en later per woning een nette reactie maken.",
    signIn: "Inloggen",
    createAccount: "Account maken",
    situation: "Jouw situatie",
    work: "Werk/studie",
    household: "Huishouden",
    motivation: "Intro en motivatie",
    checklist: "Documenten-checklist",
    example: "Voorbeeldreactie",
    fullName: "Naam",
    age: "Leeftijd",
    preferredCity: "Gewenste stad",
    moveInDate: "Verhuisdatum",
    occupation: "Werk of studie",
    incomeRange: "Inkomensrange optioneel",
    householdSize: "Huishoudgrootte",
    pets: "Huisdieren",
    petNotes: "Toelichting huisdieren",
    smoker: "Roker",
    yes: "Ja",
    no: "Nee",
    unknown: "Niet ingevuld",
    shortIntro: "Korte intro",
    whyLooking: "Waarom zoek je een woning?",
    strengths: "Sterke punten als huurder",
    idReady: "ID klaar",
    incomeProofReady: "Inkomensbewijs klaar",
    employerStatementReady: "Werkgeversverklaring klaar",
    bankStatementReady: "Bankafschrift klaar",
    motivationReady: "Motivatie klaar",
    guarantorAvailable: "Garantsteller beschikbaar",
    save: "Profiel opslaan",
    saving: "Opslaan...",
    saved: "Huurdersprofiel opgeslagen.",
    loading: "Profiel laden...",
    generate: "Genereer motivatiebericht",
    generating: "Genereren...",
    copied: "Gekopieerd",
    copyButton: "Kopiëren",
    error: "Er ging iets mis. Probeer het opnieuw.",
    completion: "Profiel compleet",
  },
  {
    title: "Tenant profile",
    intro:
      "Add only practical information. We do not ask for national IDs, scans, bank files, or uploads.",
    signedOutTitle: "Log in to manage your tenant profile",
    signedOutBody:
      "With an account, you can save your profile and later generate a polished response per listing.",
    signIn: "Log in",
    createAccount: "Create account",
    situation: "Your situation",
    work: "Work/study",
    household: "Household",
    motivation: "Intro and motivation",
    checklist: "Document checklist",
    example: "Example response",
    fullName: "Name",
    age: "Age",
    preferredCity: "Preferred city",
    moveInDate: "Move-in date",
    occupation: "Work or study",
    incomeRange: "Income range optional",
    householdSize: "Household size",
    pets: "Pets",
    petNotes: "Pet notes",
    smoker: "Smoker",
    yes: "Yes",
    no: "No",
    unknown: "Not set",
    shortIntro: "Short intro",
    whyLooking: "Why are you looking?",
    strengths: "Strengths as a tenant",
    idReady: "ID ready",
    incomeProofReady: "Income proof ready",
    employerStatementReady: "Employer statement ready",
    bankStatementReady: "Bank statement ready",
    motivationReady: "Motivation ready",
    guarantorAvailable: "Guarantor available",
    save: "Save profile",
    saving: "Saving...",
    saved: "Tenant profile saved.",
    loading: "Loading profile...",
    generate: "Generate message",
    generating: "Generating...",
    copied: "Copied",
    copyButton: "Copy",
    error: "Something went wrong. Please try again.",
    completion: "Profile complete",
  },
);

function inputClass() {
  return "rs-modal-input h-11 px-3 text-sm";
}

function textareaClass() {
  return "rs-modal-input min-h-28 w-full resize-y px-3 py-3 text-sm leading-6";
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rs-card rounded-[1.5rem] p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function BooleanSelect({
  label,
  value,
  language,
  onChange,
}: {
  label: string;
  value: boolean | null;
  language: Language;
  onChange: (next: boolean | null) => void;
}) {
  const c = copy[language];

  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
        {label}
      </span>
      <select
        className={inputClass()}
        value={value === null ? "" : String(value)}
        onChange={(event) => {
          if (event.target.value === "") onChange(null);
          else onChange(event.target.value === "true");
        }}
      >
        <option value="">{c.unknown}</option>
        <option value="true">{c.yes}</option>
        <option value="false">{c.no}</option>
      </select>
    </label>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-text)]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}

export default function TenantProfilePage() {
  const auth = useAuth();
  const { language, changeLanguage } = useLanguagePreference();
  const c = copy[language];
  const assistantCopy = i18n[language].tenantAssistant;
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"login" | "register">("login");
  const [profile, setProfile] = useState<TenantProfile>(emptyTenantProfile);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [style, setStyle] = useState<TenantResponseStyle>("professional");
  const [example, setExample] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!auth.accessToken) {
      setProfile(emptyTenantProfile);
      return;
    }

    setLoading(true);
    void fetchTenantProfile(auth.accessToken)
      .then(setProfile)
      .catch(() => setError(c.error))
      .finally(() => setLoading(false));
  }, [auth.accessToken, c.error]);

  function updateField<K extends keyof TenantProfile>(field: K, value: TenantProfile[K]) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.accessToken) return;

    setSaving(true);
    setMessage("");
    setError("");
    try {
      const saved = await updateTenantProfile(auth.accessToken, profile);
      setProfile(saved);
      setMessage(c.saved);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : c.error);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateExample() {
    if (!auth.accessToken) return;

    setGenerating(true);
    setError("");
    try {
      const generated = await generateTenantProfileExample(auth.accessToken, style);
      setExample(generated.message);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : c.error);
    } finally {
      setGenerating(false);
    }
  }

  async function copyExample() {
    await navigator.clipboard.writeText(example);
    setMessage(c.copied);
  }

  function openAuth(mode: "login" | "register") {
    setModalMode(mode);
    setModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />
      <main>
        <section className="border-b border-[var(--color-border)]">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
            <Link href="/account" className="text-sm font-semibold text-[var(--color-accent-strong)]">
              Account
            </Link>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">{c.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
              {c.intro}
            </p>
          </div>
        </section>

        {!auth.isAuthenticated ? (
          <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="rs-card rounded-[1.5rem] p-6 sm:p-8">
              <h2 className="text-2xl font-semibold">{c.signedOutTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">{c.signedOutBody}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => openAuth("login")} className="rs-primary-button h-11 rounded-lg px-5 text-sm font-semibold">
                  {c.signIn}
                </button>
                <button type="button" onClick={() => openAuth("register")} className="rs-control h-11 rounded-lg px-5 text-sm font-semibold">
                  {c.createAccount}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <form onSubmit={handleSave} className="mx-auto grid max-w-5xl gap-5 px-4 py-10 sm:px-6 lg:px-8">
            <div className="rs-card rounded-[1.5rem] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[var(--color-text)]">
                    {profile.completion_percentage}% {c.completion}
                  </div>
                  <div className="mt-2 h-2 w-64 max-w-full overflow-hidden rounded-full bg-[var(--color-soft)]">
                    <div className="h-full rounded-full bg-[var(--color-teal)]" style={{ width: `${profile.completion_percentage}%` }} />
                  </div>
                </div>
                {loading ? <span className="text-sm text-[var(--color-muted)]">{c.loading}</span> : null}
              </div>
            </div>

            <Section title={c.situation}>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{c.fullName}</span>
                <input className={inputClass()} value={profile.full_name ?? ""} onChange={(event) => updateField("full_name", event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{c.age}</span>
                <input type="number" min="16" max="120" className={inputClass()} value={profile.age ?? ""} onChange={(event) => updateField("age", event.target.value ? Number(event.target.value) : null)} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{c.preferredCity}</span>
                <input className={inputClass()} value={profile.preferred_city ?? ""} onChange={(event) => updateField("preferred_city", event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{c.moveInDate}</span>
                <input className={inputClass()} value={profile.move_in_date ?? ""} onChange={(event) => updateField("move_in_date", event.target.value)} />
              </label>
            </Section>

            <Section title={c.work}>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{c.occupation}</span>
                <input className={inputClass()} value={profile.occupation_or_study ?? ""} onChange={(event) => updateField("occupation_or_study", event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{c.incomeRange}</span>
                <input className={inputClass()} value={profile.monthly_income_range ?? ""} onChange={(event) => updateField("monthly_income_range", event.target.value)} />
              </label>
            </Section>

            <Section title={c.household}>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{c.householdSize}</span>
                <input type="number" min="1" className={inputClass()} value={profile.household_size ?? ""} onChange={(event) => updateField("household_size", event.target.value ? Number(event.target.value) : null)} />
              </label>
              <BooleanSelect label={c.pets} value={profile.pets} language={language} onChange={(next) => updateField("pets", next)} />
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{c.petNotes}</span>
                <input className={inputClass()} value={profile.pet_notes ?? ""} onChange={(event) => updateField("pet_notes", event.target.value)} />
              </label>
              <BooleanSelect label={c.smoker} value={profile.smoker} language={language} onChange={(next) => updateField("smoker", next)} />
            </Section>

            <Section title={c.motivation}>
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{c.shortIntro}</span>
                <textarea className={textareaClass()} value={profile.short_intro ?? ""} onChange={(event) => updateField("short_intro", event.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{c.whyLooking}</span>
                <textarea className={textareaClass()} value={profile.why_looking ?? ""} onChange={(event) => updateField("why_looking", event.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{c.strengths}</span>
                <textarea className={textareaClass()} value={profile.strengths_as_tenant ?? ""} onChange={(event) => updateField("strengths_as_tenant", event.target.value)} />
              </label>
            </Section>

            <Section title={c.checklist}>
              <CheckboxRow label={c.idReady} checked={profile.id_ready} onChange={(next) => updateField("id_ready", next)} />
              <CheckboxRow label={c.incomeProofReady} checked={profile.income_proof_ready} onChange={(next) => updateField("income_proof_ready", next)} />
              <CheckboxRow label={c.employerStatementReady} checked={profile.employer_statement_ready} onChange={(next) => updateField("employer_statement_ready", next)} />
              <CheckboxRow label={c.bankStatementReady} checked={profile.bank_statement_ready} onChange={(next) => updateField("bank_statement_ready", next)} />
              <CheckboxRow label={c.motivationReady} checked={profile.motivation_ready} onChange={(next) => updateField("motivation_ready", next)} />
              <CheckboxRow label={c.guarantorAvailable} checked={profile.guarantor_available} onChange={(next) => updateField("guarantor_available", next)} />
            </Section>

            <section id="voorbeeldreactie" className="rs-card rounded-[1.5rem] p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-text)]">{c.example}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{assistantCopy.editableHint}</p>
                </div>
                <select className="rs-modal-input h-11 px-3 text-sm sm:w-60" value={style} onChange={(event) => setStyle(event.target.value as TenantResponseStyle)}>
                  <option value="short">{assistantCopy.short}</option>
                  <option value="professional">{assistantCopy.professional}</option>
                  <option value="warm">{assistantCopy.warm}</option>
                </select>
              </div>
              <textarea className={`${textareaClass()} mt-5 min-h-56`} value={example} onChange={(event) => setExample(event.target.value)} />
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => void handleGenerateExample()} disabled={generating} className="rs-control h-11 rounded-lg px-5 text-sm font-semibold disabled:opacity-60">
                  {generating ? c.generating : c.generate}
                </button>
                <button type="button" onClick={() => void copyExample()} disabled={!example} className="rs-control h-11 rounded-lg px-5 text-sm font-semibold disabled:opacity-60">
                  {c.copyButton}
                </button>
              </div>
            </section>

            {error ? <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}
            {message ? <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-[var(--color-text)]">{message}</div> : null}

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="rs-primary-button h-12 rounded-lg px-6 text-sm font-semibold disabled:opacity-60">
                {saving ? c.saving : c.save}
              </button>
            </div>
          </form>
        )}
      </main>
      <SiteFooter language={language} />
      <AuthModal
        open={modalOpen}
        initialMode={modalMode}
        language={language}
        onClose={() => setModalOpen(false)}
        onAuthenticated={() => setModalOpen(false)}
      />
    </div>
  );
}
