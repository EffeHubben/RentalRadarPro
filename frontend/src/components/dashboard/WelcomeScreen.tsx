"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ListingFilters, PropertyType } from "@/types/listing";
import { i18n, type Language } from "@/lib/i18n";

type OnboardingValues = Pick<
  ListingFilters,
  | "city"
  | "minPrice"
  | "maxPrice"
  | "noMaxPrice"
  | "propertyTypes"
  | "privateKitchen"
  | "privateBathroom"
  | "privateToilet"
  | "allowShared"
  | "allowSharedLaundry"
>;

const propertyOptions: Array<PropertyType | ""> = ["", "studio", "apartment", "room", "house"];

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1v-9.5z" />
      <path d="M9 21V13h6v8" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <path d="M12 21S5 14.5 5 9a7 7 0 1114 0c0 5.5-7 12-7 12z" />
      <circle cx={12} cy={9} r={2.5} />
    </svg>
  );
}
function IconEuro() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <path d="M17 7A6 6 0 106 12.5" />
      <path d="M4 10.5h8M4 13.5h8" strokeLinecap="round" />
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <rect x={3} y={3} width={18} height={18} rx={2} />
      <path d="M9 21V9h6v12M9 9V3" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <path d="M12 3l8 3.5V12c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6.5L12 3z" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
    </svg>
  );
}

