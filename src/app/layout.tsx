import type { Metadata } from "next";
import Script from "next/script";
import { Bebas_Neue, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteFooter, SiteNav } from "@/components/layout/site-nav";

const displayFont = Bebas_Neue({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

const bodyFont = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
const gaMeasurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Stick Arena Party | Web Survival Game",
    template: "%s | Stick Arena Party",
  },
  description:
    "Survive fast-paced stick-figure rushes, earn in-game credits and crystals, and claim optional rewarded bonuses.",
  openGraph: {
    title: "Stick Arena Party",
    description:
      "Original browser survival game with optional rewarded bonus flow and progression economy.",
    type: "website",
    url: "/",
    siteName: "Stick Arena Party",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stick Arena Party",
    description: "Dodge waves, score high, and grow your currency stash.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        {gaMeasurementId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${gaMeasurementId}', {
                  send_page_view: true
                });
              `}
            </Script>
          </>
        ) : null}
        <div className="site-background" aria-hidden="true" />
        <SiteNav />
        <main className="site-main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
