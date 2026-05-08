"use client";

import Link from "next/link";
import { InfoPageLayout, languageRecord } from "@/components/site/InfoPageLayout";
import { i18n, type Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

const copy = languageRecord(
  {
    eyebrow: "Contact",
    title: "Neem contact op",
    intro:
      "RentScout houdt de communicatie graag eenvoudig. Gebruik het supportadres voor praktische vragen over accounts, betalingen of technische problemen.",
    sections: [
      {
        title: "Waarmee we kunnen helpen",
        body: [
          "Gebruik support voor accounttoegang, facturering, foutmeldingen, of vragen over hoe RentScout werkt.",
          "Voor inhoudelijke vragen over een woning, beschikbaarheid of voorwaarden moet je altijd contact opnemen met de oorspronkelijke aanbieder of verhuurder.",
        ],
      },
      {
        title: "Reactietijd",
        body: [
          "RentScout is een compact product en probeert berichten zo zorgvuldig mogelijk af te handelen. Verwacht een redelijke reactietijd, geen 24/7 helpdesk.",
          "Bij account- of factureringsproblemen helpt duidelijke context, zoals het e-mailadres van je account en een korte beschrijving van het probleem.",
        ],
      },
    ],
    asideTitle: "Praktisch",
    asideBody: [
      "Voor vragen over externe advertenties of verhuurvoorwaarden kan RentScout geen beslissingen nemen namens de originele provider.",
      "Gebruik altijd de bronsite om definitieve woninginformatie te bevestigen.",
    ],
    emailLabel: "Support e-mail",
    accountLink: "Open account",
    searchLink: "Open zoeken",
  },
  {
    eyebrow: "Contact",
    title: "Get in touch",
    intro:
      "RentScout keeps communication simple. Use the support address for practical questions about accounts, payments, or technical issues.",
    sections: [
      {
        title: "What support can help with",
        body: [
          "Use support for account access, billing issues, error reports, or questions about how RentScout works.",
          "For questions about a specific property, availability, or rental terms, you should contact the original provider or landlord directly.",
        ],
      },
      {
        title: "Response time",
        body: [
          "RentScout is a compact product and aims to handle messages carefully. Expect a reasonable response time, not a 24/7 help desk.",
          "For account or billing issues, clear context helps, such as your account email address and a short description of the problem.",
        ],
      },
    ],
    asideTitle: "Practical note",
    asideBody: [
      "RentScout cannot make decisions on behalf of external listing providers or landlords.",
      "Use the original source to confirm final property details.",
    ],
    emailLabel: "Support email",
    accountLink: "Open account",
    searchLink: "Open search",
  },
);

export default function ContactPage() {
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
      asideBody={pageCopy.asideBody}
    >
      <div className="rs-card rounded-[1.5rem] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
          {pageCopy.emailLabel}
        </p>
        <a
          href={`mailto:${supportEmail}`}
          className="mt-3 inline-flex text-lg font-semibold text-[var(--color-text)] transition hover:text-[var(--color-accent-strong)]"
        >
          {supportEmail}
        </a>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/account"
            className="rs-control inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
          >
            {pageCopy.accountLink}
          </Link>
          <Link
            href="/search"
            className="rs-primary-button inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
          >
            {pageCopy.searchLink}
          </Link>
        </div>
      </div>
    </InfoPageLayout>
  );
}
