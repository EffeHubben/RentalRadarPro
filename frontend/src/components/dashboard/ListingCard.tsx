"use client";

import { useEffect, useState } from "react";
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
  const hasUsableImage =
    Boolean(imageUrl) &&
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
      className={`${height} flex w-full items-center justify-center bg-[#111827]`}
    >
      <div className="px-8 py-7 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/50">
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
        <div className="text-sm font-semibold text-white">{copy.noPhoto}</div>
        <div className="mt-1 text-xs text-white/42">{copy.imagePendingHint}</div>
      </div>
    </motion.div>
  );
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
          ? "border-cyan-200/35 bg-cyan-300/12 text-cyan-100"
          : muted
          ? "border-white/10 bg-white/[0.04] text-white/45"
          : "border-white/12 bg-white/[0.07] text-white/72"
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

export function ListingCard({
  listing,
  index,
  onOpen,
  onToast,
  language,
  status,
  onStatusChange,
}: {
  listing: Listing;
  index: number;
  onOpen: (listing: Listing) => void;
  onToast: (message: string, type?: "success" | "error" | "info") => void;
  language: Language;
  status: ListingStatus;
  onStatusChange: (listing: Listing, status: ListingStatus) => void;
}) {
  const summary = createSummary(listing);
  const copy = i18n[language].listing;
  const confidence = listing.confidence_score ?? 0.45;
  const lowConfidence = confidence < 0.45;
  const unavailable =
    listing.availability_status === "rented" ||
    listing.availability_status === "under_option" ||
    listing.availability_status === "reserved";
  const strongMatch = confidence >= 0.75 && !unavailable;
  const [hasLoadedRealImage, setHasLoadedRealImage] = useState(false);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.992 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.035, 0.28) }}
      onClick={() => onOpen(listing)}
      className={`group cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-premium outline-none transition duration-300 hover:border-white/22 hover:bg-white/[0.05] ${
        lowConfidence || unavailable ? "opacity-[0.72] saturate-[0.82]" : ""
      }`}
    >
      <div className="relative overflow-hidden border-b border-white/10">
        <ImageBlock
          listing={listing}
          language={language}
          onImageStateChange={setHasLoadedRealImage}
        />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <Badge>{propertyTypeLabel(listing.property_type, language)}</Badge>
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
          <div className="mb-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.14em] text-white/40">
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
          <h2 className="line-clamp-2 min-h-14 text-lg font-semibold leading-7 text-white">
            {cleanTitle(listing.title)}
          </h2>
          <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-white/50">
            {summary || copy.noSummary}
          </p>
          <p className="mt-2 text-[11px] leading-4 text-white/32">
            {copy.originalLanguageNote}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-black/16 p-3">
            <div className="text-white/38">{copy.rent}</div>
            <div className="mt-1 font-semibold text-cyan-100">{formatPrice(listing.price, language)}</div>
          </div>
          <div className="rounded-lg bg-black/16 p-3">
            <div className="text-white/38">{copy.area}</div>
            <div className="mt-1 font-semibold text-white">
              {listing.area_m2 ? `${listing.area_m2} m2` : copy.notAvailable}
            </div>
          </div>
          <div className="rounded-lg bg-black/16 p-3">
            <div className="text-white/38">{copy.rooms}</div>
            <div className="mt-1 font-semibold text-white">{listing.rooms ?? copy.notAvailable}</div>
          </div>
        </div>

        <PrivacyBadges listing={listing} language={language} />

        <div className="flex flex-wrap gap-2">
          {hasLoadedRealImage ? <Badge>{copy.photoAvailable}</Badge> : null}
          {wasSeenRecently(listing) ? <Badge>{copy.recentlySeen}</Badge> : null}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-sm text-white/45">{listing.city ?? copy.cityUnknown}</span>
          <a
            href={listing.url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              event.stopPropagation();
              onToast(copy.openingAd, "info");
            }}
            className="rounded-lg border border-white/12 bg-white/[0.045] px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-brass/40 hover:text-white"
          >
            {copy.openAd}
          </a>
        </div>
      </div>
    </motion.article>
  );
}
