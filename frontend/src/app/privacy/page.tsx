import type { Metadata } from "next";
import PrivacyClient from "./PrivacyClient";

export const metadata: Metadata = {
  title: "Privacy Policy | RentScout",
  description:
    "Privacy Policy for RentScout — what data we collect, how we use it, your rights, and how payment data is handled through Paddle.",
};

export default function PrivacyPage() {
  return <PrivacyClient />;
}
