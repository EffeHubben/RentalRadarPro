import type { Metadata } from "next";
import { ListingDetailClient } from "./ListingDetailClient";

interface PageProps {
  params: { slug: string };
}

function extractListingId(slug: string): number | null {
  const id = parseInt(slug.split("-")[0], 10);
  return isNaN(id) ? null : id;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = extractListingId(params.slug);

  if (!id) {
    return { title: "Rental listing – RentScout" };
  }

  try {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api").replace(/\/+$/, "");
    const res = await fetch(`${apiBase}/listings/${id}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return { title: "Rental listing – RentScout" };
    }

    const listing = (await res.json()) as {
      city?: string | null;
      price?: number | null;
      property_type?: string;
      image_url?: string | null;
    };

    const typeStr =
      listing.property_type && listing.property_type !== "unknown"
        ? capitalize(listing.property_type)
        : "Rental";
    const cityStr = listing.city ? ` in ${listing.city}` : "";
    const priceStr = listing.price ? ` · €${listing.price}/mo` : "";

    const title = `${typeStr}${cityStr}${priceStr} – RentScout`;
    const description = `Find this rental${cityStr} on RentScout. Compare listings from multiple sources in one calm overview.`;
    const canonicalUrl = `/listing/${params.slug}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title,
        description,
        type: "website",
        ...(listing.image_url ? { images: [{ url: listing.image_url }] } : {}),
      },
    };
  } catch {
    return { title: "Rental listing – RentScout" };
  }
}

export default function ListingDetailPage({ params }: PageProps) {
  return <ListingDetailClient slug={params.slug} />;
}
