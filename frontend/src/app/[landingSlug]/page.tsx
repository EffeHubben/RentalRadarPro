import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoLandingClient } from "@/components/seo/SeoLandingClient";
import {
  buildSeoLandingMetadata,
  getCanonicalPath,
  getSeoLandingBySlug,
  getSeoLandingStaticParams,
} from "@/lib/seo/landings";

type PageProps = {
  params: { landingSlug: string };
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getSeoLandingStaticParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const landing = getSeoLandingBySlug(params.landingSlug);

  if (!landing) {
    return {
      title: "RentScout",
      description: "RentScout",
    };
  }

  return buildSeoLandingMetadata(landing);
}

export default function SeoLandingPage({ params }: PageProps) {
  const landing = getSeoLandingBySlug(params.landingSlug);
  if (!landing) notFound();

  const canonical = `https://rentscout.nl${getCanonicalPath(landing.slug)}`;
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: landing.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "RentScout",
        item: "https://rentscout.nl",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: landing.title.replace(" | RentScout", ""),
        item: canonical,
      },
    ],
  };
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: landing.title,
    description: landing.metaDescription,
    url: canonical,
    inLanguage: "nl-NL",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />
      <SeoLandingClient landing={landing} />
    </>
  );
}
