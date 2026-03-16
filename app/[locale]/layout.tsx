import { GoogleOneTap } from "@/components/auth/GoogleOneTap";
import { LanguageDetectionAlert } from "@/components/LanguageDetectionAlert";
import { JsonLd } from "@/components/seo/JsonLd";
import DeferredCrispChat from "@/components/support/DeferredCrispChat";
import { TailwindIndicator } from "@/components/TailwindIndicator";
import DeferredAnalytics from "@/components/tracking/DeferredAnalytics";
import GoogleAdsense from "@/components/tracking/GoogleAdsense";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/config/site";
import { DEFAULT_LOCALE, Locale, routing } from "@/i18n/routing";
import { constructMetadata } from "@/lib/metadata";
import { cn } from "@/lib/utils";
import "@/styles/globals.css";
import "@/styles/loading.css";
import { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import {
    getMessages,
    getTranslations,
    setRequestLocale,
} from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { Inter as FontSans } from "next/font/google";
import { notFound } from "next/navigation";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

type MetadataProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });

  return constructMetadata({
    title: t("title"),
    description: t("description"),
    locale: locale as Locale,
    path: `/`,
  });
}

export const viewport: Viewport = {
  themeColor: siteConfig.themeColors,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  
  // Explicitly pass locale to sure we get messages for the current locale
  const messages = await getMessages({ locale });

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.url}${locale === DEFAULT_LOCALE ? '' : `/${locale}`}/blog?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang={locale || DEFAULT_LOCALE} suppressHydrationWarning>
      <head>
        {/* DNS prefetch for analytics - still useful for when they load */}
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://scripts.clarity.ms" />
        <JsonLd data={websiteSchema} />
        {/* Popunder ad - JS SYNC */}
        {process.env.NODE_ENV !== "development" && (
          <script
            src="https://pl28925841.effectivegatecpm.com/94/05/63/9405630483ec2e7c1b326daf0b561c4c.js"
          />
        )}
      </head>
      <body
        className={cn(
          "min-h-screen bg-background flex flex-col",
          fontSans.variable
        )}
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            forcedTheme="dark"
          >
            {messages.LanguageDetection && <LanguageDetectionAlert />}
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
        <GoogleOneTap />
        <DeferredCrispChat />
        <Toaster richColors />
        <TailwindIndicator />
        
        {/* Analytics - 延迟加载，不阻塞首屏 */}
        {process.env.NODE_ENV !== "development" && <DeferredAnalytics />}

        {/* AdSense */}
        {process.env.NODE_ENV !== "development" && <GoogleAdsense />}
      </body>
    </html>
  );
}