const stepIcons = [IconHome, IconPin, IconEuro, IconBuilding, IconShield, IconSpark];

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between py-3 text-left"
    >
      <span className="text-sm text-[var(--color-text)]">{label}</span>
      <span
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
        }`}
      >
        <motion.span
          animate={{ x: checked ? 16 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
        />
      </span>
    </button>
  );
}

export function WelcomeScreen({
  language,
  initialCity,
  initialMaxRent,
  onStart,
}: {
  language: Language;
  initialCity: string;
  initialMaxRent: string;
  onLanguageChange: (language: Language) => void;
  onStart: (values: OnboardingValues) => void;
}) {
  const copy = i18n[language].onboarding;
  const propertyCopy = i18n[language].propertyTypes;
  const shouldReduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [values, setValues] = useState<OnboardingValues>({
    city: initialCity,
    minPrice: "",
    maxPrice: initialMaxRent,
    noMaxPrice: false,
    propertyTypes: [],
    privateKitchen: null,
    privateBathroom: null,
    privateToilet: null,
    allowShared: true,
    allowSharedLaundry: true,
  });

  useEffect(() => {
    setValues((cur) => ({ ...cur, city: initialCity, maxPrice: initialMaxRent }));
  }, [initialCity, initialMaxRent]);

  const steps = useMemo(
    () => [
      copy.steps.welcome,
      copy.steps.location,
      copy.steps.budget,
      copy.steps.property,
      copy.steps.privacy,
      copy.steps.ready,
    ],
    [copy.steps],
  );

  const progress = (step + 1) / steps.length;

  function update<K extends keyof OnboardingValues>(key: K, value: OnboardingValues[K]) {
    setValues((cur) => ({ ...cur, [key]: value }));
  }

  function togglePropertyType(type: PropertyType | "") {
    if (!type) { update("propertyTypes", []); return; }
    const next = values.propertyTypes.includes(type)
      ? values.propertyTypes.filter((t) => t !== type)
      : [...values.propertyTypes, type];
    update("propertyTypes", next);
  }

  function next() {
    if (step === steps.length - 1) { onStart(values); return; }
    setDirection(1);
    setStep((s) => Math.min(steps.length - 1, s + 1));
  }

  function back() {
    setDirection(-1);
    setStep((s) => Math.max(0, s - 1));
  }

  const selectedTypeLabels = values.propertyTypes.length
    ? values.propertyTypes.map((t) => propertyCopy[t]).join(", ")
    : copy.noPreference;

  const slideVariants = {
    enter: (dir: number) => ({
      x: shouldReduceMotion ? 0 : dir * 36,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: shouldReduceMotion ? 0 : dir * -36,
      opacity: 0,
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
    }),
  };

  const Icon = stepIcons[step];

  return (
    <motion.section
      key="onboarding"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.38, ease: "easeOut" }}
      className="flex min-h-[80vh] items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-[500px]">

        {/* Step dots + counter */}
        <div className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  width: i === step ? 22 : 6,
                  opacity: i < step ? 1 : i === step ? 1 : 0.28,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className={`h-1.5 rounded-full ${
                  i <= step ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-medium text-[var(--color-muted)]">
            {step + 1} / {steps.length}
          </span>
        </div>

        {/* Card */}
        <div className="rs-card relative rounded-3xl p-7 sm:p-9">

          {/* Step icon badge */}
          <motion.div
            key={`icon-${step}`}
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mb-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]"
          >
            <Icon />
          </motion.div>

          {/* Animated step content */}
          <div className="relative min-h-[230px]">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              >

                {/* 0 — Welkom */}
                {step === 0 && (
                  <div className="space-y-4">
                    <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.01em] text-[var(--color-text)] sm:text-[2rem]">
                      {copy.title}
                    </h1>
                    <p className="text-sm leading-6 text-[var(--color-muted)]">
                      {copy.subtitle}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {copy.details.map((d) => (
                        <span key={d} className="rs-chip rounded-full px-3 py-1.5 text-xs font-medium">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 1 — Locatie */}
                {step === 1 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.01em] text-[var(--color-text)]">
                        {copy.locationTitle}
                      </h2>
                      <p className="mt-2 text-sm text-[var(--color-muted)]">{copy.locationHelp}</p>
                    </div>
                    <input
                      autoFocus
                      value={values.city}
                      onChange={(e) => update("city", e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && next()}
                      className="rs-input h-12 w-full"
                      placeholder={copy.cityPlaceholder}
                    />
                  </div>
                )}

                {/* 2 — Budget */}
                {step === 2 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.01em] text-[var(--color-text)]">
                        {copy.budgetTitle}
                      </h2>
                      <p className="mt-2 text-sm text-[var(--color-muted)]">{copy.budgetHelp}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
                          {copy.minRent}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={values.minPrice}
                          onChange={(e) => update("minPrice", e.target.value)}
                          className="rs-input h-12 w-full"
                          placeholder="€ 0"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
                          {copy.maxRent}
                        </label>
                        <input
                          type="number"
                          min="0"
                          disabled={values.noMaxPrice}
                          value={values.maxPrice}
                          onChange={(e) => update("maxPrice", e.target.value)}
                          className="rs-input h-12 w-full disabled:opacity-40"
                          placeholder="€ 1500"
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4">
                      <Toggle
                        label={copy.noMaxPrice}
                        checked={values.noMaxPrice}
                        onChange={(v) => update("noMaxPrice", v)}
                      />
                    </div>
                  </div>
                )}

                {/* 3 — Woningtype */}
                {step === 3 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.01em] text-[var(--color-text)]">
                        {copy.propertyTitle}
                      </h2>
                      <p className="mt-2 text-sm text-[var(--color-muted)]">{copy.propertyHelp}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {propertyOptions.map((type) => {
                        const active = type
                          ? values.propertyTypes.includes(type)
                          : values.propertyTypes.length === 0;
                        const label = type ? propertyCopy[type] : copy.allTypes;
                        return (
                          <motion.button
                            key={type || "all"}
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            onClick={() => togglePropertyType(type)}
                            className={`rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold transition ${
                              active
                                ? "rs-chip-active"
                                : "rs-control text-[var(--color-muted)] hover:border-[var(--color-border-strong)]"
                            }`}
                          >
                            {label}
                            {!type && (
                              <div className="mt-0.5 text-xs font-normal opacity-55">
                                {copy.allTypesHint}
                              </div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4 — Privacy */}
                {step === 4 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.01em] text-[var(--color-text)]">
                        {copy.privacyTitle}
                      </h2>
                      <p className="mt-2 text-sm text-[var(--color-muted)]">{copy.privacyHelp}</p>
                    </div>
                    <div className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4">
                      <Toggle
                        label={copy.privateKitchen}
                        checked={values.privateKitchen === true}
                        onChange={(v) => update("privateKitchen", v ? true : null)}
                      />
                      <Toggle
                        label={copy.privateBathroom}
                        checked={values.privateBathroom === true}
                        onChange={(v) => update("privateBathroom", v ? true : null)}
                      />
                      <Toggle
                        label={copy.privateToilet}
                        checked={values.privateToilet === true}
                        onChange={(v) => update("privateToilet", v ? true : null)}
                      />
                      <Toggle
                        label={copy.allowShared}
                        checked={values.allowShared}
                        onChange={(v) => update("allowShared", v)}
                      />
                    </div>
                    <p className="text-xs leading-5 text-[var(--color-subtle)]">
                      {copy.privacyApartmentNote}
                    </p>
                  </div>
                )}

                {/* 5 — Klaar */}
                {step === 5 && (
                  <div className="space-y-5">
                    <h2 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.01em] text-[var(--color-text)]">
                      {copy.readyTitle}
                    </h2>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        [copy.city, values.city || copy.any],
                        [
                          copy.budget,
                          values.noMaxPrice
                            ? copy.noMaxPrice
                            : values.maxPrice
                              ? `tot € ${values.maxPrice}`
                              : copy.any,
                        ],
                        [copy.privacy, values.allowShared ? copy.sharedAllowed : copy.sharedExcluded],
                        [copy.propertyType, selectedTypeLabels],
                      ].map(([label, value]) => (
                        <motion.div
                          key={label}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.22, delay: 0.06 }}
                          className="rounded-2xl bg-[var(--color-soft)] p-4"
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                            {label}
                          </div>
                          <div className="mt-1.5 text-sm font-semibold leading-snug text-[var(--color-text)]">
                            {value}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={back}
              disabled={step === 0}
              className="h-10 rounded-xl px-4 text-sm font-medium text-[var(--color-muted)] transition hover:text-[var(--color-text)] disabled:pointer-events-none disabled:opacity-0"
            >
              {copy.back}
            </motion.button>

            <motion.button
              type="button"
              whileHover={shouldReduceMotion ? undefined : { scale: 1.025 }}
              whileTap={{ scale: 0.97 }}
              onClick={next}
              className="rs-primary-button h-11 rounded-xl px-7 text-sm font-semibold"
            >
              {step === steps.length - 1 ? copy.start : copy.next}
            </motion.button>
          </div>
        </div>

        {/* Thin progress bar below card */}
        <div className="mt-4 h-0.5 overflow-hidden rounded-full bg-[var(--color-soft)]">
          <motion.div
            className="h-full rounded-full bg-[var(--color-accent)]"
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 180, damping: 28 }}
          />
        </div>
      </div>
    </motion.section>
  );
}
