"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Listing, ListingStatus } from "@/types/listing";
import { i18n, type Language } from "@/lib/i18n";
import {
  cleanTitle,
  createSummary,
  descriptionSections,
  formatPrice,
  propertyTypeLabel,
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
    <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-white/38">{label}</div>
      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
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
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
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

  return (
    <AnimatePresence>
      {listing ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/74 p-3 backdrop-blur-md sm:items-center sm:p-6"
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
            className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-[#0f1218] shadow-[0_30px_110px_rgba(0,0,0,0.68)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="max-h-[92vh] overflow-y-auto pb-28">
              <div className="relative overflow-hidden border-b border-white/10">
                <ListingImage listing={listing} language={language} large />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0f1218] via-[#0f1218]/70 to-transparent p-6">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-brass/25 bg-brass/12 px-3 py-1 text-xs font-semibold text-brass">
                      {propertyTypeLabel(listing.property_type, language)}
                    </span>
                    {listing.is_shared ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-semibold text-white/62">
                        {listingCopy.shared}
                      </span>
                    ) : null}
                    {listing.shared_laundry ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-semibold text-white/62">
                        {listingCopy.sharedLaundry}
                      </span>
                    ) : null}
                    {listing.availability_status === "rented" ||
                    listing.availability_status === "under_option" ? (
                      <span className="rounded-full border border-danger/28 bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">
                        {listingCopy.availability[listing.availability_status]}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <h2 className="max-w-4xl text-2xl font-semibold leading-tight text-white sm:text-4xl">
                        {cleanTitle(listing.title)}
                      </h2>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/62">
                        {createSummary(listing, 220)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-black/35 text-xl leading-none text-white/70 transition hover:border-white/25 hover:text-white"
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
                    <p className="text-sm leading-6 text-white/64">
                      {createSummary(listing, 260)}
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
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/38">
                          {workflowCopy.quickActions}
                        </div>
                        <QuickStatusActions
                          status={status}
                          language={language}
                          onChange={(nextStatus) => onStatusChange(listing, nextStatus)}
                        />
                      </div>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/38">
                          {workflowCopy.note}
                        </span>
                        <textarea
                          value={note}
                          onChange={(event) => onNoteChange(listing, event.target.value)}
                          placeholder={workflowCopy.notePlaceholder}
                          className="min-h-20 w-full resize-none rounded-xl border border-white/10 bg-black/18 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-brass/60 focus:ring-2 focus:ring-brass/20"
                        />
                      </label>
                    </div>
                  </Section>

                  <Section title={copy.description}>
                    <p className="mb-3 text-xs leading-5 text-white/38">
                      {listingCopy.originalLanguageNote}
                    </p>
                    <div className={`${expanded ? "max-h-80" : "max-h-32"} overflow-y-auto pr-2 transition-all`}>
                      <div className="space-y-3">
                        {descriptionSections(listing.description, language).map((paragraph, index) => (
                          <p key={index} className="text-sm leading-6 text-white/62">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpanded((current) => !current)}
                      className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/62 transition hover:border-white/25 hover:text-white"
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
                      <DetailBlock
                        label={listingCopy.area}
                        value={listing.area_m2 ? `${listing.area_m2} m2` : listingCopy.notAvailable}
                      />
                      <DetailBlock label={listingCopy.rooms} value={listing.rooms ?? listingCopy.notAvailable} />
                    </div>
                  </Section>

                  <Section title={copy.source}>
                    <div className="space-y-3 text-sm text-white/62">
                      <div className="flex items-center justify-between gap-3">
                        <span>{copy.platform}</span>
                        <span className="font-semibold text-white">{listing.source}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{copy.propertyType}</span>
                        <span className="font-semibold text-white">
                          {propertyTypeLabel(listing.property_type, language)}
                        </span>
                      </div>
                    </div>
                  </Section>
                </aside>

                <div className="pb-4 lg:col-span-2">
                  <ListingLocationMap listing={listing} language={language} />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-30 flex items-center justify-end gap-3 border-t border-white/10 bg-[#0f1218]/94 p-4 shadow-[0_-18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-xl border border-white/10 px-4 text-sm font-semibold text-white/62 transition hover:border-white/25 hover:text-white"
              >
                {copy.close}
              </button>
              <a
                href={listing.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => onToast(listingCopy.openingAd, "info")}
                className="flex h-11 items-center justify-center rounded-xl border border-brass/50 bg-brass px-5 text-sm font-semibold text-ink transition hover:bg-[#e6bd68]"
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
