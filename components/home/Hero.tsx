import FeatureBadge from "@/components/shared/FeatureBadge";
import { Button } from "@/components/ui/button";
import { Link as I18nLink } from "@/i18n/routing";
import { ArrowRight, BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";

export default function Hero() {
  const t = useTranslations("Landing.Hero");

  return (
    <div className="w-full">
      <div className="container mx-auto">
        <div className="flex gap-8 py-16 lg:py-24 2xl:py-40 items-center justify-center flex-col">
          <FeatureBadge
            label={t("badge.label")}
            text={t("badge.text")}
            href={t("badge.href")}
          />
          <div className="flex gap-4 flex-col max-w-3xl">
            <h1 className="text-center z-10 text-lg md:text-7xl font-sans font-bold">
              <span className="title-gradient">{t("title")}</span>
            </h1>

            <p className="text-lg md:text-xl leading-relaxed tracking-tight text-muted-foreground text-center">
              {t("description")}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              asChild
              className="h-11 rounded-xl px-8 py-2 text-white border-2 border-primary"
            >
              <I18nLink
                href={t("getStartedLink") || "/openclaw"}
                className="flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                {t("getStarted")}
              </I18nLink>
            </Button>
            <Button
              className="h-11 rounded-xl px-8 py-2 bg-white hover:bg-background text-primary hover:text-primary/80 border-2"
              variant="outline"
              asChild
            >
              <I18nLink
                href={t("viewDocsLink") || "/blog"}
                className="flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                {t("viewDocs")}
              </I18nLink>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
