"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type {
  ListingFilters,
  ListingSort,
  PropertyType,
  SearchProfile,
} from "@/types/listing";
import { i18n, type Language } from "@/lib/i18n";
import { listingStatuses } from "@/lib/listingWorkflow";
import { CustomSelect, SelectOption } from "./CustomSelect";
import { SearchProfilesPanel } from "./SearchProfilesPanel";

const sectionVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="rs-subtle mb-2 block text-xs font-semibold uppercase tracking-[0.16em]">
      {children}
    </span>
  );
}

function inputClass() {
  return "rs-input h-10";
}

function Section({
  title,
  description,
  children,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.section
      variants={sectionVariants}
      className="group border-b border-[var(--color-border)] pb-3 last:border-b-0"
    >
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className="group"
      >
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 py-2">
          <span>
            <span className="block text-sm font-semibold text-[var(--color-text)]">{title}</span>
            {description ? (
              <span className="rs-subtle mt-1 block text-xs leading-5">{description}</span>
            ) : null}
          </span>
          <span className="rs-subtle mt-0.5 text-sm transition group-open:rotate-45">+</span>
        </summary>
        <div className="space-y-3 pt-3">{children}</div>
      </details>
    </motion.section>
  );
}

function Toggle({
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
      className="rs-control flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm"
    >
      <span>{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full border transition ${
          checked ? "border-[var(--color-accent)] bg-[var(--color-accent)]" : "border-[var(--color-border)] bg-[var(--color-soft)]"
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

function BooleanListbox({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  options: Array<SelectOption<"any" | "true" | "false">>;
}) {
  const selectValue = value === null ? "any" : String(value);

  return (
    <CustomSelect
      label={label}
      value={selectValue}
      options={options}
      onChange={(nextValue) => {
        if (nextValue === "any") {
          onChange(null);
          return;
        }

        onChange(nextValue === "true");
      }}
    />
  );
}

function StatusChips({
  value,
  options,
  onChange,
}: {
  value: ListingFilters["status"];
  options: Array<SelectOption<ListingFilters["status"]>>;
  onChange: (value: ListingFilters["status"]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;

        return (
          <motion.button
            key={option.value || "all"}
            type="button"
            layout
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange(option.value)}
            className={`relative rounded-full border px-3 py-2 text-xs font-semibold transition ${
              active
                ? "rs-chip-active"
                : "rs-chip hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
            }`}
          >
            {active ? (
              <motion.span
                layoutId="active-status-chip"
                className="absolute inset-0 rounded-full bg-[var(--color-accent-soft)]"
                transition={{ type: "spring", damping: 24, stiffness: 260 }}
              />
            ) : null}
            <span className="relative">{option.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function FilterPanel({
  filters,
  sources,
  loading,
  onChange,
  onReset,
  language,
  hiddenCount,
  profiles,
  selectedProfileId,
  profileName,
  hasUnsavedProfileChanges,
  isProUser,
  isAuthenticated,
  onProfileNameChange,
  onSelectProfile,
  onSaveProfile,
  onApplyProfile,
  onUpdateProfile,
  onDeleteProfile,
}: {
  filters: ListingFilters;
  sources: string[];
  loading: boolean;
  onChange: (filters: ListingFilters) => void;
  onReset: () => void;
  language: Language;
  hiddenCount: number;
  profiles: SearchProfile[];
  selectedProfileId: string;
  profileName: string;
  hasUnsavedProfileChanges: boolean;
  isProUser: boolean;
  isAuthenticated: boolean;
  onProfileNameChange: (name: string) => void;
  onSelectProfile: (profileId: string) => void;
  onSaveProfile: () => void;
  onApplyProfile: () => void;
  onUpdateProfile: () => void;
  onDeleteProfile: () => void;
}) {
  const copy = i18n[language].filters;
  const propertyTypes: Array<SelectOption<PropertyType | "">> = [
    { label: copy.allTypes, value: "" },
    { label: i18n[language].propertyTypes.studio, value: "studio" },
    { label: i18n[language].propertyTypes.apartment, value: "apartment" },
    { label: i18n[language].propertyTypes.room, value: "room" },
    { label: i18n[language].propertyTypes.house, value: "house" },
    { label: i18n[language].propertyTypes.parking, value: "parking" },
    { label: copy.unknown, value: "unknown" },
  ];
  const sortOptions: Array<SelectOption<ListingSort>> = [
    { label: copy.bestMatch, value: "best_match" },
    { label: copy.newest, value: "newest" },
    { label: copy.recentlyUpdated, value: "recently_updated" },
    { label: copy.cheapest, value: "cheapest" },
    { label: copy.mostExpensive, value: "most_expensive" },
  ];
  const booleanOptions: Array<SelectOption<"any" | "true" | "false">> = [
    { label: copy.any, value: "any" },
    { label: copy.required, value: "true" },
    { label: copy.notPrivate, value: "false" },
  ];
  const sourceOptions: Array<SelectOption<string>> = [
    { label: copy.allSources, value: "" },
    ...sources.map((source) => ({ label: source, value: source })),
  ];
  const seenRecentlyOptions: Array<SelectOption<ListingFilters["seenRecentlyDays"]>> = [
    { label: copy.allTime, value: "" },
    { label: copy.today, value: "0" },
    { label: copy.last3Days, value: "3" },
    { label: copy.last7Days, value: "7" },
    { label: copy.last14Days, value: "14" },
  ];
  const qualityOptions: Array<SelectOption<string>> = [
    { label: copy.allQualities, value: "" },
    { label: copy.goodQuality, value: "0.55" },
    { label: copy.strongQuality, value: "0.75" },
  ];
  const workflowCopy = i18n[language].workflow;
  const statusOptions: Array<SelectOption<ListingFilters["status"]>> = [
    { label: workflowCopy.all, value: "" },
    ...listingStatuses.map((status) => ({
      label: status === "viewing_planned" ? workflowCopy.shortLabels.viewing_planned : workflowCopy.labels[status],
      value: status,
    })),
  ];

  function update<K extends keyof ListingFilters>(key: K, value: ListingFilters[K]) {
    onChange({ ...filters, [key]: value, offset: 0 });
  }

  function updatePropertyType(value: ListingFilters["propertyType"]) {
    onChange({ ...filters, propertyType: value, propertyTypes: [], offset: 0 });
  }

  function togglePropertyType(type: PropertyType) {
    const propertyTypes = filters.propertyTypes.includes(type)
      ? filters.propertyTypes.filter((selectedType) => selectedType !== type)
      : [...filters.propertyTypes, type];

    onChange({
      ...filters,
      propertyType: "",
      propertyTypes,
      offset: 0,
    });
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.045 } } }}
      className="space-y-4"
    >
      <div className="border-b border-[var(--color-border)] pb-4">
        <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text)]">{copy.title}</h2>
          <p className="rs-muted mt-1 text-xs leading-5">
            {copy.intro}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rs-control shrink-0 rounded-lg px-3 py-2 text-xs font-semibold"
        >
          {copy.reset}
        </button>
        </div>
      </div>

      <SearchProfilesPanel
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        profileName={profileName}
        hasUnsavedChanges={hasUnsavedProfileChanges}
        language={language}
        isProUser={isProUser}
        isAuthenticated={isAuthenticated}
        onProfileNameChange={onProfileNameChange}
        onSelectProfile={onSelectProfile}
        onSaveNew={onSaveProfile}
        onApply={onApplyProfile}
        onUpdate={onUpdateProfile}
        onDelete={onDeleteProfile}
      />

      <Section title={copy.location} description={copy.locationDescription} defaultOpen>
        <label className="block">
          <FieldLabel>{copy.search}</FieldLabel>
          <input
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
            className={inputClass()}
            placeholder={copy.searchPlaceholder}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <FieldLabel>{copy.city}</FieldLabel>
            <input
              value={filters.city}
              onChange={(event) => update("city", event.target.value)}
              className={inputClass()}
              placeholder={copy.cityPlaceholder}
            />
          </label>
          <CustomSelect
            label={copy.sourceFilter}
            value={filters.source}
            options={sourceOptions}
            onChange={(value) => update("source", value)}
          />
        </div>
      </Section>

      <Section title={copy.price} description={copy.priceDescription} defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <FieldLabel>{copy.minRent}</FieldLabel>
            <input
              type="number"
              min="0"
              value={filters.minPrice}
              onChange={(event) => update("minPrice", event.target.value)}
              className={inputClass()}
              placeholder="500"
            />
          </label>
          <label className="block">
            <FieldLabel>{copy.maxRent}</FieldLabel>
            <input
              type="number"
              min="0"
              value={filters.maxPrice}
              disabled={filters.noMaxPrice}
              onChange={(event) => update("maxPrice", event.target.value)}
              className={`${inputClass()} disabled:cursor-not-allowed disabled:opacity-40`}
              placeholder="1200"
            />
          </label>
        </div>
        <Toggle
          label={copy.noMaxPrice}
          checked={filters.noMaxPrice}
          onChange={(checked) => update("noMaxPrice", checked)}
        />
        <Toggle
          label={copy.includeUnknownPrice}
          checked={filters.includeUnknownPrice}
          onChange={(checked) => update("includeUnknownPrice", checked)}
        />
      </Section>

      <Section title={copy.propertyType} description={copy.propertyDescription} defaultOpen>
        <CustomSelect
          label={copy.propertyTypeLabel}
          value={filters.propertyType}
          options={propertyTypes}
          onChange={updatePropertyType}
        />
        <div>
          <FieldLabel>{copy.propertyTypesLabel}</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {propertyTypes
              .filter((option): option is SelectOption<PropertyType> => Boolean(option.value))
              .map((option) => {
                const active = filters.propertyTypes.includes(option.value);

                return (
                  <motion.button
                    key={option.value}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => togglePropertyType(option.value)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? "rs-chip-active"
                        : "rs-chip hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {option.label}
                  </motion.button>
                );
              })}
          </div>
          <p className="rs-subtle mt-2 text-xs leading-5">{copy.propertyTypesHelp}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <FieldLabel>{copy.minArea}</FieldLabel>
            <input
              type="number"
              min="0"
              value={filters.minAreaM2}
              onChange={(event) => update("minAreaM2", event.target.value)}
              className={inputClass()}
              placeholder="25"
            />
          </label>
          <label className="block">
            <FieldLabel>{copy.maxArea}</FieldLabel>
            <input
              type="number"
              min="0"
              value={filters.maxAreaM2}
              onChange={(event) => update("maxAreaM2", event.target.value)}
              className={inputClass()}
              placeholder="90"
            />
          </label>
          <label className="block">
            <FieldLabel>{copy.rooms}</FieldLabel>
            <input
              type="number"
              min="0"
              value={filters.minRooms}
              onChange={(event) => update("minRooms", event.target.value)}
              className={inputClass()}
              placeholder="1"
            />
          </label>
        </div>
      </Section>

      <Section title={copy.privacy} description={copy.privacyDescription}>
        <BooleanListbox
          label={copy.privateKitchen}
          value={filters.privateKitchen}
          onChange={(value) => update("privateKitchen", value)}
          options={booleanOptions}
        />
        <BooleanListbox
          label={copy.privateBathroom}
          value={filters.privateBathroom}
          onChange={(value) => update("privateBathroom", value)}
          options={booleanOptions}
        />
        <BooleanListbox
          label={copy.privateToilet}
          value={filters.privateToilet}
          onChange={(value) => update("privateToilet", value)}
          options={booleanOptions}
        />
        <Toggle
          label={copy.allowShared}
          checked={filters.allowShared}
          onChange={(checked) => update("allowShared", checked)}
        />
        <Toggle
          label={copy.allowSharedLaundry}
          checked={filters.allowSharedLaundry}
          onChange={(checked) => update("allowSharedLaundry", checked)}
        />
        <Toggle
          label={copy.onlyIndependent}
          checked={filters.onlyIndependent}
          onChange={(checked) => update("onlyIndependent", checked)}
        />
      </Section>

      <Section title={copy.quality} description={copy.qualityDescription}>
        <Toggle
          label={copy.hasImage}
          checked={filters.hasImage}
          onChange={(checked) => update("hasImage", checked)}
        />
        <CustomSelect
          label={copy.seenRecently}
          value={filters.seenRecentlyDays}
          options={seenRecentlyOptions}
          onChange={(value) => update("seenRecentlyDays", value)}
        />
        <CustomSelect
          label={copy.minQuality}
          value={filters.minConfidenceScore}
          options={qualityOptions}
          onChange={(value) => update("minConfidenceScore", value)}
        />
        <Toggle
          label={copy.excludeWoningruil}
          checked={filters.excludeWoningruil}
          onChange={(checked) => update("excludeWoningruil", checked)}
        />
        <Toggle
          label={copy.excludeParking}
          checked={filters.excludeParking}
          onChange={(checked) => update("excludeParking", checked)}
        />
        <Toggle
          label={copy.hideRented}
          checked={filters.hideRented}
          onChange={(checked) => update("hideRented", checked)}
        />
      </Section>

      <Section title={workflowCopy.progress}>
        {hiddenCount > 0 ? (
          <div className="rs-chip-active inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
            {workflowCopy.labels.hidden}: {hiddenCount}
          </div>
        ) : null}
        <StatusChips
          value={filters.status}
          options={statusOptions}
          onChange={(value) => update("status", value)}
        />
        <p className="rs-muted text-xs leading-5">{workflowCopy.hiddenExplanation}</p>
        {!filters.showHiddenListings ? (
          <p className="rs-chip rounded-xl px-3 py-2 text-xs leading-5">
            {workflowCopy.hiddenExcluded}
          </p>
        ) : null}
        <Toggle
          label={workflowCopy.showHidden}
          checked={filters.showHiddenListings}
          onChange={(checked) => update("showHiddenListings", checked)}
        />
      </Section>

      <Section title={copy.sort}>
        <CustomSelect
          label={copy.sort}
          value={filters.sort}
          options={sortOptions}
          onChange={(value) => update("sort", value)}
        />
      </Section>

      {loading ? (
        <div className="rs-chip rounded-xl px-3 py-2 text-xs font-semibold">
          {i18n[language].dashboard.refreshing}
        </div>
      ) : null}
    </motion.div>
  );
}
