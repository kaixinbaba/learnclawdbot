import { Metadata } from "next";
import { constructMetadata } from "@/lib/metadata";
import { Locale, UI_LOCALES as LOCALES } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import TimelineClient from "./TimelineClient";

type Params = Promise<{
  locale: string;
}>;

type MetadataProps = {
  params: Params;
};

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Timeline" });

  return constructMetadata({
    title: t("metadata.title"),
    description: t("metadata.description"),
    locale: locale as Locale,
    path: `/openclaw-development-timeline`,
  });
}

export default async function OpenClawTimelinePage({ params }: { params: Params }) {
  const { locale } = await params;
  return <TimelineClient locale={locale} />;
}

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({
    locale,
  }));
}
