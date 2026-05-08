"use client";

import { InfoPageLayout, languageRecord } from "@/components/site/InfoPageLayout";
import type { Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

const copy = languageRecord(
  {
    eyebrow: "Voorwaarden",
    title: "Gebruik van RentScout",
    intro:
      "Deze pagina beschrijft in gewone taal hoe RentScout bedoeld is om gebruikt te worden. Het is een praktische basis voor transparant gebruik van het platform.",
    sections: [
      {
        title: "Gebruik van het platform",
        body: [
          "RentScout helpt gebruikers huurwoningen uit meerdere bronnen te vergelijken, organiseren en opvolgen.",
          "Het platform kan linken naar externe websites en originele aanbieders. RentScout beheert die externe bronnen niet en garandeert niet dat elke advertentie volledig, juist of beschikbaar blijft.",
        ],
      },
      {
        title: "Verantwoordelijkheid van de gebruiker",
        body: [
          "Gebruikers blijven zelf verantwoordelijk voor het controleren van prijs, beschikbaarheid, voorwaarden, identiteit van de aanbieder en andere details bij de oorspronkelijke bron of verhuurder.",
          "Gebruik RentScout niet als vervanging voor eigen controle wanneer je contact opneemt, documenten deelt of een woning accepteert.",
        ],
      },
      {
        title: "Accounts en beveiliging",
        body: [
          "Je bent verantwoordelijk voor het vertrouwelijk houden van je inloggegevens en voor activiteiten binnen je account.",
          "RentScout kan beveiligingsmaatregelen aanpassen, accounts beveiligen of toegang beperken wanneer dat nodig is om misbruik of operationele problemen te beperken.",
        ],
      },
      {
        title: "Pro en betalingen",
        body: [
          "Betaalde Pro-functies worden verwerkt via Stripe. Abonnementen, verlengingen, mislukte betalingen en annuleringen volgen de status die vanuit Stripe wordt teruggekoppeld.",
          "Als een abonnement stopt of mislukt, kan Pro-toegang eindigen of terugvallen naar Free volgens de resterende geldigheidsperiode.",
        ],
      },
    ],
    asideTitle: "Nuchtere uitgangspunten",
    asideBody: [
      "RentScout is bedoeld als productiviteitslaag boven bestaande woningbronnen.",
      "Het platform probeert duidelijk en betrouwbaar te zijn, maar gebruikers moeten belangrijke beslissingen altijd controleren bij de originele aanbieder.",
    ],
  },
  {
    eyebrow: "Terms",
    title: "Using RentScout",
    intro:
      "This page explains in plain language how RentScout is meant to be used. It is a practical baseline for transparent use of the platform.",
    sections: [
      {
        title: "Use of the platform",
        body: [
          "RentScout helps users compare, organize, and follow up on rental listings from multiple sources.",
          "The platform may link to external websites and original providers. RentScout does not control those external sources and does not guarantee that every listing remains complete, accurate, or available.",
        ],
      },
      {
        title: "User responsibility",
        body: [
          "Users remain responsible for checking pricing, availability, terms, provider identity, and other details with the original source or landlord.",
          "RentScout should not replace your own checks when contacting providers, sharing documents, or committing to a rental.",
        ],
      },
      {
        title: "Accounts and security",
        body: [
          "You are responsible for keeping your sign-in details confidential and for activity within your account.",
          "RentScout may update security measures, protect accounts, or limit access when needed to reduce abuse or operational risk.",
        ],
      },
      {
        title: "Pro and payments",
        body: [
          "Paid Pro features are processed through Stripe. Subscriptions, renewals, failed payments, and cancellations follow the status reported back by Stripe.",
          "If a subscription stops or fails, Pro access may end or return to Free based on the remaining validity period.",
        ],
      },
    ],
    asideTitle: "Practical expectations",
    asideBody: [
      "RentScout is designed as an organizational layer on top of existing listing sources.",
      "The product aims to be clear and reliable, but important decisions still need to be confirmed with the original provider.",
    ],
  },
);

export default function TermsPage() {
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
