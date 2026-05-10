"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Listing, LocationPrecision } from "@/types/listing";
import { i18n, type Language } from "@/lib/i18n";

type Coordinates = {
  lat: number;
  lon: number;
  label: string;
  precision: LocationPrecision;
  source: "listing" | "city_fallback";
};

const precisionZoom: Record<LocationPrecision, { latDelta: number; lonDelta: number }> = {
  exact_address: { latDelta: 0.005, lonDelta: 0.008 },
  street: { latDelta: 0.009, lonDelta: 0.014 },
  postcode: { latDelta: 0.015, lonDelta: 0.024 },
  city: { latDelta: 0.038, lonDelta: 0.058 },
  unknown: { latDelta: 0.038, lonDelta: 0.058 },
};

const cityCoordinates: Record<string, { lat: number; lon: number; label: string }> = {
  amsterdam: { lat: 52.3676, lon: 4.9041, label: "Amsterdam" },
  rotterdam: { lat: 51.9244, lon: 4.4777, label: "Rotterdam" },
  "den haag": { lat: 52.0705, lon: 4.3007, label: "Den Haag" },
  "the hague": { lat: 52.0705, lon: 4.3007, label: "Den Haag" },
  utrecht: { lat: 52.0907, lon: 5.1214, label: "Utrecht" },
  eindhoven: { lat: 51.4416, lon: 5.4697, label: "Eindhoven" },
  tilburg: { lat: 51.5555, lon: 5.0913, label: "Tilburg" },
  breda: { lat: 51.5719, lon: 4.7683, label: "Breda" },
  "den bosch": { lat: 51.6978, lon: 5.3037, label: "Den Bosch" },
  "'s-hertogenbosch": { lat: 51.6978, lon: 5.3037, label: "'s-Hertogenbosch" },
  nijmegen: { lat: 51.8126, lon: 5.8372, label: "Nijmegen" },
  arnhem: { lat: 51.9851, lon: 5.8987, label: "Arnhem" },
  groningen: { lat: 53.2194, lon: 6.5665, label: "Groningen" },
  maastricht: { lat: 50.8514, lon: 5.691, label: "Maastricht" },
  leiden: { lat: 52.1601, lon: 4.497, label: "Leiden" },
  delft: { lat: 52.0116, lon: 4.3571, label: "Delft" },
  haarlem: { lat: 52.3874, lon: 4.6462, label: "Haarlem" },
  almere: { lat: 52.3508, lon: 5.2647, label: "Almere" },
  amersfoort: { lat: 52.1561, lon: 5.3878, label: "Amersfoort" },
  apeldoorn: { lat: 52.2112, lon: 5.9699, label: "Apeldoorn" },
  enschede: { lat: 52.2215, lon: 6.8937, label: "Enschede" },
  zwolle: { lat: 52.5168, lon: 6.083, label: "Zwolle" },
  dordrecht: { lat: 51.8133, lon: 4.6901, label: "Dordrecht" },
  zoetermeer: { lat: 52.0552, lon: 4.4941, label: "Zoetermeer" },
  "etten-leur": { lat: 51.5706, lon: 4.6367, label: "Etten-Leur" },
  roosendaal: { lat: 51.5308, lon: 4.4653, label: "Roosendaal" },
  "bergen op zoom": { lat: 51.4946, lon: 4.2872, label: "Bergen op Zoom" },
  oosterhout: { lat: 51.645, lon: 4.8597, label: "Oosterhout" },
  prinsenbeek: { lat: 51.5987, lon: 4.7126, label: "Prinsenbeek" },
};

