"use client";

import { InfoPageLayout, languageRecord } from "@/components/site/InfoPageLayout";
import type { Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

const copy = languageRecord(
  {
    eyebrow: "Gebruiksvoorwaarden",
    title: "Gebruik van RentScout",
    intro:
      "RentScout is een digitaal SaaS-platform dat gebruikers helpt huurwoningen uit meerdere online bronnen te doorzoeken, filteren en beheren. Deze voorwaarden beschrijven de verwachtingen voor het gebruik van het platform.",
    sections: [
      {
        title: "Wat RentScout doet",
        body: [
          "RentScout biedt een digitaal dashboard waarmee gebruikers advertenties voor huurwoningen uit meerdere online bronnen kunnen bekijken, filteren en organiseren.",
          "RentScout is geen makelaar, verhuurder of eigenaar van woningen. Het platform publiceert en beheert zelf geen huurwoningadvertenties.",
          "Gebruikers moeten alle advertentiedetails, prijzen, beschikbaarheid en identiteit van de aanbieder altijd rechtstreeks verifiëren bij de oorspronkelijke bron, verhuurder, makelaar of platform.",
        ],
      },
      {
        title: "Externe links en bronnen",
        body: [
          "RentScout kan links tonen naar externe websites en platforms. RentScout heeft geen controle over die externe bronnen en is niet verantwoordelijk voor de inhoud, juistheid of beschikbaarheid ervan.",
          "Het gebruik van externe platforms valt onder de eigen voorwaarden van die platforms.",
        ],
      },
      {
        title: "Gratis en Pro toegang",
        body: [
          "RentScout heeft een gratis laag met beperkt gebruik en een betaald Pro-abonnement met uitgebreidere functies.",
          "Gratis gebruikers kunnen een beperkt aantal advertenties bekijken en basisfilters gebruiken. Pro geeft toegang tot volledige advertentiedetails, meer resultaten, geavanceerde filters, opgeslagen zoekprofielen en workflow- en statustracking.",
        ],
      },
      {
        title: "Abonnementen en facturering",
        body: [
          "Betaling voor Pro-abonnementen wordt verwerkt door Paddle. RentScout zelf bewaart geen volledige betaalgegevens.",
          "Gebruikers kunnen hun abonnement op elk moment annuleren via de beschikbare account- of factureringsflow. Annulering voorkomt toekomstige verlengingen.",
        ],
      },
      {
        title: "Geen garantie",
        body: [
          "RentScout biedt geen garantie dat een gebruiker een huurwoning zal vinden of verkrijgen.",
          "Advertenties op het platform zijn afkomstig uit externe bronnen en kunnen onvolledig, verouderd of niet langer beschikbaar zijn.",
        ],
      },
      {
        title: "Acceptabel gebruik",
        body: [
          "Gebruik van het platform voor scraping, geautomatiseerd misbruik, reverse engineering of ongeoorloofde toegang tot systemen is niet toegestaan.",
          "RentScout behoudt zich het recht voor om toegang te beperken of accounts te deactiveren bij schendingen van dit beleid.",
        ],
      },
      {
        title: "Contact",
        body: ["Voor vragen over deze voorwaarden kun je contact opnemen via contact@rentscout.nl."],
      },
    ],
    asideTitle: "Kern van de voorwaarden",
    asideBody: [
      "RentScout is een productiviteitslaag boven bestaande woningbronnen, geen verhuurplatform.",
      "Alle advertentiedetails moeten worden geverifieerd bij de originele aanbieder of verhuurder.",
      "Pro-abonnementen worden verwerkt via Paddle en kunnen op elk moment worden geannuleerd.",
    ],
  },
  {
    eyebrow: "Terms of Service",
    title: "Using RentScout",
    intro:
      "RentScout is a digital SaaS platform that helps users search, filter and manage rental property listings from multiple online sources. These terms describe the expectations for using the platform.",
    sections: [
      {
        title: "What RentScout does",
        body: [
          "RentScout provides a digital dashboard for viewing, filtering, and organizing rental listings from multiple online sources.",
          "RentScout does not own, rent out, broker, or guarantee any property listings. RentScout does not publish or manage rental listings itself.",
          "Users must verify all listing details, pricing, availability, and provider identity directly with the original source, landlord, agency, or platform.",
        ],
      },
      {
        title: "Third-party links and sources",
        body: [
          "RentScout may show links to third-party websites and platforms. RentScout has no control over those external sources and is not responsible for their content, accuracy, or availability.",
          "Use of external platforms is subject to those platforms' own terms and conditions.",
        ],
      },
      {
        title: "Free and Pro access",
        body: [
          "RentScout has a free tier with limited functionality and a paid Pro subscription with extended features.",
          "Free users can view a limited number of listings and use basic search filters. Pro provides access to full listing details, more results, advanced filters, saved search profiles, and rental workflow or status tracking.",
        ],
      },
      {
        title: "Subscriptions and billing",
        body: [
          "Payment for Pro subscriptions is handled by Paddle. RentScout does not store full payment details itself.",
          "Users can cancel their subscription at any time through the available account or billing flow. Cancellation prevents future renewals.",
        ],
      },
      {
        title: "No guarantee",
        body: [
          "RentScout does not guarantee that a user will find or secure a rental property.",
          "Listings on the platform are sourced from external providers and may be incomplete, outdated, or no longer available.",
        ],
      },
      {
        title: "Acceptable use",
        body: [
          "Using the platform for scraping, automated abuse, reverse engineering, or unauthorized access to systems is not permitted.",
          "RentScout reserves the right to restrict access or deactivate accounts in case of policy violations.",
        ],
      },
      {
        title: "Contact",
        body: ["For questions about these terms, contact contact@rentscout.nl."],
      },
    ],
    asideTitle: "Key expectations",
    asideBody: [
      "RentScout is an organizational layer on top of existing listing sources, not a rental platform.",
      "All listing details must be verified with the original provider or landlord.",
      "Pro subscriptions are processed through Paddle and can be cancelled at any time.",
    ],
  },
);

export default function TermsClient() {
  const { language } = useLanguagePreference();
  const pageCopy = copy[language as Language];

  return (
    <InfoPageLayout
      eyebrow={pageCopy.eyebrow}
      title={pageCopy.title}
      intro={pageCopy.intro}
      sections={pageCopy.sections}
      asideTitle={pageCopy.asideTitle}
      asideBody={pageCopy.asideBody}
    />
  );
}
