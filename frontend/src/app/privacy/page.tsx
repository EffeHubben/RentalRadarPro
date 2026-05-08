"use client";

import { InfoPageLayout, languageRecord } from "@/components/site/InfoPageLayout";
import { i18n, type Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

const copy = languageRecord(
  {
    eyebrow: "Privacy",
    title: "Privacy en gegevens",
    intro:
      "RentScout wil duidelijk zijn over welke gegevens het platform gebruikt en waarom. Deze pagina is een praktische uitleg, geen juridisch advies.",
    sections: [
      {
        title: "Wat RentScout doet",
        body: [
          "RentScout verzamelt en toont huurwoninginformatie uit meerdere bronnen in een rustiger overzicht. Sommige resultaten linken door naar externe websites of originele aanbieders.",
          "Advertentiegegevens kunnen veranderen of verdwijnen. Controleer daarom altijd de actuele details bij de oorspronkelijke aanbieder, verhuurder of het platform waar de woning wordt gepubliceerd.",
        ],
      },
      {
        title: "Accountgegevens",
        body: [
          "Wanneer je een account maakt, bewaren we basisgegevens zoals je e-mailadres, wachtwoordhash, taalvoorkeur en accountstatus.",
          "Die gegevens gebruiken we om je te laten inloggen, je account te beveiligen en accountfuncties zoals wachtwoordherstel, verificatie en abonnementsbeheer te ondersteunen.",
        ],
      },
      {
        title: "Betaalgegevens",
        body: [
          "Voor Pro-abonnementen gebruikt RentScout Stripe voor facturering en abonnementsbeheer. RentScout bewaart zelf geen volledige kaartgegevens.",
          "We bewaren wel de minimale abonnementsstatus die nodig is om te bepalen of je Free of Pro gebruikt en tot wanneer toegang actief is.",
        ],
      },
      {
        title: "E-mails en ondersteuning",
        body: [
          "RentScout kan transactionele e-mails sturen, bijvoorbeeld voor welkom, verificatie, wachtwoordherstel en facturering. Daarvoor gebruiken we Resend als e-mailprovider.",
          "Als je contact opneemt met ondersteuning, gebruiken we je bericht om je te helpen en om operationele problemen op te lossen.",
        ],
      },
    ],
    asideTitle: "Praktische uitgangspunten",
    asideBody: [
      "Gebruik RentScout als hulpmiddel om sneller te vergelijken en overzicht te houden, niet als enige bron van waarheid.",
      "Controleer prijs, beschikbaarheid, voorwaarden en identiteit van de aanbieder altijd bij de originele bron.",
    ],
  },
  {
    eyebrow: "Privacy",
    title: "Privacy and data",
    intro:
      "RentScout aims to be clear about what data the platform uses and why. This page is a practical summary, not legal advice.",
    sections: [
      {
        title: "What RentScout does",
        body: [
          "RentScout aggregates rental listing information from multiple sources into one calmer overview. Some results link out to external websites or original providers.",
          "Listing details can change or disappear. Users should always confirm current details with the original provider, landlord, or platform where the listing appears.",
        ],
      },
      {
        title: "Account data",
        body: [
          "When you create an account, we store basic information such as your email address, password hash, language preference, and account status.",
          "We use that data to let you sign in, secure your account, and support account features such as password recovery, verification, and subscription management.",
        ],
      },
      {
        title: "Payment data",
        body: [
          "For Pro subscriptions, RentScout uses Stripe for billing and subscription management. RentScout does not store full card details itself.",
          "We do store the minimum subscription status needed to determine whether you are on Free or Pro and how long access remains active.",
        ],
      },
      {
        title: "Emails and support",
        body: [
          "RentScout may send transactional emails such as welcome, verification, password reset, and billing emails. Resend is used as the email delivery provider.",
          "If you contact support, we use your message to help you and to resolve operational issues.",
        ],
      },
    ],
    asideTitle: "Practical expectations",
    asideBody: [
      "Use RentScout as a tool for comparison and organization, not as the only source of truth.",
      "Always confirm pricing, availability, terms, and provider identity with the original source.",
    ],
  },
);

export default function PrivacyPage() {
  const { language } = useLanguagePreference();
  const pageCopy = copy[language as Language];
  const supportEmail = i18n[language].site.contactEmail;

  return (
    <InfoPageLayout
      eyebrow={pageCopy.eyebrow}
      title={pageCopy.title}
      intro={pageCopy.intro}
      sections={pageCopy.sections}
      asideTitle={pageCopy.asideTitle}
      asideBody={[...pageCopy.asideBody, supportEmail]}
    />
  );
}
