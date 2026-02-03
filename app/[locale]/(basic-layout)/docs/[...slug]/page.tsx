import MDXComponents from "@/components/mdx/MDXComponents";
import { getDocBySlug, getDocSidebar, listDocSlugs } from "@/lib/docs";
import { Link as I18nLink, Locale, LOCALES } from "@/i18n/routing";
import { constructMetadata } from "@/lib/metadata";
import { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote-client/rsc";
import { notFound } from "next/navigation";
import remarkGfm from "remark-gfm";
import rehypeDocsLinks from "@/lib/rehype-docs-links";

const mdxOptions = {
  parseFrontmatter: false,
  mdxOptions: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeDocsLinks],
  },
};

type Params = Promise<{
  locale: string;
  slug: string[];
}>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const slugStr = slug.join("/");
  const doc = await getDocBySlug(slugStr, locale);

  if (!doc) {
    return constructMetadata({
      title: "404",
      description: "Page not found",
      noIndex: true,
      locale: locale as Locale,
      path: `/docs/${slugStr}`,
    });
  }

  // Docs are available in all locales (including docs-only locales like ko)
  return constructMetadata({
    title: `${doc.title} - OpenClaw Docs`,
    description: doc.frontmatter.summary || doc.title,
    locale: locale as Locale,
    path: `/docs/${slugStr}`,
    availableLocales: LOCALES,
  });
}

export default async function DocPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const slugStr = slug.join("/");
  const doc = await getDocBySlug(slugStr, locale);

  if (!doc) {
    notFound();
  }

  // For untranslated locales, sidebar uses English
  const hasLocaleDocs = locale === "en" || locale === "zh" || locale === "ja" || locale === "ko" || locale === "ru";
  const sidebarLocale = hasLocaleDocs ? locale : "en";
  const sections = await getDocSidebar(sidebarLocale);

  // Check if this page is a fallback (locale requested but served from en)
  const isFallback = !hasLocaleDocs;

  const backText: Record<string, string> = {
    en: "Back to docs",
    zh: "返回文档首页",
    ja: "ドキュメントに戻る",
    ko: "문서로 돌아가기",
    ru: "Назад к документации",
  };

  const fallbackNotice: Record<string, string> = {
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4">
            <I18nLink
              href="/docs"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground mb-4 block"
            >
              ← {backText[locale] || backText.en}
            </I18nLink>
            <nav className="space-y-6">
              {sections.map((section) => (
                <div key={section.title}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    {section.title}
                  </h3>
                  <ul className="space-y-1">
                    {section.items.map((item) => (
                      <li key={item.slug}>
                        <I18nLink
                          href={`/docs/${item.slug}`}
                          className={`text-sm block py-1 px-2 rounded transition-colors ${
                            item.slug === slugStr
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {item.title}
                        </I18nLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {isFallback && fallbackNotice[locale] && (
            <div className="mb-6 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-300">
              {fallbackNotice[locale]}
            </div>
          )}
          <article className="prose prose-gray dark:prose-invert max-w-none">
            <MDXRemote
              source={doc.content}
              components={MDXComponents}
              options={mdxOptions}
            />
          </article>

          <div className="mt-16 pt-8 border-t">
            <I18nLink
              href="/docs"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← {backText[locale] || backText.en}
            </I18nLink>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  const allParams: { locale: string; slug: string[] }[] = [];

  for (const loc of LOCALES) {
    const slugs = await listDocSlugs(loc);
    for (const s of slugs) {
      allParams.push({ locale: loc, slug: s.split("/") });
    }
  }

  return allParams;
}
