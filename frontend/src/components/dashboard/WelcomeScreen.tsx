"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  return "h-12 w-full rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-brass/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-brass/15";
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
      className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left transition ${
        checked
          ? "border-brass/45 bg-brass/10 text-white"
          : "border-white/10 bg-black/16 text-white/68 hover:border-white/20 hover:bg-white/[0.045]"
      }`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full border transition ${
          checked ? "border-mint/50 bg-mint/75" : "border-white/10 bg-black/35"
        }`}
      >
        <motion.span
          animate={{ x: checked ? 20 : 0 }}
          className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow"
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
      className="relative isolate flex min-h-[calc(100vh-4rem)] items-center px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="relative mx-auto w-full max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_30rem] lg:items-stretch">
          <motion.div
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-6 shadow-premium sm:p-8"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 150 }}
          >
            <div className="mb-8">
              <div className="mb-4 flex gap-2">
                {steps.map((label, index) => (
                  <motion.button
                    key={label}
                    type="button"
                    aria-label={label}
                    onClick={() => setStep(index)}
                    className={`h-2 rounded-full transition ${
                      index <= step ? "bg-brass" : "bg-white/12"
                    }`}
                    animate={{ width: index === step ? 34 : 14 }}
                  />
                ))}
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-brass"
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
                exit={{ opacity: 0, x: -22, filter: "blur(8px)" }}
                transition={{ duration: 0.32, ease: "easeOut" }}
                className="min-h-[28rem]"
              >
                {step === 0 ? (
                  <div className="flex min-h-[28rem] flex-col justify-center">
                    <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-brass">
                      {copy.steps.welcome}
                    </p>
                    <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
                      {copy.title}
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-7 text-white/68">
                      {copy.subtitle}
                    </p>
                    <div className="mt-8 flex flex-wrap gap-2">
                      {copy.details.map((detail) => (
                        <span
                          key={detail}
                          className="rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-sm font-medium text-white/68"
                        >
                          {detail}
                        </span>
                      ))}
                    </div>
                    <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.985 }}
                        onClick={next}
                        className="h-11 rounded-lg bg-brass px-5 text-sm font-semibold text-ink transition hover:bg-[#e3bd6a]"
                      >
                        {copy.start}
                      </motion.button>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.985 }}
                        onClick={() => setStep(1)}
                        className="h-11 rounded-lg border border-white/12 bg-white/[0.045] px-5 text-sm font-semibold text-white/70 transition hover:border-white/24 hover:text-white"
                      >
                        {copy.howItWorks}
                      </motion.button>
                    </div>
                  </div>
                ) : null}

                {step === 1 ? (
                  <div className="space-y-6">
                    <h2 className="text-3xl font-semibold text-white sm:text-5xl">
                      {copy.locationTitle}
                    </h2>
                    <p className="max-w-2xl text-sm leading-6 text-white/52">
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
                    <h2 className="text-3xl font-semibold text-white sm:text-5xl">
                      {copy.budgetTitle}
                    </h2>
                    <p className="max-w-2xl text-sm leading-6 text-white/52">
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
                    <h2 className="text-3xl font-semibold text-white sm:text-5xl">
                      {copy.propertyTitle}
                    </h2>
                    <p className="max-w-2xl text-sm leading-6 text-white/52">
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
                            whileHover={{ y: -3 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => togglePropertyType(type)}
                            className={`rounded-2xl border p-5 text-left transition ${
                              active
                                ? "border-cyan-200/45 bg-cyan-300/12 text-cyan-100"
                                : "border-white/10 bg-slate-950/28 text-white/70 hover:border-cyan-100/22 hover:bg-white/[0.055]"
                            }`}
                          >
                            <div className="text-lg font-semibold">{label}</div>
                            {active ? (
                              <motion.div
                                layoutId={`property-active-${type || "all"}`}
                                className="mt-4 h-1 rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(125,211,252,0.45)]"
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
                    <h2 className="text-3xl font-semibold text-white sm:text-5xl">
                      {copy.privacyTitle}
                    </h2>
                    <p className="max-w-2xl text-sm leading-6 text-white/52">
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
                    <h2 className="text-3xl font-semibold text-white sm:text-5xl">
                      {copy.readyTitle}
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        [copy.city, values.city || copy.any],
                        [copy.budget, values.noMaxPrice ? copy.noMaxPrice : values.maxPrice || copy.any],
                        [copy.privacy, values.allowShared ? copy.sharedAllowed : copy.sharedExcluded],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/28 p-4">
                          <div className="text-xs uppercase tracking-[0.14em] text-white/38">{label}</div>
                          <div className="mt-2 text-sm font-semibold text-white">{value}</div>
                        </div>
                      ))}
                      <div className="rounded-2xl border border-white/10 bg-slate-950/28 p-4 sm:col-span-2">
                        <div className="text-xs uppercase tracking-[0.14em] text-white/38">{copy.propertyType}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(values.propertyTypes.length ? values.propertyTypes : selectablePropertyTypes).map((type) => (
                            <span
                              key={type}
                              className="rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100"
                            >
                              {propertyCopy[type]}
                            </span>
                          ))}
                          {!values.propertyTypes.length ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/46">
                              {copy.allTypes}
                            </span>
                          ) : null}
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
                className="h-12 rounded-2xl border border-white/10 px-5 text-sm font-semibold text-white/62 transition hover:border-cyan-100/28 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                {copy.back}
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.985 }}
                onClick={next}
                className="h-12 rounded-2xl border border-cyan-100/50 bg-cyan-100 px-6 text-sm font-semibold text-slate-950 shadow-[0_22px_70px_rgba(34,211,238,0.24)] transition hover:bg-white"
              >
                {step === steps.length - 1 ? copy.start : copy.next}
              </motion.button>
            </div>
          </motion.div>

          <motion.aside
            initial={false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", damping: 26, stiffness: 170, delay: 0.1 }}
            className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-slate-950/58 p-6 shadow-cinematic backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-teal-200/70 to-transparent" />
            <div className="pointer-events-none absolute -right-28 top-20 h-64 w-64 rounded-full bg-teal-300/10 blur-3xl" />
            <motion.div
              aria-hidden="true"
              className="mx-auto mt-8 h-56 w-56 rounded-full border border-cyan-100/15 bg-[radial-gradient(circle,rgba(125,211,252,0.22),rgba(45,212,191,0.10)_46%,rgba(244,63,94,0.08)_68%,transparent_72%)] shadow-[0_0_80px_rgba(34,211,238,0.12)]"
              animate={{ rotate: 360, scale: [1, 1.04, 1] }}
              transition={{ rotate: { duration: 24, repeat: Infinity, ease: "linear" }, scale: { duration: 6, repeat: Infinity } }}
            />
            <div className="mt-8 space-y-3">
              {steps.map((label, index) => (
                <div
                  key={label}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    index === step
                      ? "border-cyan-200/35 bg-cyan-300/10 text-cyan-100"
                      : index < step
                        ? "border-mint/20 bg-mint/8 text-mint"
                        : "border-white/10 bg-slate-950/28 text-white/42"
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>
          </motion.aside>
        </div>
      </div>
    </motion.section>
  );
}
