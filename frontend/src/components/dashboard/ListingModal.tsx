"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import type { Listing, ListingStatus } from "@/types/listing";
import { i18n, type Language } from "@/lib/i18n";
import {
  cleanTitle,
  createListingSubtitle,
  createSummary,
  descriptionSections,
  formatArea,
  formatPrice,
  listingTypeLabel,
} from "./helpers";
import { ListingImage, PrivacyBadges } from "./ListingCard";
import { ListingLocationMap } from "./ListingLocationMap";
import {
  ListingStatusControl,
  QuickStatusActions,
  StatusBadge,
} from "./ListingStatusControl";

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rs-modal-section rounded-2xl p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-subtle)]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[var(--color-text)]">{value}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rs-modal-section rounded-2xl p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{title}</h3>
      {children}
    </section>
  );
}

export function ListingModal({
  listing,
  onClose,
  onToast,
  language,
  status,
  onStatusChange,
  note,
  onNoteChange,
}: {
  listing: Listing | null;
  onClose: () => void;
  onToast: (message: string, type?: "success" | "error" | "info") => void;
  language: Language;
  status: ListingStatus;
  onStatusChange: (listing: Listing, status: ListingStatus) => void;
  note: string;
  onNoteChange: (listing: Listing, note: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const copy = i18n[language].modal;
  const listingCopy = i18n[language].listing;
  const workflowCopy = i18n[language].workflow;
  const summary = listing ? createSummary(listing, 260) : "";
  const subtitle = listing ? createListingSubtitle(listing, language) : "";

  return (
    <AnimatePresence>
      {listing ? (
        <motion.div
          className="rs-modal-backdrop fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6"
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(16px)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={listing.title}
            initial={{ opacity: 0, y: 34, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: "spring", damping: 24, stiffness: 250 }}
            className="rs-modal-panel max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="max-h-[92vh] overflow-y-auto pb-28">
              <div className="relative overflow-hidden border-b border-[var(--color-border)]">
                <ListingImage listing={listing} language={language} large />
                <div
                  className="absolute inset-x-0 bottom-0 p-6"
                  style={{ background: "var(--color-modal-image-scrim)" }}
                >
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-brass/25 bg-brass/12 px-3 py-1 text-xs font-semibold text-brass">
                      {listingTypeLabel(listing.property_type, listing.property_type_sub, language)}
                    </span>
                    {listing.is_shared ? (
                      <span className="rs-chip rounded-full px-3 py-1 text-xs font-semibold">
                        {listingCopy.shared}
                      </span>
                    ) : null}
                    {listing.shared_laundry ? (
                      <span className="rs-chip rounded-full px-3 py-1 text-xs font-semibold">
                        {listingCopy.sharedLaundry}
                      </span>
                    ) : null}
                    {listing.availability_status === "rented" ||
                    listing.availability_status === "under_option" ||
                    listing.availability_status === "reserved" ? (
                      <span className="rounded-full border border-danger/28 bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">
                        {listingCopy.availability[listing.availability_status]}
                      </span>
                    ) : null}
                    {(listing.source_count ?? 1) > 1 || listing.duplicate_sources.length > 1 ? (
                      <span className="rs-chip-positive rounded-full px-3 py-1 text-xs font-semibold">
                        {listingCopy.alsoOnOtherSources}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <h2 className="max-w-4xl text-2xl font-semibold leading-tight text-[var(--color-text)] sm:text-4xl">
                        {cleanTitle(listing.title)}
                      </h2>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
                        {subtitle || summary || listingCopy.noSummary}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rs-control h-10 w-10 shrink-0 rounded-xl text-xl leading-none"
                      aria-label={copy.close}
                    >
                      x
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_22rem]">
                <div className="space-y-5">
                  <Section title={copy.about}>
                    <p className="text-sm leading-6 text-[var(--color-muted)]">
                      {summary || listingCopy.noSummary}
                    </p>
                  </Section>

                  <Section title={copy.privacy}>
                    <PrivacyBadges listing={listing} language={language} />
                  </Section>

                  <Section title={workflowCopy.title}>
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <StatusBadge status={status} language={language} />
                        <div className="w-full sm:w-56">
                          <ListingStatusControl
                            status={status}
                            language={language}
                            onChange={(nextStatus) => onStatusChange(listing, nextStatus)}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                          {workflowCopy.quickActions}
                        </div>
                        <QuickStatusActions
                          status={status}
                          language={language}
                          onChange={(nextStatus) => onStatusChange(listing, nextStatus)}
                        />
                      </div>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                          {workflowCopy.note}
                        </span>
                        <textarea
                          value={note}
                          onChange={(event) => onNoteChange(listing, event.target.value)}
                          placeholder={workflowCopy.notePlaceholder}
                          className="rs-modal-input min-h-20 w-full resize-none px-3 py-3 text-sm leading-6"
                        />
                      </label>
                    </div>
                  </Section>

                  <Section title={copy.description}>
                    <p className="mb-3 text-xs leading-5 text-[var(--color-subtle)]">
                      {listingCopy.originalLanguageNote}
                    </p>
                    <div className={`${expanded ? "max-h-80" : "max-h-32"} overflow-y-auto pr-2 transition-all`}>
                      <div className="space-y-3">
                        {descriptionSections(listing.description, language).map((paragraph, index) => (
                          <p key={index} className="text-sm leading-6 text-[var(--color-muted)]">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpanded((current) => !current)}
                      className="rs-control mt-3 rounded-lg px-3 py-2 text-xs font-semibold"
                    >
                      {expanded ? copy.less : copy.fullDescription}
                    </button>
                  </Section>
                </div>

                <aside className="space-y-5">
                  <Section title={copy.features}>
                    <div className="grid grid-cols-2 gap-2">
                      <DetailBlock label={listingCopy.rent} value={formatPrice(listing.price, language)} />
                      <DetailBlock
                        label={copy.city}
                        value={listing.city ?? listingCopy.unknown}
                      />
                      <DetailBlock label={listingCopy.area} value={formatArea(listing.area_m2, language)} />
                      <DetailBlock label={listingCopy.rooms} value={listing.rooms ?? listingCopy.notAvailable} />
                    </div>
                  </Section>

                  <Section title={copy.source}>
                    <div className="space-y-3 text-sm text-[var(--color-muted)]">
                      <div className="flex items-center justify-between gap-3">
                        <span>{copy.platform}</span>
                        <span className="font-semibold text-[var(--color-text)]">{listing.source}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{copy.propertyType}</span>
                        <span className="font-semibold text-[var(--color-text)]">
                          {listingTypeLabel(listing.property_type, listing.property_type_sub, language)}
                        </span>
                      </div>
                      {!listing.image_url ? (
                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-modal-panel-subtle)] px-3 py-2 text-xs leading-5 text-[var(--color-muted)]">
                          <span className="font-semibold text-[var(--color-text)]">
                            {listingCopy.noPhoto}
                          </span>
                          <br />
                          {listingCopy.imagePendingHint}
                        </div>
                      ) : null}
                    </div>
                  </Section>

                  {listing.duplicate_sources.length > 1 ? (
                    <Section title={copy.alsoFoundOn}>
                      <div className="space-y-2">
                        {listing.duplicate_sources.map((source) => (
                          <a
                            key={`${source.id}-${source.url}`}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => onToast(listingCopy.openingAd, "info")}
                            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-modal-panel-subtle)] px-3 py-2 text-sm text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                          >
                            <span className="min-w-0 truncate font-semibold">{source.source}</span>
                            <span className="rs-chip-positive shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold">
                              {listingCopy.openAd}
                            </span>
                          </a>
                        ))}
                      </div>
                    </Section>
                  ) : null}
                </aside>

                <div className="pb-4 lg:col-span-2">
                  <ListingLocationMap listing={listing} language={language} />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-30 flex items-center justify-end gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-[0_-18px_60px_rgba(50,42,31,0.10)] backdrop-blur-xl">
              <button
                type="button"
                onClick={onClose}
                className="rs-control h-11 rounded-xl px-4 text-sm font-semibold"
              >
                {copy.close}
              </button>
              <Link
                href={`/listing/${[
                  listing.id,
                  listing.city?.toLowerCase().replace(/\s+/g, "-"),
                  listing.property_type !== "unknown" ? listing.property_type : null,
                ].filter(Boolean).join("-")}`}
                className="rs-control h-11 inline-flex items-center rounded-xl px-4 text-sm font-semibold"
              >
                {listingCopy.viewPage}
              </Link>
              <a
                href={listing.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => onToast(listingCopy.openingAd, "info")}
                className="rs-primary-button flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
              >
                {listingCopy.openAd}
              </a>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
