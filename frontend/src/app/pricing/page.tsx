import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing | RentScout",
  description:
    "Compare RentScout Free and Pro plans. RentScout Pro is a digital SaaS subscription that gives full listing details, advanced filters, saved searches and rental workflow tracking.",
};

export default function PricingPage() {
  return <PricingClient />;
}
