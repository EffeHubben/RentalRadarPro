import type { Metadata } from "next";
import RefundPolicyClient from "./RefundPolicyClient";

export const metadata: Metadata = {
  title: "Refund Policy | RentScout",
  description:
    "Refund and cancellation policy for RentScout Pro — a digital SaaS subscription. Cancel any time; first-time purchases may be refunded within 14 days.",
};

export default function RefundPolicyPage() {
  return <RefundPolicyClient />;
}
