"use client";

import { forwardRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Listing, ListingStatus } from "@/types/listing";
import { i18n, type Language } from "@/lib/i18n";
import {
  cleanTitle,
  createSummary,
  featureLabel,
  formatPrice,
  listingDate,
  propertyTypeLabel,
} from "./helpers";
import { ListingStatusControl, StatusBadge } from "./ListingStatusControl";

function ImageBlock({
  listing,
  language,
  large = false,
  onImageStateChange,
}: {
  listing: Listing;
  language: Language;
  large?: boolean;
  onImageStateChange?: (hasLoadedRealImage: boolean) => void;
}) {
  const height = large ? "h-72 sm:h-[28rem]" : "h-56";
  const copy = i18n[language].listing;
  const [failed, setFailed] = useState(false);
  const imageUrl = listing.image_url?.trim() ?? "";
  const imageHost = imageUrl ? safeImageHost(imageUrl) : "";
  const hasUsableImage =
    Boolean(imageUrl) &&
    !blockedImageHosts.has(imageHost) &&
    !imageUrl.toLowerCase().includes("photo_waiting") &&
    !imageUrl.toLowerCase().includes("placeholder");

  useEffect(() => {
    setFailed(false);
    onImageStateChange?.(false);
  }, [imageUrl, onImageStateChange]);

  if (hasUsableImage && !failed) {
    return (
      <motion.img
        key={imageUrl}
        src={imageUrl}
        alt=""
        initial={{ opacity: 0, scale: 1.015 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        onLoad={() => onImageStateChange?.(true)}
        onError={() => {
          setFailed(true);
          onImageStateChange?.(false);
        }}
        className={`${height} w-full object-cover transition duration-500 group-hover:scale-[1.025]`}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28 }}
      className={`${height} flex w-full items-center justify-center bg-[var(--color-soft)]`}
    >
      <div className="px-8 py-7 text-center">
        <div className="rs-chip mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-10 w-10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 11 9-7 9 7" />
            <path d="M5 10v10h14V10" />
            <path d="M9 20v-6h6v6" />
          </svg>
        </div>
        <div className="text-sm font-semibold text-[var(--color-text)]">{copy.noPhoto}</div>
        <div className="rs-muted mt-1 text-xs">{copy.imagePendingHint}</div>
      </div>
    </motion.div>
  );
}

const blockedImageHosts = new Set(["b.static.nbo.nl"]);

function safeImageHost(imageUrl: string) {
  try {
    return new URL(imageUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function Badge({
  children,
  muted = false,
  accent = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        accent
          ? "rs-chip-positive"
          : muted
          ? "rs-chip opacity-75"
          : "rs-chip"
      }`}
    >
      {children}
    </span>
  );
}

function wasSeenRecently(listing: Listing) {
  const date = new Date(listing.last_seen_at ?? listing.created_at);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return Date.now() - date.getTime() <= 3 * 24 * 60 * 60 * 1000;
}

function isNewListing(listing: Listing) {
  const date = new Date(listing.first_seen_at ?? listing.created_at);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return Date.now() - date.getTime() <= 24 * 60 * 60 * 1000;
}

function formatDateTime(value: string | null | undefined, language: Language) {
  if (!value) {
    return i18n[language].listing.notAvailable;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return i18n[language].listing.notAvailable;
  }

  return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function PrivacyBadges({
  listing,
  language,
}: {
  listing: Listing;
  language: Language;
}) {
  const copy = i18n[language].listing;

  return (
    <div className="flex flex-wrap gap-2">
      {listing.is_shared === false ? <Badge accent>{copy.independent}</Badge> : null}
      <Badge muted={listing.private_kitchen !== true}>
        {featureLabel(listing.private_kitchen, copy.privateKitchen, copy.sharedKitchen, language)}
      </Badge>
      <Badge muted={listing.private_bathroom !== true}>
        {featureLabel(
          listing.private_bathroom,
          copy.privateBathroom,
          copy.sharedBathroom,
          language,
        )}
      </Badge>
      <Badge muted={listing.private_toilet !== true}>
        {featureLabel(listing.private_toilet, copy.privateToilet, copy.sharedToilet, language)}
      </Badge>
      {listing.shared_laundry === true ? <Badge muted>{copy.sharedLaundry}</Badge> : null}
      {listing.is_shared === true ? <Badge muted>{copy.shared}</Badge> : null}
    </div>
  );
}

export function ListingImage(props: { listing: Listing; language: Language; large?: boolean }) {
  return <ImageBlock {...props} />;
}

function PreviewListingCard({
  listing,
  index,
  language,
}: {
  listing: Listing;
  index: number;
  language: Language;
}) {
  const copy = i18n[language].listing;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.035, 0.28) }}
      className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
    >
      <div className="flex h-56 flex-col items-center justify-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-soft)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-7 w-7 text-[var(--color-subtle)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="text-sm font-semibold text-[var(--color-muted)]">{copy.lockedPreview}</div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          <Badge>{propertyTypeLabel(listing.property_type, language)}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-[var(--color-soft)] p-3">
            <div className="rs-subtle">{copy.rent}</div>
            <div className="mt-1 font-semibold text-[var(--color-accent-strong)]">
              {formatPrice(listing.price, language)}
            </div>
          </div>
          <div className="rounded-lg bg-[var(--color-soft)] p-3">
            <div className="rs-subtle">{copy.location}</div>
            <div className="mt-1 font-semibold text-[var(--color-text)]">
              {listing.city ?? copy.cityUnknown}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-3">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-[var(--color-subtle)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="rs-muted text-xs">{copy.lockedDetails}</span>
        </div>
      </div>
    </motion.article>
  );
}

type ListingCardProps = {
  listing: Listing;
  index: number;
  onOpen: (listing: Listing) => void;
  onToast: (message: string, type?: "success" | "error" | "info") => void;
  language: Language;
  status: ListingStatus;
  onStatusChange: (listing: Listing, status: ListingStatus) => void;
  previewOnly?: boolean;
};

export const ListingCard = forwardRef<HTMLElement, ListingCardProps>(function ListingCard(
  {
    listing,
    index,
    onOpen,
    onToast,
    language,
    status,
    onStatusChange,
    previewOnly,
  },
  ref,
) {
  const summary = createSummary(listing);
  const copy = i18n[language].listing;
  const confidence = listing.confidence_score ?? 0.45;
  const lowConfidence = confidence < 0.45;
  const unavailable =
    listing.availability_status === "rented" ||
    listing.availability_status === "under_option" ||
    listing.availability_status === "reserved";
  const strongMatch = confidence >= 0.75 && !unavailable;
  const newListing = isNewListing(listing);
  const [hasLoadedRealImage, setHasLoadedRealImage] = useState(false);

  if (previewOnly) {
    return <PreviewListingCard listing={listing} index={index} language={language} />;
  }

  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.992 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.035, 0.28) }}
      onClick={() => onOpen(listing)}
      className={`group cursor-pointer overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)] outline-none transition duration-300 hover:-translate-y-1 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-hover)] ${
        lowConfidence || unavailable ? "opacity-[0.72] saturate-[0.82]" : ""
      }`}
    >
      <div className="relative overflow-hidden border-b border-[var(--color-border)]">
        <ImageBlock
          listing={listing}
          language={language}
          onImageStateChange={setHasLoadedRealImage}
        />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <Badge>{propertyTypeLabel(listing.property_type, language)}</Badge>
          {newListing ? <Badge accent>{copy.newBadge}</Badge> : null}
          {strongMatch ? <Badge accent>{copy.strongMatch}</Badge> : null}
          {unavailable ? (
            <Badge muted>{copy.availability[listing.availability_status]}</Badge>
          ) : null}
          {(listing.source_count ?? 1) > 1 || listing.duplicate_sources.length > 1 ? (
            <Badge>{copy.alsoOnOtherSources}</Badge>
          ) : null}
          {listing.is_woningruil ? <Badge muted>{copy.houseSwap}</Badge> : null}
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <div className="rs-subtle mb-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.14em]">
            <span>{listing.source}</span>
            <span>{listingDate(listing, language)}</span>
          </div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <StatusBadge status={status} language={language} />
            <ListingStatusControl
              compact
              status={status}
              language={language}
              onChange={(nextStatus) => onStatusChange(listing, nextStatus)}
            />
          </div>
          <h2 className="line-clamp-2 min-h-14 text-lg font-semibold leading-7 text-[var(--color-text)]">
            {cleanTitle(listing.title)}
          </h2>
          <p className="rs-muted mt-3 line-clamp-2 min-h-10 text-sm leading-5">
            {summary || copy.noSummary}
          </p>
          <p className="rs-subtle mt-2 text-[11px] leading-4">
            {copy.originalLanguageNote}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-[var(--color-soft)] p-3">
            <div className="rs-subtle">{copy.rent}</div>
            <div className="mt-1 font-semibold text-[var(--color-accent-strong)]">{formatPrice(listing.price, language)}</div>
          </div>
          <div className="rounded-lg bg-[var(--color-soft)] p-3">
            <div className="rs-subtle">{copy.area}</div>
            <div className="mt-1 font-semibold text-[var(--color-text)]">
              {listing.area_m2 ? `${listing.area_m2} m2` : copy.notAvailable}
            </div>
          </div>
          <div className="rounded-lg bg-[var(--color-soft)] p-3">
            <div className="rs-subtle">{copy.rooms}</div>
            <div className="mt-1 font-semibold text-[var(--color-text)]">{listing.rooms ?? copy.notAvailable}</div>
          </div>
        </div>

        <PrivacyBadges listing={listing} language={language} />

        <div className="flex flex-wrap gap-2">
          {hasLoadedRealImage ? <Badge>{copy.photoAvailable}</Badge> : null}
          {wasSeenRecently(listing) ? <Badge>{copy.recentlySeen}</Badge> : null}
        </div>

        <div className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="rs-subtle">{copy.firstSeen}</span>
            <span className="font-semibold text-[var(--color-text)]">
              {formatDateTime(listing.first_seen_at ?? listing.created_at, language)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="rs-subtle">{copy.lastChecked}</span>
            <span className="font-semibold text-[var(--color-text)]">
              {formatDateTime(listing.last_checked_at ?? listing.last_seen_at, language)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
          <span className="rs-muted text-sm">{listing.city ?? copy.cityUnknown}</span>
          <a
            href={listing.url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              event.stopPropagation();
              onToast(copy.openingAd, "info");
            }}
            className="rs-control rounded-lg px-3 py-2 text-xs font-semibold"
          >
            {copy.openAd}
          </a>
        </div>
      </div>
    </motion.article>
  );
});
