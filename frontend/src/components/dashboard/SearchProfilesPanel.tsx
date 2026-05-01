"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { SearchProfile } from "@/types/listing";
import { i18n, type Language } from "@/lib/i18n";
import { CustomSelect, type SelectOption } from "./CustomSelect";

function inputClass() {
  return "h-11 w-full rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-brass/70 focus:bg-white/[0.07] focus:ring-2 focus:ring-brass/20";
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
      ? "border-brass/40 bg-brass/12 text-brass hover:bg-brass hover:text-ink"
      : tone === "danger"
        ? "border-danger/28 bg-danger/10 text-danger hover:border-danger/50"
        : "border-white/10 bg-black/18 text-white/64 hover:border-white/22 hover:text-white";

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
  onProfileNameChange: (name: string) => void;
  onSelectProfile: (profileId: string) => void;
  onSaveNew: () => void;
  onApply: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const copy = i18n[language].searchProfiles;
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
      className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{copy.title}</h3>
          <p className="mt-1 text-xs leading-5 text-white/42">
            {profiles.length ? copy.description : copy.empty}
          </p>
        </div>
        <AnimatePresence>
          {selectedProfile && hasUnsavedChanges ? (
            <motion.span
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="rounded-full border border-brass/25 bg-brass/10 px-2 py-1 text-[10px] font-semibold text-brass"
            >
              {copy.unsaved}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
            {copy.profileName}
          </span>
          <input
            value={profileName}
            onChange={(event) => onProfileNameChange(event.target.value)}
            className={inputClass()}
            placeholder="Breda studio max 1000"
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
