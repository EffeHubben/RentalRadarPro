"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { LocationAutocomplete } from "@/components/dashboard/LocationAutocomplete";
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

type OccupationValue =
  | ""
  | "employed"
  | "student"
  | "working-student"
  | "self-employed"
  | "job-seeking"
  | "other";
type IncomeValue =
  | ""
  | "skip"
  | "lt1500"
  | "1500-2000"
  | "2000-2500"
  | "2500-3000"
  | "3000-4000"
  | "gt4000"
  | "joint"
  | "custom";
type MoveInValue = "" | "asap" | "1m" | "2m" | "3m" | "flex" | "specific-date" | "custom";

type ValidationErrors = Partial<Record<"age" | "household_size" | "move_in_date", string>>;

type LocalizedOption<T extends string> = {
  value: T;
  nl: string;
  en: string;
};

const OCCUPATION_OPTIONS: LocalizedOption<Exclude<OccupationValue, "">>[] = [
  { value: "employed", nl: "Werkend", en: "Employed" },
  { value: "student", nl: "Student", en: "Student" },
  { value: "working-student", nl: "Werkstudent", en: "Working student" },
  { value: "self-employed", nl: "Zelfstandig ondernemer", en: "Self-employed" },
  { value: "job-seeking", nl: "Zoekend naar werk", en: "Looking for work" },
  { value: "other", nl: "Anders", en: "Other" },
];

const INCOME_OPTIONS: LocalizedOption<Exclude<IncomeValue, "" | "custom">>[] = [
  { value: "skip", nl: "Niet invullen", en: "Prefer not to say" },
  { value: "lt1500", nl: "Minder dan EUR 1.500", en: "Less than EUR 1,500" },
  { value: "1500-2000", nl: "EUR 1.500 - EUR 2.000", en: "EUR 1,500 - EUR 2,000" },
  { value: "2000-2500", nl: "EUR 2.000 - EUR 2.500", en: "EUR 2,000 - EUR 2,500" },
  { value: "2500-3000", nl: "EUR 2.500 - EUR 3.000", en: "EUR 2,500 - EUR 3,000" },
  { value: "3000-4000", nl: "EUR 3.000 - EUR 4.000", en: "EUR 3,000 - EUR 4,000" },
  { value: "gt4000", nl: "Meer dan EUR 4.000", en: "More than EUR 4,000" },
  { value: "joint", nl: "Gezamenlijk inkomen", en: "Combined household income" },
];