function normalize(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function cityFallback(city: string | null | undefined) {
  const normalized = normalize(city).toLowerCase();
  return cityCoordinates[normalized] ?? null;
}

function createMapUrl(coordinates: Coordinates) {
  const zoom = precisionZoom[coordinates.precision] ?? precisionZoom.unknown;
  const left = coordinates.lon - zoom.lonDelta;
  const right = coordinates.lon + zoom.lonDelta;
  const bottom = coordinates.lat - zoom.latDelta;
  const top = coordinates.lat + zoom.latDelta;
  const marker =
    coordinates.precision === "city"
      ? ""
      : `&marker=${coordinates.lat}%2C${coordinates.lon}`;

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik${marker}`;
}

function precisionTone(precision: LocationPrecision) {
  if (precision === "exact_address") {
    return "border-mint/30 bg-mint/10 text-mint";
  }

  if (precision === "street" || precision === "postcode") {
    return "border-brass/30 bg-brass/10 text-brass";
  }

  return "border-white/10 bg-black/22 text-white/54";
}

export function ListingLocationMap({
  listing,
  language,
}: {
  listing: Listing;
  language: Language;
}) {
  const copy = i18n[language].modal;
  const [readyToRenderMap] = useState(true);
  const listedPrecision = listing.location_precision ?? "unknown";
  const hasAddress = Boolean(normalize(listing.address_text) || normalize(listing.postal_code));
  const mapsQuery = normalize(listing.address_text) || normalize(listing.city);
  const coordinates = useMemo<Coordinates | null>(() => {
    if (typeof listing.latitude === "number" && typeof listing.longitude === "number") {
      return {
        lat: listing.latitude,
        lon: listing.longitude,
        label: normalize(listing.address_text) || normalize(listing.city) || copy.location,
        precision: listedPrecision === "unknown" ? "city" : listedPrecision,
        source: "listing",
      };
    }

    const fallback = cityFallback(listing.city);

    if (!fallback) {
      return null;
    }

    return {
      lat: fallback.lat,
      lon: fallback.lon,
      label: fallback.label,
      precision: "city",
      source: "city_fallback",
    };
  }, [
    copy.location,
    listedPrecision,
    listing.address_text,
    listing.city,
    listing.latitude,
    listing.longitude,
  ]);
  const effectivePrecision = coordinates?.precision ?? (hasAddress ? "city" : "unknown");
  const hasMap = Boolean(coordinates);
  const hasAddressWithCityFallback = hasAddress && coordinates?.source === "city_fallback";
  const showUnknown = !hasMap && !hasAddress && !normalize(listing.city);
  const isApproximate =
    effectivePrecision === "city" ||
    effectivePrecision === "postcode" ||
    effectivePrecision === "street";
  const googleMapsUrl = mapsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
    : "";

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(110,231,183,0.10),transparent_18rem),rgba(255,255,255,0.035)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{copy.location}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/45">
            {hasAddressWithCityFallback
              ? copy.locationAddressFoundNoCoordinates
              : showUnknown
                ? copy.locationNoUsefulData
                : copy.locationPrecisionNotes[effectivePrecision]}
          </p>
          {listing.address_text ? (
            <p className="mt-2 text-xs font-semibold text-white/62">{listing.address_text}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border border-brass/25 bg-brass/10 px-3 py-1 text-xs font-semibold text-brass">
            {normalize(listing.city) || copy.city}
          </div>
          {hasAddressWithCityFallback ? (
            <div className="rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-xs font-semibold text-mint">
              {copy.locationPrecision.address_found}
            </div>
          ) : null}
          {hasMap || !showUnknown ? (
            <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${precisionTone(effectivePrecision)}`}>
              {copy.locationPrecision[effectivePrecision]}
            </div>
          ) : null}
        </div>
      </div>
      {googleMapsUrl ? (
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mb-4 inline-flex h-10 items-center rounded-xl border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/62 transition hover:border-brass/35 hover:text-white"
        >
          {copy.openInGoogleMaps}
        </a>
      ) : null}

      <div className="relative h-[26rem] min-h-[360px] overflow-hidden rounded-[1.35rem] border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(110,231,183,0.12),transparent_18rem),linear-gradient(135deg,#10131a,#0b0d12)] shadow-[0_18px_70px_rgba(0,0,0,0.42),0_0_0_1px_rgba(255,255,255,0.03)]">
        {!readyToRenderMap ? (
          <div className="flex h-full items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
              className="h-10 w-10 rounded-full border-2 border-mint/20 border-t-mint"
            />
          </div>
        ) : hasMap && coordinates ? (
          <>
            <iframe
              key={createMapUrl(coordinates)}
              title={copy.location}
              src={createMapUrl(coordinates)}
              className={`relative z-0 h-full w-full border-0 opacity-90 grayscale saturate-[0.72] contrast-[0.98] sepia-[0.08] ${effectivePrecision === "city" ? "pointer-events-none" : ""}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(15,18,24,0.18),transparent_30%,rgba(15,18,24,0.22)),radial-gradient(circle_at_50%_50%,transparent_45%,rgba(15,18,24,0.16))] ring-1 ring-inset ring-white/10" />
            {isApproximate ? (
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                  effectivePrecision === "city"
                    ? "h-40 w-40 border-brass/35 bg-brass/10 shadow-[0_0_80px_rgba(215,168,79,0.22)]"
                    : "h-24 w-24 border-mint/30 bg-mint/10 shadow-[0_0_60px_rgba(110,231,183,0.18)]"
                }`}
              />
            ) : null}
            <div className="pointer-events-none absolute bottom-4 left-4 z-30 max-w-xs rounded-2xl border border-white/10 bg-[#0f1218]/84 px-3 py-2 text-xs leading-5 text-white/62 shadow-premium backdrop-blur-xl">
              <span className="font-semibold text-white">{copy.locationPrecision[effectivePrecision]}</span>
              <br />
              {hasAddressWithCityFallback
                ? copy.locationAddressFoundNoCoordinates
                : copy.locationPrecisionNotes[effectivePrecision]}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div className="rounded-2xl border border-white/10 bg-black/24 px-5 py-4 text-sm leading-6 text-white/52 shadow-premium">
              {showUnknown ? copy.locationNoUsefulData : copy.locationFallback}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
