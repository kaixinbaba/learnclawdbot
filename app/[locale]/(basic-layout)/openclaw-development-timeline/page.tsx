import { Metadata } from "next";
import { constructMetadata } from "@/lib/metadata";
import { Locale, LOCALES } from "@/i18n/routing";
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

  return constructMetadata({
    title: "OpenClaw Development Timeline - Complete History & Changelog",
    description:
      "Explore the complete development journey of OpenClaw from launch to present. Interactive timeline featuring major releases, architectural changes, and feature milestones.",
    locale: locale as Locale,
    path: `/openclaw-development-timeline`,
  });
}

export default async function OpenClawTimelinePage({ params }: { params: Params }) {
  await params; // Ensure params are resolved
  return <TimelineClient />;
}

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({
    locale,
  }));
}
