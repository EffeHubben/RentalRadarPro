"use client";

import { InfoPageLayout, languageRecord } from "@/components/site/InfoPageLayout";
import type { Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

const copy = languageRecord(
  {
    eyebrow: "Privacybeleid",
    title: "Privacy en gegevens",
    intro:
      "RentScout wil transparant zijn over welke gegevens het platform gebruikt en waarom. Deze pagina is een praktische samenvatting van onze gegevenspraktijken.",
    sections: [
      {
        title: "Welke gegevens we verzamelen",
        body: [
          "Accountgegevens: naam, e-mailadres, wachtwoordhash, taalvoorkeur en accountstatus.",
          "Inlog- en authenticatiegegevens: sessietokens en verificatiedata.",
          "Opgeslagen zoekvoorkeuren: zoekcriteria, opgeslagen profielen en filterkeuzes.",
          "Woningstatussen en notities: de voortgang die je bijhoudt per advertentie, als je die functie gebruikt.",
          "Technische logs en analytics: gebruiksdata en foutmeldingen ter verbetering van het platform.",
          "Abonnementsstatus: of je gratis of Pro gebruikt en de geldigheidsperiode van je abonnement.",
        ],
      },
      {
        title: "Betaalgegevens",
        body: [
          "Voor Pro-abonnementen gebruikt RentScout Paddle voor betaalverwerking en abonnementsbeheer. RentScout bewaart zelf geen volledige kaart- of betaalgegevens.",
          "We bewaren uitsluitend de minimale abonnementsstatus die nodig is om te bepalen of je Free of Pro gebruikt.",
        ],
      },
      {
        title: "Waarvoor we gegevens gebruiken",
        body: [
          "Gegevens worden gebruikt om het platform te leveren, je account te beheren, gebruikersondersteuning te bieden en abonnementen te verwerken.",
          "We gebruiken je gegevens ook om het platform te verbeteren en operationele problemen op te sporen.",
        ],
      },
      {
        title: "Cookies en lokale opslag",
        body: [
          "RentScout gebruikt localStorage om taalvoorkeur, thema-instelling en sessiedata op te slaan.",
          "We kunnen technische cookies of sessie-identifiers gebruiken voor authenticatie en beveiliging.",
        ],
      },
      {
        title: "Derde partijen",
        body: [
          "Paddle: verwerkt betalingen en abonnementen voor Pro-gebruikers.",
          "Resend: bezorgt transactionele e-mails zoals verificatie, wachtwoordherstel en factuurmeldingen.",
          "Hostingprovider: de infrastructuur waarop RentScout draait.",
          "Analytics: we kunnen anonieme gebruiksdata verzamelen ter verbetering van het platform.",
        ],
      },
      {
        title: "Jouw rechten",
        body: [
          "Je kunt je accountgegevens inzien en corrigeren via de accountpagina.",
          "Je kunt een verzoek indienen om je gegevens te laten verwijderen via contact@rentscout.nl.",
          "Voor vragen over je gegevens kun je contact opnemen via hetzelfde adres.",
        ],
      },
    ],
    asideTitle: "Praktische uitgangspunten",
    asideBody: [
      "RentScout bewaart geen volledige betaalgegevens; dat doet Paddle.",
      "Gegevens worden uitsluitend gebruikt om de service te leveren en te verbeteren.",
      "Contact voor privacyvragen: contact@rentscout.nl.",
    ],
  },
  {
    eyebrow: "Privacy Policy",
    title: "Privacy and data",
    intro:
      "RentScout aims to be clear about what data the platform uses and why. This page is a practical summary of our data practices.",
    sections: [
      {
        title: "What data we collect",
        body: [
          "Account information: name, email address, password hash, language preference, and account status.",
          "Login and authentication data: session tokens and verification data.",
          "Saved search preferences: search criteria, saved profiles, and filter settings.",
          "Listing statuses and notes: the progress you track per listing, if you use that feature.",
          "Technical logs and analytics: usage data and error reports to improve the platform.",
          "Subscription status: whether you are on Free or Pro, and your subscription validity period.",
        ],
      },
      {
        title: "Payment data",
        body: [
          "For Pro subscriptions, RentScout uses Paddle for payment processing and subscription management. RentScout does not store full card or payment details itself.",
          "We only store the minimum subscription status needed to determine whether you are on Free or Pro.",
        ],
      },
      {
        title: "How we use your data",
        body: [
          "Data is used to provide the service, manage your account, offer user support, and process subscriptions.",
          "We also use your data to improve the platform and identify operational issues.",
        ],
      },
      {
        title: "Cookies and local storage",
        body: [
          "RentScout uses localStorage to store language preference, theme setting, and session data.",
          "We may use technical cookies or session identifiers for authentication and security.",
        ],
      },
      {
        title: "Third-party services",
        body: [
          "Paddle: processes payments and manages subscriptions for Pro users.",
          "Resend: delivers transactional emails such as verification, password reset, and billing notifications.",
          "Hosting provider: the infrastructure on which RentScout runs.",
          "Analytics: we may collect anonymized usage data to improve the platform.",
        ],
      },
      {
        title: "Your rights",
        body: [
          "You can view and correct your account information on the account page.",
          "You can request deletion of your data by contacting contact@rentscout.nl.",
          "For any questions about your data, contact us at the same address.",
        ],
      },
    ],
    asideTitle: "Key points",
    asideBody: [
      "RentScout does not store full payment details; Paddle handles that.",
      "Data is used solely to provide and improve the service.",
      "Contact for privacy questions: contact@rentscout.nl.",
    ],
  },
);

export default function PrivacyClient() {
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
