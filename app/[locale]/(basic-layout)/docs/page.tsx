import { getDocSidebar } from "@/lib/docs";
import { Link as I18nLink, Locale, LOCALES } from "@/i18n/routing";
import { constructMetadata } from "@/lib/metadata";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale } = await params;
  return constructMetadata({
    title: locale === "zh" ? "文档 - OpenClaw" : "Documentation - OpenClaw",
    description:
      locale === "zh"
        ? "OpenClaw 完整文档，包括安装、配置、渠道集成等"
        : "Complete OpenClaw documentation including installation, configuration, channel integrations and more",
    locale: locale as Locale,
    path: "/docs",
  });
}

export default async function DocsIndexPage({
  params,
}: {
  params: Params;
}) {
  const { locale } = await params;
  // For untranslated locales, show English docs with a translation notice
  const hasLocaleDocs = locale === "en" || locale === "zh";
  const docsLocale = hasLocaleDocs ? locale : "en";
  const sections = await getDocSidebar(docsLocale);

  const titles: Record<string, string> = {
    en: "📚 OpenClaw Documentation",
    zh: "📚 OpenClaw 文档",
    ja: "📚 OpenClaw ドキュメント",
  };
  const descriptions: Record<string, string> = {
    en: "Browse all documentation to learn how to install, configure, and use OpenClaw.",
    zh: "浏览所有文档，了解如何安装、配置和使用 OpenClaw。",
    ja: "OpenClaw のインストール、設定、使用方法に関するすべてのドキュメントをご覧ください。",
  };
  const translationNotice: Record<string, string> = {
    ja: "🚧 日本語翻訳は現在進行中です。一部のページは英語で表示されます。翻訳にご協力いただける方は、GitHub でプルリクエストをお送りください！",
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <h1 className="text-4xl font-bold mb-4">
        {titles[locale] || titles.en}
      </h1>
      <p className="text-lg text-muted-foreground mb-6">
        {descriptions[locale] || descriptions.en}
      </p>

      {translationNotice[locale] && (
        <div className="mb-12 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 text-amber-800 dark:text-amber-300">
          {translationNotice[locale]}
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <div
            key={section.title}
            className="border rounded-lg p-6 hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-4">{section.title}</h2>
            <ul className="space-y-2">
              {section.items.slice(0, 8).map((item) => (
                <li key={item.slug}>
                  <I18nLink
                    href={`/docs/${item.slug}`}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {item.title}
                  </I18nLink>
                </li>
              ))}
              {section.items.length > 8 && (
                <li className="text-sm text-muted-foreground">
                  +{section.items.length - 8} more...
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}