const MOVE_IN_OPTIONS: LocalizedOption<Exclude<MoveInValue, "" | "custom">>[] = [
  { value: "asap", nl: "Per direct", en: "Immediately" },
  { value: "1m", nl: "Binnen 1 maand", en: "Within 1 month" },
  { value: "2m", nl: "Binnen 2 maanden", en: "Within 2 months" },
  { value: "3m", nl: "Binnen 3 maanden", en: "Within 3 months" },
  { value: "flex", nl: "Flexibel", en: "Flexible" },
  { value: "specific-date", nl: "Specifieke datum", en: "Specific date" },
];

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
    situationDescription: "Je basisgegevens helpen bij een nette en persoonlijke woningreactie.",
    work: "Werk/studie",
    workDescription: "Kies je situatie en voeg extra context toe als dat helpt.",
    household: "Huishouden",
    householdDescription: "Vul dit rustig in zodat je reactie duidelijk en consistent blijft.",
    motivation: "Intro en motivatie",
    motivationDescription: "Deze teksten vormen de kern van je motivatiebericht.",
    checklist: "Documenten-checklist",
    checklistDescription:
      "We slaan geen documenten op. Dit is alleen een checklist voor jezelf.",
    example: "Voorbeeldreactie",
    fullName: "Naam",
    fullNamePlaceholder: "Bijv. Sam de Vries",
    age: "Leeftijd",
    agePlaceholder: "Bijv. 24",
    ageHelper: "Alleen voor context in je reactie.",
    ageError: "Vul een leeftijd tussen 18 en 100 jaar in.",
    preferredCity: "Gewenste stad",
    preferredCityPlaceholder: "Bijv. Breda, Tilburg of Rotterdam",
    moveInDate: "Verhuisdatum",
    moveInHelper: "Kies wanneer je ongeveer wilt verhuizen.",
    moveInCustomLabel: "Eigen verhuismoment",
    moveInCustomPlaceholder: "Bijv. Rond september, in overleg",
    moveInDateError: "Kies een specifieke datum of selecteer een andere optie.",
    occupation: "Werk of studie",
    occupationType: "Situatie",
    occupationDetail: "Toelichting werk/studie",
    occupationDetailPlaceholder: "Bijv. Vast contract in zorg, 32 uur per week",
    incomeRange: "Inkomensrange (optioneel)",
    incomeHelper: "Indicatief en optioneel. Geen documenten nodig.",
    incomeUnknown: "Nog niet gekozen",
    incomeCustom: "Bestaande vrije tekst",
    householdSize: "Huishoudgrootte",
    householdSizePlaceholder: "Bijv. 1",
    householdSizeError: "Vul een huishoudgrootte tussen 1 en 10 in.",
    pets: "Huisdieren",
    petNotes: "Toelichting huisdieren",
    petNotesPlaceholder: "Bijv. 1 rustige binnenkat, zindelijk",
    smoker: "Roker",
    yes: "Ja",
    no: "Nee",
    unknown: "Niet ingevuld",
    shortIntro: "Korte intro",
    shortIntroPlaceholder:
      "Bijv. Ik ben een rustige en nette huurder en zoek een fijne woning in Breda.",
    whyLooking: "Waarom zoek je een woning?",
    whyLookingPlaceholder: "Bijv. Ik zoek een woning dichter bij mijn werk/studie.",
    strengths: "Sterke punten als huurder",
    strengthsPlaceholder:
      "Bijv. netjes, betrouwbaar, snelle communicatie, documenten op orde.",
    strengthChipsLabel: "Snelle toevoegingen",
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
    copyButton: "Kopieren",
    error: "Er ging iets mis. Probeer het opnieuw.",
    completion: "Profiel compleet",
    completionHint: "Een vollediger profiel geeft vaak sterkere reacties.",
    saveTop: "Opslaan",
    saveBottom: "Opslaan en bijwerken",
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
    situationDescription: "Your basics help keep each rental response personal and clear.",
    work: "Work/study",
    workDescription: "Pick your current situation and add optional context.",
    household: "Household",
    householdDescription: "Use this to keep your profile and responses consistent.",
    motivation: "Intro and motivation",
    motivationDescription: "These fields shape the core of your message.",
    checklist: "Document checklist",
    checklistDescription:
      "We do not store documents. This is only a personal checklist.",
    example: "Example response",
    fullName: "Name",
    fullNamePlaceholder: "E.g. Alex Johnson",
    age: "Age",
    agePlaceholder: "E.g. 24",
    ageHelper: "Only used as context in your message.",
    ageError: "Please enter an age between 18 and 100.",
    preferredCity: "Preferred city",
    preferredCityPlaceholder: "E.g. Breda, Tilburg or Rotterdam",
    moveInDate: "Move-in date",
    moveInHelper: "Choose when you plan to move.",
    moveInCustomLabel: "Custom move-in timing",
    moveInCustomPlaceholder: "E.g. Around September, flexible",
    moveInDateError: "Choose a specific date or select another option.",
    occupation: "Work or study",
    occupationType: "Current status",
    occupationDetail: "Work/study details",
    occupationDetailPlaceholder: "E.g. Full-time role in healthcare, permanent contract",
    incomeRange: "Income range (optional)",
    incomeHelper: "Optional and indicative. No document uploads required.",
    incomeUnknown: "Not selected yet",
    incomeCustom: "Existing custom text",
    householdSize: "Household size",
    householdSizePlaceholder: "E.g. 1",
    householdSizeError: "Please enter a household size between 1 and 10.",
    pets: "Pets",
    petNotes: "Pet notes",
    petNotesPlaceholder: "E.g. 1 calm indoor cat, house trained",
    smoker: "Smoker",
    yes: "Yes",
    no: "No",
    unknown: "Not set",
    shortIntro: "Short intro",
    shortIntroPlaceholder:
      "E.g. I am a calm and tidy tenant looking for a nice home in Breda.",
    whyLooking: "Why are you looking?",
    whyLookingPlaceholder: "E.g. I am looking for a home closer to work/study.",
    strengths: "Strengths as a tenant",
    strengthsPlaceholder:
      "E.g. tidy, reliable, quick communication, documents prepared.",
    strengthChipsLabel: "Quick add",
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
    completionHint: "A more complete profile usually creates stronger messages.",
    saveTop: "Save",
    saveBottom: "Save and update",
  },
);

