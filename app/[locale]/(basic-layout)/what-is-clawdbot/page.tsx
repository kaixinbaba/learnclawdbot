import { Button } from "@/components/ui/button";
import { Locale } from "@/i18n/routing";
import { constructMetadata } from "@/lib/metadata";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-static";
export const revalidate = false;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Clawdbot" });

  return constructMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    locale: locale as Locale,
    path: "/what-is-clawdbot",
  });
}

export default async function WhatIsClawdbotPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Clawdbot" });

  return (
    <div className="bg-secondary/20 py-12 sm:py-24">
      <div className="container mx-auto max-w-3xl px-4">
        <article className="bg-background rounded-xl border p-8 shadow-sm sm:p-12 dark:border-zinc-800 text-center">
          <div className="mb-8">
            <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary mb-4">
              {t("importantUpdate")}
            </span>
            <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {t("title")}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t("subtitle")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
            <Button asChild size="lg" className="text-lg px-8">
              <Link href="/what-is-openclaw">{t("cta")}</Link>
            </Button>
          </div>

          <div className="space-y-8 text-lg leading-relaxed text-muted-foreground text-left">
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                {t("whatWasClawdbot")}
              </h2>
              <p>
                {t("whatWasClawdbotDesc")}
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                {t("whyChange")}
              </h2>

              <div className="flex justify-center mb-8">
                <Image
                  src="/images/moltbot-rebranding-tweet.png"
                  alt={t("imageAlt")}
                  width={607}
                  height={312}
                  className="rounded-xl border shadow-sm max-w-full h-auto"
                />
              </div>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}
