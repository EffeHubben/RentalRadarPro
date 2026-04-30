"use client";

import { motion } from "framer-motion";
import type {
  ListingFilters,
  ListingSort,
  PropertyType,
  SearchProfile,
  SourceInfo,
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
    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
      {children}
    </span>
  );
}

function inputClass() {
  return "h-11 w-full rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-brass/70 focus:bg-white/[0.07] focus:ring-2 focus:ring-brass/20";
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={sectionVariants}
      className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-white/42">{description}</p>
        ) : null}
      </div>
      <div className="space-y-3">{children}</div>
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
      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/18 px-3 py-3 text-left text-sm text-white/72 transition hover:border-white/20 hover:bg-white/[0.055]"
    >
      <span>{label}</span>
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

function SourceScanToggle({
  source,
  checked,
  language,
  onChange,
}: {
  source: SourceInfo;
  checked: boolean;
  language: Language;
  onChange: (checked: boolean) => void;
}) {
  const copy = i18n[language].filters;
  const note = language === "nl" ? source.status_note_nl : source.status_note_en;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/18 px-3 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.055]"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white/78">
          {source.display_name}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">
          <span>{source.supports_automatic_scraping ? copy.automatic : copy.limited}</span>
          {note ? <span className="normal-case tracking-normal text-white/38">{note}</span> : null}
        </span>
      </span>
      <span
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition ${
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
                ? "border-brass/45 bg-brass/12 text-brass"
                : "border-white/10 bg-black/18 text-white/55 hover:border-white/22 hover:text-white"
            }`}
          >
            {active ? (
              <motion.span
                layoutId="active-status-chip"
                className="absolute inset-0 rounded-full bg-brass/10"
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
  configuredSources,
  selectedScanSourceIds,
  loading,
  onChange,
  onReset,
  onRunScraper,
  onScanSourceChange,
  scraperLoading,
  language,
  hiddenCount,
  profiles,
  selectedProfileId,
  profileName,
  hasUnsavedProfileChanges,
  onProfileNameChange,
  onSelectProfile,
  onSaveProfile,
  onApplyProfile,
  onUpdateProfile,
  onDeleteProfile,
}: {
  filters: ListingFilters;
  sources: string[];
  configuredSources: SourceInfo[];
  selectedScanSourceIds: string[];
  loading: boolean;
  onChange: (filters: ListingFilters) => void;
  onReset: () => void;
  onRunScraper: () => void;
  onScanSourceChange: (sourceIds: string[]) => void;
  scraperLoading: boolean;
  language: Language;
  hiddenCount: number;
  profiles: SearchProfile[];
  selectedProfileId: string;
  profileName: string;
  hasUnsavedProfileChanges: boolean;
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
    { label: copy.cheapest, value: "cheapest" },
    { label: copy.mostExpensive, value: "most_expensive" },
    { label: copy.largest, value: "largest" },
    { label: copy.smallest, value: "smallest" },
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

  function updateScanSource(sourceId: string, checked: boolean) {
    const nextIds = checked
      ? Array.from(new Set([...selectedScanSourceIds, sourceId]))
      : selectedScanSourceIds.filter((id) => id !== sourceId);

    onScanSourceChange(nextIds);
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.045 } } }}
      className="space-y-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">{copy.title}</h2>
          <p className="mt-1 text-xs leading-5 text-white/42">
            {copy.intro}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/58 transition hover:border-white/25 hover:text-white"
        >
          {copy.reset}
        </button>
      </div>

      <SearchProfilesPanel
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        profileName={profileName}
        hasUnsavedChanges={hasUnsavedProfileChanges}
        language={language}
        onProfileNameChange={onProfileNameChange}
        onSelectProfile={onSelectProfile}
        onSaveNew={onSaveProfile}
        onApply={onApplyProfile}
        onUpdate={onUpdateProfile}
        onDelete={onDeleteProfile}
      />

      <Section title={copy.location} description={copy.locationDescription}>
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
            label={copy.source}
            value={filters.source}
            options={sourceOptions}
            onChange={(value) => update("source", value)}
          />
        </div>
      </Section>

      <Section title={copy.price} description={copy.priceDescription}>
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

      <Section title={copy.propertyType} description={copy.propertyDescription}>
        <CustomSelect
          label={copy.propertyTypeLabel}
          value={filters.propertyType}
          options={propertyTypes}
          onChange={updatePropertyType}
        />
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

      {configuredSources.length ? (
        <Section title={copy.scanSources} description={copy.scanSourcesDescription}>
          <div className="space-y-2">
            {configuredSources.map((source) => (
              <SourceScanToggle
                key={source.source_id}
                source={source}
                checked={selectedScanSourceIds.includes(source.source_id)}
                language={language}
                onChange={(checked) => updateScanSource(source.source_id, checked)}
              />
            ))}
          </div>
        </Section>
      ) : null}

      <Section title={workflowCopy.progress}>
        {hiddenCount > 0 ? (
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-brass/25 bg-brass/10 px-3 py-1 text-xs font-semibold text-brass">
            {workflowCopy.labels.hidden}: {hiddenCount}
          </div>
        ) : null}
        <StatusChips
          value={filters.status}
          options={statusOptions}
          onChange={(value) => update("status", value)}
        />
        <p className="text-xs leading-5 text-white/42">{workflowCopy.hiddenExplanation}</p>
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

      <motion.button
        type="button"
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={onRunScraper}
        disabled={scraperLoading || loading}
        className="h-12 w-full rounded-2xl border border-mint/40 bg-mint px-4 text-sm font-semibold text-ink shadow-[0_16px_42px_rgba(110,231,183,0.16)] transition hover:bg-[#8af0c8] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/40"
      >
        {scraperLoading ? copy.runLoading : copy.run}
      </motion.button>
    </motion.div>
  );
}