const strengthChips = languageRecord(
  [
    "Rustig",
    "Netjes",
    "Betrouwbaar",
    "Niet-roker",
    "Geen huisdieren",
    "Stabiel inkomen",
    "Documenten klaar",
    "Flexibel met bezichtigingen",
  ],
  [
    "Calm",
    "Tidy",
    "Reliable",
    "Non-smoker",
    "No pets",
    "Stable income",
    "Documents ready",
    "Flexible with viewings",
  ],
);

function inputClass() {
  return "rs-modal-input h-11 px-3 text-sm";
}

function textareaClass() {
  return "rs-modal-input min-h-28 w-full resize-y px-3 py-3 text-sm leading-6";
}

function fieldLabelClass() {
  return "mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]";
}

function helperClass() {
  return "mt-1.5 text-xs text-[var(--color-muted)]";
}

function errorClass() {
  return "mt-1.5 text-xs font-medium text-danger";
}

function toOptionLabel(option: LocalizedOption<string>, language: Language) {
  return language === "nl" ? option.nl : option.en;
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function parseOccupation(value: string | null): { type: OccupationValue; detail: string } {
  const raw = value?.trim() ?? "";
  if (!raw) return { type: "", detail: "" };

  for (const option of OCCUPATION_OPTIONS) {
    const nl = option.nl.toLowerCase();
    const en = option.en.toLowerCase();
    const normalized = raw.toLowerCase();
    if (normalized === nl || normalized === en) {
      return { type: option.value, detail: "" };
    }
    if (normalized.startsWith(`${nl}:`) || normalized.startsWith(`${nl} -`)) {
      return { type: option.value, detail: raw.slice(option.nl.length + 1).replace(/^\s*[-:]\s*/, "") };
    }
    if (normalized.startsWith(`${en}:`) || normalized.startsWith(`${en} -`)) {
      return { type: option.value, detail: raw.slice(option.en.length + 1).replace(/^\s*[-:]\s*/, "") };
    }
  }

  return { type: "other", detail: raw };
}

function parseIncome(value: string | null): { selection: IncomeValue; customValue: string } {
  const raw = value?.trim() ?? "";
  if (!raw) return { selection: "", customValue: "" };

  for (const option of INCOME_OPTIONS) {
    if (normalizeValue(raw) === normalizeValue(option.nl) || normalizeValue(raw) === normalizeValue(option.en)) {
      return { selection: option.value, customValue: "" };
    }
  }

  return { selection: "custom", customValue: raw };
}

function parseMoveIn(value: string | null): { selection: MoveInValue; specificDate: string; customValue: string } {
  const raw = value?.trim() ?? "";
  if (!raw) return { selection: "", specificDate: "", customValue: "" };
  if (isIsoDate(raw)) return { selection: "specific-date", specificDate: raw, customValue: "" };

  for (const option of MOVE_IN_OPTIONS) {
    if (normalizeValue(raw) === normalizeValue(option.nl) || normalizeValue(raw) === normalizeValue(option.en)) {
      return { selection: option.value, specificDate: "", customValue: "" };
    }
  }

  return { selection: "custom", specificDate: "", customValue: raw };
}

function serializeOccupation(type: OccupationValue, detail: string, language: Language) {
  if (!type) return null;
  const option = OCCUPATION_OPTIONS.find((item) => item.value === type);
  const label = option ? toOptionLabel(option, language) : detail.trim();
  if (!label) return null;
  const detailValue = detail.trim();
  if (!detailValue) return label;
  if (normalizeValue(detailValue) === normalizeValue(label)) return label;
  return `${label}: ${detailValue}`;
}

function serializeIncome(selection: IncomeValue, customValue: string, language: Language) {
  if (!selection || selection === "skip") return null;
  if (selection === "custom") return customValue.trim() || null;
  const option = INCOME_OPTIONS.find((item) => item.value === selection);
  return option ? toOptionLabel(option, language) : null;
}

function serializeMoveIn(selection: MoveInValue, specificDate: string, customValue: string, language: Language) {
  if (!selection) return null;
  if (selection === "specific-date") return specificDate || null;
  if (selection === "custom") return customValue.trim() || null;
  const option = MOVE_IN_OPTIONS.find((item) => item.value === selection);
  return option ? toOptionLabel(option, language) : null;
}

function valuePresent(value: string | null | undefined) {
  return !!value?.trim();
}

function getCompletionPercentage(profile: TenantProfile) {
  const checks: boolean[] = [];

  checks.push(valuePresent(profile.full_name));
  checks.push(profile.age !== null && profile.age >= 18 && profile.age <= 100);
  checks.push(valuePresent(profile.preferred_city));
  checks.push(valuePresent(profile.move_in_date));
  checks.push(valuePresent(profile.occupation_or_study));
  checks.push(true);
  checks.push(profile.household_size !== null && profile.household_size >= 1 && profile.household_size <= 10);
  checks.push(profile.pets !== null);
  checks.push(profile.smoker !== null);
  checks.push(valuePresent(profile.short_intro));
  checks.push(valuePresent(profile.why_looking));
  checks.push(valuePresent(profile.strengths_as_tenant));
  checks.push(profile.id_ready);
  checks.push(profile.income_proof_ready);
  checks.push(profile.employer_statement_ready);
  checks.push(profile.bank_statement_ready);
  checks.push(profile.motivation_ready);
  checks.push(profile.guarantor_available);

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

function validateProfile(
  profile: TenantProfile,
  moveInSelection: MoveInValue,
  specificMoveInDate: string,
  moveInCustomValue: string,
  c: (typeof copy)["nl"],
): ValidationErrors {
  const nextErrors: ValidationErrors = {};

  if (profile.age !== null && (profile.age < 18 || profile.age > 100)) {
    nextErrors.age = c.ageError;
  }

  if (
    profile.household_size !== null &&
    (profile.household_size < 1 || profile.household_size > 10)
  ) {
    nextErrors.household_size = c.householdSizeError;
  }

  if (moveInSelection === "specific-date" && !specificMoveInDate) {
    nextErrors.move_in_date = c.moveInDateError;
  }

  if (moveInSelection === "custom" && !moveInCustomValue.trim()) {
    nextErrors.move_in_date = c.moveInDateError;
  }

  return nextErrors;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rs-card rounded-[1.5rem] p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">{description}</p>
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
      <span className={fieldLabelClass()}>{label}</span>
      <select
        className={inputClass()}
        value={value === null ? "" : String(value)}
        onChange={(event) => {
          if (event.target.value === "") onChange(null);
          else onChange(event.target.value === "true");
        }}
      >
        <option value="">{c.unknown}</option>
        <option value="false">{c.no}</option>
        <option value="true">{c.yes}</option>
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
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const [occupationType, setOccupationType] = useState<OccupationValue>("");
  const [occupationDetail, setOccupationDetail] = useState("");
  const [incomeSelection, setIncomeSelection] = useState<IncomeValue>("");
  const [incomeCustomValue, setIncomeCustomValue] = useState("");
  const [moveInSelection, setMoveInSelection] = useState<MoveInValue>("");
  const [specificMoveInDate, setSpecificMoveInDate] = useState("");
  const [moveInCustomValue, setMoveInCustomValue] = useState("");

  useEffect(() => {
    if (!auth.accessToken) {
      setProfile(emptyTenantProfile);
      setValidationErrors({});
      setOccupationType("");
      setOccupationDetail("");
      setIncomeSelection("");
      setIncomeCustomValue("");
      setMoveInSelection("");
      setSpecificMoveInDate("");
      setMoveInCustomValue("");
      return;
    }

    setLoading(true);
    void fetchTenantProfile(auth.accessToken)
      .then((nextProfile) => {
        setProfile(nextProfile);
        setError("");
      })
      .catch(() => setError(c.error))
      .finally(() => setLoading(false));
  }, [auth.accessToken, c.error]);

  useEffect(() => {
    const parsedOccupation = parseOccupation(profile.occupation_or_study);
    setOccupationType(parsedOccupation.type);
    setOccupationDetail(parsedOccupation.detail);

    const parsedIncome = parseIncome(profile.monthly_income_range);
    setIncomeSelection(parsedIncome.selection);
    setIncomeCustomValue(parsedIncome.customValue);

    const parsedMoveIn = parseMoveIn(profile.move_in_date);
    setMoveInSelection(parsedMoveIn.selection);
    setSpecificMoveInDate(parsedMoveIn.specificDate);
    setMoveInCustomValue(parsedMoveIn.customValue);
  }, [profile.occupation_or_study, profile.monthly_income_range, profile.move_in_date]);

  const completionPercentage = useMemo(() => getCompletionPercentage(profile), [profile]);

  function updateField<K extends keyof TenantProfile>(field: K, value: TenantProfile[K]) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function updateAge(value: string) {
    updateField("age", value ? Number(value) : null);
    setValidationErrors((current) => {
      const next = { ...current };
      delete next.age;
      return next;
    });
  }

  function updateHouseholdSize(value: string) {
    updateField("household_size", value ? Number(value) : null);
    setValidationErrors((current) => {
      const next = { ...current };
      delete next.household_size;
      return next;
    });
  }

  function applyOccupation(nextType: OccupationValue, nextDetail: string) {
    setOccupationType(nextType);
    setOccupationDetail(nextDetail);
    updateField("occupation_or_study", serializeOccupation(nextType, nextDetail, language));
  }

  function applyIncome(nextSelection: IncomeValue, nextCustomValue: string) {
    setIncomeSelection(nextSelection);
    setIncomeCustomValue(nextCustomValue);
    updateField("monthly_income_range", serializeIncome(nextSelection, nextCustomValue, language));
  }

  function applyMoveIn(nextSelection: MoveInValue, nextDate: string, nextCustomValue: string) {
    setMoveInSelection(nextSelection);
    setSpecificMoveInDate(nextDate);
    setMoveInCustomValue(nextCustomValue);
    updateField("move_in_date", serializeMoveIn(nextSelection, nextDate, nextCustomValue, language));
    setValidationErrors((current) => {
      const next = { ...current };
      delete next.move_in_date;
      return next;
    });
  }

  function appendStrengthChip(chip: string) {
    const existing = (profile.strengths_as_tenant ?? "").trim();
    if (!existing) {
      updateField("strengths_as_tenant", chip);
      return;
    }

    const values = existing
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean);
    const duplicate = values.some((value) => normalizeValue(value) === normalizeValue(chip));
    if (duplicate) return;
    updateField("strengths_as_tenant", `${existing}, ${chip}`);
  }

  function runValidation(nextProfile: TenantProfile) {
    const nextErrors = validateProfile(
      nextProfile,
      moveInSelection,
      specificMoveInDate,
      moveInCustomValue,
      c,
    );
    setValidationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.accessToken) return;

    if (!runValidation(profile)) return;

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
          <form
            onSubmit={handleSave}
            className="mx-auto grid max-w-5xl gap-5 px-4 py-10 pb-16 sm:px-6 lg:px-8"
          >
            <div className="rs-card rounded-[1.5rem] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-[var(--color-text)]">
                      {completionPercentage}% {c.completion}
                    </div>
                    {message ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                        {message}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 h-2.5 w-full max-w-md overflow-hidden rounded-full bg-[var(--color-soft)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-teal)] transition-all"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                  <p className={helperClass()}>{c.completionHint}</p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  {loading ? <span className="text-sm text-[var(--color-muted)]">{c.loading}</span> : null}
                  <button
                    type="submit"
                    disabled={saving || loading}
                    className="rs-primary-button h-11 rounded-lg px-5 text-sm font-semibold disabled:opacity-60"
                  >
                    {saving ? c.saving : c.saveTop}
                  </button>
                </div>
              </div>
            </div>

            <fieldset disabled={saving || loading} className="grid gap-5">
              <Section title={c.situation} description={c.situationDescription}>
                <label className="block">
                  <span className={fieldLabelClass()}>{c.fullName}</span>
                  <input
                    className={inputClass()}
                    placeholder={c.fullNamePlaceholder}
                    value={profile.full_name ?? ""}
                    onChange={(event) => updateField("full_name", event.target.value)}
                  />
                </label>

                <label className="block">
                  <span className={fieldLabelClass()}>{c.age}</span>
                  <input
                    type="number"
                    min={18}
                    max={100}
                    className={inputClass()}
                    placeholder={c.agePlaceholder}
                    value={profile.age ?? ""}
                    onChange={(event) => updateAge(event.target.value)}
                    aria-invalid={Boolean(validationErrors.age)}
                  />
                  <p className={helperClass()}>{c.ageHelper}</p>
                  {validationErrors.age ? <p className={errorClass()}>{validationErrors.age}</p> : null}
                </label>

                <label className="block sm:col-span-2">
                  <span className={fieldLabelClass()}>{c.preferredCity}</span>
                  <LocationAutocomplete
                    value={profile.preferred_city ?? ""}
                    language={language}
                    onSelect={(suggestion) => updateField("preferred_city", suggestion.label)}
                    onClear={() => updateField("preferred_city", null)}
                  />
                  <p className={helperClass()}>{c.preferredCityPlaceholder}</p>
                </label>

                <label className="block sm:col-span-2">
                  <span className={fieldLabelClass()}>{c.moveInDate}</span>
                  <select
                    className={inputClass()}
                    value={moveInSelection}
                    onChange={(event) =>
                      applyMoveIn(event.target.value as MoveInValue, specificMoveInDate, moveInCustomValue)
                    }
                  >
                    <option value="">{c.unknown}</option>
                    {MOVE_IN_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {toOptionLabel(option, language)}
                      </option>
                    ))}
                    {moveInSelection === "custom" ? (
                      <option value="custom">{c.moveInCustomLabel}</option>
                    ) : null}
                  </select>
                  <p className={helperClass()}>{c.moveInHelper}</p>
                  {moveInSelection === "specific-date" ? (
                    <input
                      type="date"
                      className={`${inputClass()} mt-3`}
                      value={specificMoveInDate}
                      onChange={(event) =>
                        applyMoveIn("specific-date", event.target.value, moveInCustomValue)
                      }
                    />
                  ) : null}
                  {moveInSelection === "custom" ? (
                    <input
                      className={`${inputClass()} mt-3`}
                      value={moveInCustomValue}
                      placeholder={c.moveInCustomPlaceholder}
                      onChange={(event) =>
                        applyMoveIn("custom", specificMoveInDate, event.target.value)
                      }
                    />
                  ) : null}
                  {validationErrors.move_in_date ? (
                    <p className={errorClass()}>{validationErrors.move_in_date}</p>
                  ) : null}
                </label>
              </Section>

              <Section title={c.work} description={c.workDescription}>
                <label className="block">
                  <span className={fieldLabelClass()}>{c.occupationType}</span>
                  <select
                    className={inputClass()}
                    value={occupationType}
                    onChange={(event) =>
                      applyOccupation(event.target.value as OccupationValue, occupationDetail)
                    }
                  >
                    <option value="">{c.unknown}</option>
                    {OCCUPATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {toOptionLabel(option, language)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className={fieldLabelClass()}>{c.incomeRange}</span>
                  <select
                    className={inputClass()}
                    value={incomeSelection}
                    onChange={(event) =>
                      applyIncome(event.target.value as IncomeValue, incomeCustomValue)
                    }
                  >
                    <option value="">{c.incomeUnknown}</option>
                    {INCOME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {toOptionLabel(option, language)}
                      </option>
                    ))}
                    {incomeSelection === "custom" ? (
                      <option value="custom">{c.incomeCustom}</option>
                    ) : null}
                  </select>
                  <p className={helperClass()}>{c.incomeHelper}</p>
                </label>

                {(occupationType || occupationDetail) && (
                  <label className="block sm:col-span-2">
                    <span className={fieldLabelClass()}>{c.occupationDetail}</span>
                    <input
                      className={inputClass()}
                      value={occupationDetail}
                      placeholder={c.occupationDetailPlaceholder}
                      onChange={(event) =>
                        applyOccupation(occupationType || "other", event.target.value)
                      }
                    />
                  </label>
                )}

                {incomeSelection === "custom" ? (
                  <label className="block sm:col-span-2">
                    <span className={fieldLabelClass()}>{c.incomeCustom}</span>
                    <input
                      className={inputClass()}
                      value={incomeCustomValue}
                      onChange={(event) =>
                        applyIncome("custom", event.target.value)
                      }
                    />
                  </label>
                ) : null}
              </Section>

              <Section title={c.household} description={c.householdDescription}>
                <label className="block">
                  <span className={fieldLabelClass()}>{c.householdSize}</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className={inputClass()}
                    placeholder={c.householdSizePlaceholder}
                    value={profile.household_size ?? ""}
                    onChange={(event) => updateHouseholdSize(event.target.value)}
                    aria-invalid={Boolean(validationErrors.household_size)}
                  />
                  {validationErrors.household_size ? (
                    <p className={errorClass()}>{validationErrors.household_size}</p>
                  ) : null}
                </label>

                <BooleanSelect
                  label={c.pets}
                  value={profile.pets}
                  language={language}
                  onChange={(next) => {
                    updateField("pets", next);
                    if (next !== true) updateField("pet_notes", null);
                  }}
                />

                {profile.pets === true ? (
                  <label className="block sm:col-span-2">
                    <span className={fieldLabelClass()}>{c.petNotes}</span>
                    <input
                      className={inputClass()}
                      placeholder={c.petNotesPlaceholder}
                      value={profile.pet_notes ?? ""}
                      onChange={(event) => updateField("pet_notes", event.target.value)}
                    />
                  </label>
                ) : null}

                <BooleanSelect
                  label={c.smoker}
                  value={profile.smoker}
                  language={language}
                  onChange={(next) => updateField("smoker", next)}
                />
              </Section>

              <Section title={c.motivation} description={c.motivationDescription}>
                <label className="block sm:col-span-2">
                  <span className={fieldLabelClass()}>{c.shortIntro}</span>
                  <textarea
                    className={textareaClass()}
                    placeholder={c.shortIntroPlaceholder}
                    value={profile.short_intro ?? ""}
                    onChange={(event) => updateField("short_intro", event.target.value)}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className={fieldLabelClass()}>{c.whyLooking}</span>
                  <textarea
                    className={textareaClass()}
                    placeholder={c.whyLookingPlaceholder}
                    value={profile.why_looking ?? ""}
                    onChange={(event) => updateField("why_looking", event.target.value)}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className={fieldLabelClass()}>{c.strengths}</span>
                  <textarea
                    className={textareaClass()}
                    placeholder={c.strengthsPlaceholder}
                    value={profile.strengths_as_tenant ?? ""}
                    onChange={(event) => updateField("strengths_as_tenant", event.target.value)}
                  />
                </label>
                <div className="sm:col-span-2">
                  <span className={fieldLabelClass()}>{c.strengthChipsLabel}</span>
                  <div className="flex flex-wrap gap-2">
                    {strengthChips[language].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => appendStrengthChip(chip)}
                        className="rs-control h-9 rounded-full px-3 text-xs font-semibold"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              <Section title={c.checklist} description={c.checklistDescription}>
                <CheckboxRow
                  label={c.idReady}
                  checked={profile.id_ready}
                  onChange={(next) => updateField("id_ready", next)}
                />
                <CheckboxRow
                  label={c.incomeProofReady}
                  checked={profile.income_proof_ready}
                  onChange={(next) => updateField("income_proof_ready", next)}
                />
                <CheckboxRow
                  label={c.employerStatementReady}
                  checked={profile.employer_statement_ready}
                  onChange={(next) => updateField("employer_statement_ready", next)}
                />
                <CheckboxRow
                  label={c.bankStatementReady}
                  checked={profile.bank_statement_ready}
                  onChange={(next) => updateField("bank_statement_ready", next)}
                />
                <CheckboxRow
                  label={c.motivationReady}
                  checked={profile.motivation_ready}
                  onChange={(next) => updateField("motivation_ready", next)}
                />
                <CheckboxRow
                  label={c.guarantorAvailable}
                  checked={profile.guarantor_available}
                  onChange={(next) => updateField("guarantor_available", next)}
                />
              </Section>

              <section id="voorbeeldreactie" className="rs-card rounded-[1.5rem] p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">{c.example}</h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                      {assistantCopy.editableHint}
                    </p>
                  </div>
                  <select
                    className="rs-modal-input h-11 px-3 text-sm sm:w-60"
                    value={style}
                    onChange={(event) => setStyle(event.target.value as TenantResponseStyle)}
                  >
                    <option value="short">{assistantCopy.short}</option>
                    <option value="professional">{assistantCopy.professional}</option>
                    <option value="warm">{assistantCopy.warm}</option>
                  </select>
                </div>
                <textarea
                  className={`${textareaClass()} mt-5 min-h-56`}
                  value={example}
                  onChange={(event) => setExample(event.target.value)}
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleGenerateExample()}
                    disabled={generating}
                    className="rs-control h-11 rounded-lg px-5 text-sm font-semibold disabled:opacity-60"
                  >
                    {generating ? c.generating : c.generate}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyExample()}
                    disabled={!example}
                    className="rs-control h-11 rounded-lg px-5 text-sm font-semibold disabled:opacity-60"
                  >
                    {c.copyButton}
                  </button>
                </div>
              </section>
            </fieldset>

            {error ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || loading}
                className="rs-primary-button h-12 rounded-lg px-6 text-sm font-semibold disabled:opacity-60"
              >
                {saving ? c.saving : c.saveBottom}
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
