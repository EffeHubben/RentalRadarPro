"use client";

import { InfoPageLayout, languageRecord } from "@/components/site/InfoPageLayout";
import type { Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

const copy = languageRecord(
  {
    eyebrow: "Retourbeleid",
    title: "Retour- en annuleringsbeleid",
    intro:
      "RentScout Pro is een digitaal SaaS-abonnement. Deze pagina beschrijft hoe annulering en restitutie werken.",
    sections: [
      {
        title: "Annulering",
        body: [
          "Je kunt je Pro-abonnement op elk moment annuleren via de account- of factureringsflow.",
          "Na annulering wordt het abonnement niet verlengd. Je Pro-toegang blijft actief tot het einde van de lopende betaalperiode.",
        ],
      },
      {
        title: "Restitutie bij eerste aankoop",
        body: [
          "Bij een eerste aankoop van RentScout Pro kun je een restitutieverzoek indienen binnen 14 dagen na de aankoopdatum, mits wettelijk vereist of wanneer fair use van toepassing is.",
          "Restitutieverzoeken kun je sturen naar contact@rentscout.nl. Vermeld het e-mailadres van je account en de aankoopdatum.",
        ],
      },
      {
        title: "Verlengingen",
        body: [
          "Verlengingen van een bestaand abonnement zijn over het algemeen niet restitueerbaar, tenzij wettelijk vereist of sprake is van een factureringsfout.",
          "Als je denkt dat er een fout is gemaakt bij de facturering, neem dan contact op via contact@rentscout.nl.",
        ],
      },
      {
        title: "Verwerking van restitutie",
        body: [
          "Als een restitutie wordt goedgekeurd, wordt deze verwerkt via Paddle, de betalingsprovider van RentScout.",
          "De verwerkingstijd is afhankelijk van je bank of kaartuitgever.",
        ],
      },
      {
        title: "Geen garantie op resultaat",
        body: [
          "Dit beleid biedt geen garantie dat je een huurwoning vindt of verkrijgt via RentScout.",
          "RentScout is een zoek- en organisatietool. Het resultaat van je zoektocht hangt af van de beschikbare woningmarkt en externe factoren.",
        ],
      },
    ],
    asideTitle: "Samenvatting",
    asideBody: [
      "Annuleer op elk moment om toekomstige verlengingen te stoppen.",
      "Eerste aankopen: restitutieverzoek mogelijk binnen 14 dagen.",
      "Verlengingen zijn niet-restitueerbaar tenzij wettelijk vereist of factureringsfout.",
      "Contact: contact@rentscout.nl.",
    ],
  },
  {
    eyebrow: "Refund Policy",
    title: "Refunds and cancellations",
    intro:
      "RentScout Pro is a digital SaaS subscription. This page describes how cancellations and refunds work.",
    sections: [
      {
        title: "Cancellation",
        body: [
          "You can cancel your Pro subscription at any time through the account or billing flow.",
          "After cancellation, the subscription will not renew. Your Pro access remains active until the end of the current billing period.",
        ],
      },
      {
        title: "Refunds for first-time purchases",
        body: [
          "For a first-time purchase of RentScout Pro, you may submit a refund request within 14 days of the purchase date where legally required or where fair use applies.",
          "Send refund requests to contact@rentscout.nl. Include your account email address and purchase date.",
        ],
      },
      {
        title: "Renewals",
        body: [
          "Renewals of an existing subscription are generally non-refundable, unless required by law or in the case of a billing error.",
          "If you believe a billing error occurred, contact contact@rentscout.nl.",
        ],
      },
      {
        title: "Processing refunds",
        body: [
          "If a refund is approved, it is processed through Paddle, RentScout's payment provider.",
          "Processing time depends on your bank or card issuer.",
        ],
      },
      {
        title: "No guarantee of outcome",
        body: [
          "This policy does not guarantee that you will find or secure a rental property through RentScout.",
          "RentScout is a search and organization tool. The outcome of your search depends on the available rental market and external factors.",
        ],
      },
    ],
    asideTitle: "Summary",
    asideBody: [
      "Cancel at any time to stop future renewals.",
      "First purchases: refund request possible within 14 days.",
      "Renewals are non-refundable unless required by law or billing error.",
      "Contact: contact@rentscout.nl.",
    ],
  },
);

export default function RefundPolicyClient() {
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
