import type { Metadata } from "next";
import { Manrope, Noto_Sans_Bengali, Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { SiteFavicon } from "@/components/SiteFavicon";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-en",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-display-en",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const notoBengali = Noto_Sans_Bengali({
  variable: "--font-bn",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const notoBengaliDisplay = Noto_Sans_Bengali({
  variable: "--font-display-bn",
  subsets: ["bengali", "latin"],
  weight: ["600", "700"],
  display: "swap",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Royal Group ERP",
  description:
    "Lightweight bilingual ERP & POS for elevator sales, spare parts, installation and service",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/api/favicon", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale === "bn" ? "bn" : "en-GB"}
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${manrope.variable} ${notoBengali.variable} ${notoBengaliDisplay.variable} h-full`}
    >
      <body className="min-h-full antialiased" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Dhaka">
          <SiteFavicon />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
