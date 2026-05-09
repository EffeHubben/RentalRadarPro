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

const propertyOptions: Array<PropertyType | ""> = [
  "",
  "studio",
  "apartment",
  "room",
  "house",
];
const selectablePropertyTypes: PropertyType[] = ["studio", "apartment", "room", "house"];

function inputClass() {
  return "rs-input h-12";
}

function ToggleCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
        checked
          ? "rs-chip-active"
          : "rs-control text-[var(--color-muted)]"
      }`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full border transition ${
          checked
            ? "border-[var(--color-teal)] bg-[var(--color-teal)]"
            : "border-[var(--color-border)] bg-[var(--color-soft)]"
        }`}
      >
        <motion.span
          animate={{ x: checked ? 20 : 0 }}
          className="absolute left-1 top-1 h-4 w-4 rounded-full bg-[var(--color-surface)] shadow"
        />
      </span>
    </motion.button>
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
    setValues((current) => ({
      ...current,
      city: initialCity,
      maxPrice: initialMaxRent,
    }));
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
  const progress = ((step + 1) / steps.length) * 100;
  const selectedTypeLabels = values.propertyTypes.length
    ? values.propertyTypes.map((type) => propertyCopy[type]).join(", ")
    : copy.noPreference;

  function update<K extends keyof OnboardingValues>(key: K, value: OnboardingValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function togglePropertyType(type: PropertyType | "") {
    if (!type) {
      update("propertyTypes", []);
      return;
    }

    const nextTypes = values.propertyTypes.includes(type)
      ? values.propertyTypes.filter((selectedType) => selectedType !== type)
      : [...values.propertyTypes, type];

    update("propertyTypes", nextTypes);
  }

  function next() {
    if (step === steps.length - 1) {
      onStart(values);
      return;
    }

    setStep((current) => Math.min(steps.length - 1, current + 1));
  }

  function back() {
    setStep((current) => Math.max(0, current - 1));
  }

  return (
    <motion.section
      key="onboarding"
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="relative isolate px-0 py-2 sm:py-4"
    >
      <div className="relative mx-auto w-full max-w-5xl">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem]">
          <motion.div
            className="rs-card relative overflow-hidden rounded-2xl p-5 sm:p-7"
            initial={false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", damping: 24, stiffness: 150 }}
          >
            <div className="mb-6">
              <div className="mb-3 flex gap-2" aria-label={copy.searchSetupProgress}>
                {steps.map((label, index) => (
                  <motion.button
                    key={label}
                    type="button"
                    aria-label={label}
                    onClick={() => setStep(index)}
                    className={`h-2 rounded-full transition ${
                      index <= step ? "bg-[var(--color-accent)]" : "bg-[var(--color-soft)]"
                    }`}
                    animate={{ width: index === step ? 34 : 14 }}
                  />
                ))}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-soft)]">
                <motion.div
                  className="h-full rounded-full bg-[var(--color-accent)]"
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", damping: 24, stiffness: 160 }}
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={false}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -16, filter: "blur(4px)" }}
                transition={{ duration: 0.32, ease: "easeOut" }}
                className="min-h-[15rem]"
              >
                {step === 0 ? (
                  <div className="flex min-h-[15rem] flex-col justify-center">
                    <p className="rs-eyebrow mb-4 text-sm font-semibold uppercase tracking-[0.16em]">
                      {copy.steps.welcome}
                    </p>
                    <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[var(--color-text)] sm:text-5xl">
                      {copy.title}
                    </h1>
                    <p className="rs-muted mt-5 max-w-2xl text-base leading-7">
                      {copy.subtitle}
                    </p>
                    <div className="mt-8 flex flex-wrap gap-2">
                      {copy.details.map((detail) => (
                        <span
                          key={detail}
                          className="rs-chip rounded-full px-4 py-2 text-sm font-medium"
                        >
                          {detail}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {step === 1 ? (
                  <div className="space-y-6">
                    <h2 className="text-3xl font-semibold text-[var(--color-text)] sm:text-5xl">
                      {copy.locationTitle}
                    </h2>
                    <p className="rs-muted max-w-2xl text-sm leading-6">
                      {copy.locationHelp}
                    </p>
                    <input
                      value={values.city}
                      onChange={(event) => update("city", event.target.value)}
                      className={inputClass()}
                      placeholder={copy.cityPlaceholder}
                    />
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="space-y-6">
                    <h2 className="text-3xl font-semibold text-[var(--color-text)] sm:text-5xl">
                      {copy.budgetTitle}
                    </h2>
                    <p className="rs-muted max-w-2xl text-sm leading-6">
                      {copy.budgetHelp}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input
                        type="number"
                        min="0"
                        value={values.minPrice}
                        onChange={(event) => update("minPrice", event.target.value)}
                        className={inputClass()}
                        placeholder={copy.minRent}
                      />
                      <input
                        type="number"
                        min="0"
                        disabled={values.noMaxPrice}
                        value={values.maxPrice}
                        onChange={(event) => update("maxPrice", event.target.value)}
                        className={`${inputClass()} disabled:cursor-not-allowed disabled:opacity-40`}
                        placeholder={copy.maxRent}
                      />
                    </div>
                    <ToggleCard
                      label={copy.noMaxPrice}
                      checked={values.noMaxPrice}
                      onChange={(checked) => update("noMaxPrice", checked)}
                    />
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="space-y-6">
                    <h2 className="text-3xl font-semibold text-[var(--color-text)] sm:text-5xl">
                      {copy.propertyTitle}
                    </h2>
                    <p className="rs-muted max-w-2xl text-sm leading-6">
                      {copy.propertyHelp}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {propertyOptions.map((type) => {
                        const active = type
                          ? values.propertyTypes.includes(type)
                          : values.propertyTypes.length === 0;
                        const label = type ? propertyCopy[type] : copy.allTypes;

                        return (
                          <motion.button
                            key={type || "all"}
                            type="button"
                            whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => togglePropertyType(type)}
                            className={`rounded-2xl border p-5 text-left transition ${
                              active
                                ? "rs-chip-active shadow-[var(--shadow-soft)]"
                                : "rs-control text-[var(--color-muted)]"
                            }`}
                          >
                            <div className="text-lg font-semibold">{label}</div>
                            {!type ? (
                              <div className="mt-1 text-xs font-normal opacity-60">
                                {copy.allTypesHint}
                              </div>
                            ) : null}
                            {active ? (
                              <motion.div
                                layoutId={`property-active-${type || "all"}`}
                                className="mt-4 h-1 rounded-full bg-[var(--color-accent)]"
                              />
                            ) : null}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {step === 4 ? (
                  <div className="space-y-6">
                    <h2 className="text-3xl font-semibold text-[var(--color-text)] sm:text-5xl">
                      {copy.privacyTitle}
                    </h2>
                    <p className="rs-muted max-w-2xl text-sm leading-6">
                      {copy.privacyHelp}
                    </p>
                    <div className="grid gap-3">
                      <ToggleCard
                        label={copy.privateKitchen}
                        checked={values.privateKitchen === true}
                        onChange={(checked) => update("privateKitchen", checked ? true : null)}
                      />
                      <ToggleCard
                        label={copy.privateBathroom}
                        checked={values.privateBathroom === true}
                        onChange={(checked) => update("privateBathroom", checked ? true : null)}
                      />
                      <ToggleCard
                        label={copy.privateToilet}
                        checked={values.privateToilet === true}
                        onChange={(checked) => update("privateToilet", checked ? true : null)}
                      />
                      <ToggleCard
                        label={copy.allowSharedLaundry}
                        checked={values.allowSharedLaundry}
                        onChange={(checked) => update("allowSharedLaundry", checked)}
                      />
                      <ToggleCard
                        label={copy.allowShared}
                        checked={values.allowShared}
                        onChange={(checked) => update("allowShared", checked)}
                      />
                    </div>
                  </div>
                ) : null}

                {step === 5 ? (
                  <div className="space-y-6">
                    <h2 className="text-3xl font-semibold text-[var(--color-text)] sm:text-5xl">
                      {copy.readyTitle}
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        [copy.city, values.city || copy.any],
                        [copy.budget, values.noMaxPrice ? copy.noMaxPrice : values.maxPrice || copy.any],
                        [copy.privacy, values.allowShared ? copy.sharedAllowed : copy.sharedExcluded],
                      ].map(([label, value]) => (
                        <div key={label} className="rs-card-solid rounded-2xl p-4">
                          <div className="rs-subtle text-xs uppercase tracking-[0.14em]">{label}</div>
                          <div className="mt-2 text-sm font-semibold text-[var(--color-text)]">{value}</div>
                        </div>
                      ))}
                      <div className="rs-card-solid rounded-2xl p-4 sm:col-span-2">
                        <div className="rs-subtle text-xs uppercase tracking-[0.14em]">{copy.propertyType}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {values.propertyTypes.length > 0 ? (
                            values.propertyTypes.map((type) => (
                              <span
                                key={type}
                                className="rs-chip-active rounded-full px-3 py-1 text-xs font-semibold"
                              >
                                {propertyCopy[type]}
                              </span>
                            ))
                          ) : (
                            <span className="rs-chip rounded-full px-3 py-1 text-xs font-semibold">
                              {copy.noPreference}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex items-center justify-between gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={back}
                disabled={step === 0}
                className="rs-control h-11 rounded-lg px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-35"
              >
                {copy.back}
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={next}
                className="rs-primary-button h-11 rounded-lg px-6 text-sm font-semibold"
              >
                {step === steps.length - 1 ? copy.start : copy.next}
              </motion.button>
            </div>
          </motion.div>

          <motion.aside
            initial={false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", damping: 26, stiffness: 170, delay: 0.1 }}
            className="rs-card relative rounded-2xl p-5"
          >
            <div className="mb-4">
              <div className="rs-eyebrow text-xs font-semibold uppercase tracking-[0.16em]">
                {Math.round(progress)}%
              </div>
              <motion.div
                key={`${step}-${values.city}-${values.maxPrice}-${values.propertyTypes.join(",")}`}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3"
              >
                <div className="text-sm font-semibold text-[var(--color-text)]">
                  {values.city || copy.any}
                </div>
                <div className="rs-muted mt-1 text-xs leading-5">
                  {values.noMaxPrice ? copy.noMaxPrice : values.maxPrice || copy.any} · {selectedTypeLabels}
                </div>
              </motion.div>
            </div>
            <div className="space-y-2">
              {steps.map((label, index) => (
                <motion.div
                  key={label}
                  layout
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    index === step
                      ? "rs-chip-active"
                      : index < step
                        ? "rs-chip-positive"
                        : "rs-chip"
                  }`}
                >
                  {label}
                </motion.div>
              ))}
            </div>
          </motion.aside>
        </div>
      </div>
    </motion.section>
  );
}
