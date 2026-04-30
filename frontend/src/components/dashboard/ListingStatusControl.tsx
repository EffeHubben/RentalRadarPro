"use client";

import { motion } from "framer-motion";
import type { ListingStatus } from "@/types/listing";
import { i18n, type Language } from "@/lib/i18n";
import { listingStatuses } from "@/lib/listingWorkflow";
import { CustomSelect, type SelectOption } from "./CustomSelect";

const statusTone: Record<ListingStatus, string> = {
  new: "border-white/12 bg-white/[0.06] text-white/68",
  interested: "border-brass/35 bg-brass/12 text-brass",
  applied: "border-mint/35 bg-mint/12 text-mint",
  viewing_planned: "border-[#a78bfa]/35 bg-[#7c3aed]/14 text-[#c4b5fd]",
  rejected: "border-danger/28 bg-danger/10 text-danger",
  hidden: "border-white/10 bg-white/[0.025] text-white/38",
};

const statusMark: Record<ListingStatus, string> = {
  new: "N",
  interested: "I",
  applied: "A",
  viewing_planned: "V",
  rejected: "R",
  hidden: "H",
};

export function statusLabel(status: ListingStatus, language: Language) {
  return i18n[language].workflow.labels[status];
}

export function StatusBadge({
  status,
  language,
}: {
  status: ListingStatus;
  language: Language;
}) {
  return (
    <motion.span
      key={status}
      initial={{ opacity: 0, y: 4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18 }}
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone[status]}`}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current/25 text-[9px]">
        {statusMark[status]}
      </span>
      {statusLabel(status, language)}
    </motion.span>
  );
}

export function ListingStatusControl({
  status,
  language,
  onChange,
  compact = false,
}: {
  status: ListingStatus;
  language: Language;
  onChange: (status: ListingStatus) => void;
  compact?: boolean;
}) {
  const copy = i18n[language].workflow;
  const options: Array<SelectOption<ListingStatus>> = listingStatuses.map((listingStatus) => ({
    label: copy.labels[listingStatus],
    value: listingStatus,
  }));

  if (compact) {
    return (
      <motion.div
        layout
        className="flex shrink-0 items-center gap-1"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {listingStatuses.map((listingStatus) => {
          const active = listingStatus === status;

          return (
            <motion.button
              key={listingStatus}
              type="button"
              title={copy.labels[listingStatus]}
              aria-label={copy.labels[listingStatus]}
              whileTap={{ scale: 0.92 }}
              onClick={() => onChange(listingStatus)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[10px] font-semibold transition ${
                active
                  ? statusTone[listingStatus]
                  : "border-white/10 bg-black/18 text-white/38 hover:border-white/22 hover:text-white"
              }`}
            >
              {statusMark[listingStatus]}
            </motion.button>
          );
        })}
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      className="w-full"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <CustomSelect
        label={compact ? undefined : copy.status}
        value={status}
        options={options}
        onChange={onChange}
      />
    </motion.div>
  );
}

export function QuickStatusActions({
  status,
  language,
  onChange,
}: {
  status: ListingStatus;
  language: Language;
  onChange: (status: ListingStatus) => void;
}) {
  const copy = i18n[language].workflow;
  const actions: Array<{ label: string; value: ListingStatus }> = [
    { label: copy.markInterested, value: "interested" },
    { label: copy.markApplied, value: "applied" },
    { label: copy.markViewing, value: "viewing_planned" },
    { label: copy.reject, value: "rejected" },
    { label: copy.hide, value: "hidden" },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {actions.map((action) => {
        const active = action.value === status;

        return (
          <motion.button
            key={action.value}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(action.value)}
            className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${
              active
                ? statusTone[action.value]
                : "border-white/10 bg-black/18 text-white/62 hover:border-white/22 hover:text-white"
            }`}
          >
            {action.label}
          </motion.button>
        );
      })}
    </div>
  );
}
