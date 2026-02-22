import { GoogleOneTap } from "@/components/auth/GoogleOneTap";
import { LanguageDetectionAlert } from "@/components/LanguageDetectionAlert";
import DeferredCrispChat from "@/components/support/DeferredCrispChat";
import { TailwindIndicator } from "@/components/TailwindIndicator";
import DeferredAnalytics from "@/components/tracking/DeferredAnalytics";
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

  return (
    <html lang={locale || DEFAULT_LOCALE} suppressHydrationWarning>
      <head>
        {/* DNS prefetch for analytics - still useful for when they load */}
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://scripts.clarity.ms" />
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
      </body>
    </html>
  );
}
