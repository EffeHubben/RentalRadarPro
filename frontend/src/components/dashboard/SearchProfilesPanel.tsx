"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { SearchProfile } from "@/types/listing";
import { i18n, type Language } from "@/lib/i18n";
import { CustomSelect, type SelectOption } from "./CustomSelect";

function inputClass() {
  return "rs-input h-11";
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger";
}) {
  const toneClass =
    tone === "primary"
      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)] hover:bg-[var(--color-accent)] hover:text-white"
      : tone === "danger"
        ? "border-danger/28 bg-danger/10 text-danger hover:border-danger/50"
        : "rs-control";

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-semibold leading-4 transition disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
    >
      {children}
    </motion.button>
  );
}

export function SearchProfilesPanel({
  profiles,
  selectedProfileId,
  profileName,
  hasUnsavedChanges,
  language,
  isProUser,
  isAuthenticated,
  onProfileNameChange,
  onSelectProfile,
  onSaveNew,
  onApply,
  onUpdate,
  onDelete,
}: {
  profiles: SearchProfile[];
  selectedProfileId: string;
  profileName: string;
  hasUnsavedChanges: boolean;
  language: Language;
  isProUser: boolean;
  isAuthenticated: boolean;
  onProfileNameChange: (name: string) => void;
  onSelectProfile: (profileId: string) => void;
  onSaveNew: () => void;
  onApply: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const copy = i18n[language].searchProfiles;
  const proLockCopy = i18n[language].proLock;

  if (!isProUser) {
    return (
      <motion.section
        variants={{
          hidden: { opacity: 0, y: 10 },
          visible: { opacity: 1, y: 0 },
        }}
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)]/60 p-4"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{copy.title}</h3>
          <span className="shrink-0 rounded-full border border-[var(--color-teal)]/30 bg-[var(--color-teal-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--color-teal)]">
            {proLockCopy.proLabel}
          </span>
        </div>
        <p className="rs-muted text-xs leading-5">{proLockCopy.searchProfilesLockedBody}</p>
        <Link
          href={isAuthenticated ? "/#pricing" : "/account"}
          className="mt-3 inline-block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-accent-strong)] transition hover:border-[var(--color-accent)]"
        >
          {isAuthenticated ? proLockCopy.ctaFree : proLockCopy.ctaGuest}
        </Link>
      </motion.section>
    );
  }

  const profileOptions: Array<SelectOption<string>> = [
    { label: copy.noneSelected, value: "" },
    ...profiles.map((profile) => ({
      label: profile.name,
      value: profile.id,
    })),
  ];
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);

  return (
    <motion.section
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 },
      }}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)]/60 p-4"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{copy.title}</h3>
          <p className="rs-muted mt-1 text-xs leading-5">
            {profiles.length ? copy.description : copy.empty}
          </p>
        </div>
        <AnimatePresence>
          {selectedProfile && hasUnsavedChanges ? (
            <motion.span
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="rs-chip-active rounded-full px-2 py-1 text-[10px] font-semibold"
            >
              {copy.unsaved}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="rs-subtle mb-2 block text-xs font-semibold uppercase tracking-[0.16em]">
            {copy.profileName}
          </span>
          <input
            value={profileName}
            onChange={(event) => onProfileNameChange(event.target.value)}
            className={inputClass()}
            placeholder={copy.profileNamePlaceholder}
          />
        </label>

        <CustomSelect
          label={copy.title}
          value={selectedProfileId}
          options={profileOptions}
          onChange={onSelectProfile}
        />

        <div className="grid grid-cols-2 gap-2">
          <ActionButton onClick={onSaveNew} disabled={!profileName.trim()} tone="primary">
            {copy.save}
          </ActionButton>
          <ActionButton onClick={onApply} disabled={!selectedProfile}>
            {copy.apply}
          </ActionButton>
          <ActionButton onClick={onUpdate} disabled={!selectedProfile}>
            {copy.update}
          </ActionButton>
          <ActionButton onClick={onDelete} disabled={!selectedProfile} tone="danger">
            {copy.delete}
          </ActionButton>
        </div>
      </div>
    </motion.section>
  );
}
