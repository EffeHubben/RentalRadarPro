import type { Metadata } from "next";
import { Providers } from "./providers";
import { CookieBanner } from "@/components/CookieBanner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://rentscout.nl"),
  title: {
    default: "RentScout",
    template: "%s | RentScout",
  },
  description:
    "RentScout helps renters compare listings from multiple sources, track progress, and manage a calmer rental search.",
  applicationName: "RentScout",
  openGraph: {
    title: "RentScout",
    description:
      "A focused rental search workspace for comparing listings, tracking progress, and checking external sources more calmly.",
    url: "https://rentscout.nl",
    siteName: "RentScout",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "RentScout",
    description:
      "A focused rental search workspace for comparing listings and managing your search without tab chaos.",
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body>
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}
