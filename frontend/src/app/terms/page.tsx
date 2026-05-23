import type { Metadata } from "next";
import TermsClient from "./TermsClient";

export const metadata: Metadata = {
  title: "Terms of Service | RentScout",
  description:
    "Terms of Service for RentScout — a digital SaaS platform for searching, filtering and managing rental property listings from multiple online sources.",
};

export default function TermsPage() {
  return <TermsClient />;
}
