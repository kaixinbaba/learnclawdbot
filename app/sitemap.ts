import { listPublishedPostsAction } from '@/actions/posts/posts'
import { siteConfig } from '@/config/site'
import { DEFAULT_LOCALE, LOCALES, UI_LOCALES } from '@/i18n/routing'
import { blogCms } from '@/lib/cms'
import { listDocSlugs } from '@/lib/docs'
import { MetadataRoute } from 'next'

const siteUrl = siteConfig.url

type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never' | undefined

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages with locale
  const staticPages = [
    '',
    '/what-is-openclaw',
    '/what-is-moltbot',
    '/what-is-clawdbot',
    '/about',
  ]

  // Non-localized pages
  const nonLocalizedPages = [
    '/privacy-policy',
    '/terms-of-service',
  ]

  const pages = UI_LOCALES.flatMap(locale => {
    return staticPages.map(page => ({
      url: `${siteUrl}${locale === DEFAULT_LOCALE ? '' : `/${locale}`}${page}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as ChangeFrequency,
      priority: page === '' ? 1.0 : 0.8,
    }))
  })

  // Add non-localized pages
  const nonLocalizedPageEntries = nonLocalizedPages.map(page => ({
    url: `${siteUrl}${page}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as ChangeFrequency,
    priority: 0.5,
  }))

  const allBlogSitemapEntries: MetadataRoute.Sitemap = [];

  for (const locale of UI_LOCALES) {
    const { posts: localPosts } = await blogCms.getLocalList(locale);
    localPosts
      .filter((post) => post.slug && post.status !== "draft")
      .forEach((post) => {
        const slugPart = post.slug.replace(/^\//, "").replace(/^blogs\//, "");
        if (slugPart) {
          allBlogSitemapEntries.push({
            url: `${siteUrl}${locale === DEFAULT_LOCALE ? '' : `/${locale}`}/blog/${slugPart}`,
            lastModified: post.metadata?.updatedAt || post.publishedAt || new Date(),
            changeFrequency: 'daily' as ChangeFrequency,
            priority: 0.7,
          });
        }
      });
  }

  for (const locale of UI_LOCALES) {
    const serverResult = await listPublishedPostsAction({
      locale: locale,
      pageSize: 1000,
      visibility: "public",
      postType: "blog",
    });
    if (serverResult.success && serverResult.data?.posts) {
      serverResult.data.posts.forEach((post) => {
        const slugPart = post.slug?.replace(/^\//, "").replace(/^blogs\//, "");
        if (slugPart) {
          allBlogSitemapEntries.push({
            url: `${siteUrl}${locale === DEFAULT_LOCALE ? '' : `/${locale}`}/blog/${slugPart}`,
            lastModified: post.publishedAt || new Date(),
            changeFrequency: 'daily' as ChangeFrequency,
            priority: 0.7,
          });
        }
      });
    }
  }

  const uniqueBlogPostEntries = Array.from(
    new Map(allBlogSitemapEntries.map((entry) => [entry.url, entry])).values()
  );

  // Glossary entries (server-side only, no local file system access)
  const allGlossarySitemapEntries: MetadataRoute.Sitemap = [];

  // Add glossary list page
  for (const locale of UI_LOCALES) {
    allGlossarySitemapEntries.push({
      url: `${siteUrl}${locale === DEFAULT_LOCALE ? '' : `/${locale}`}/glossary`,
      lastModified: new Date(),
      changeFrequency: 'daily' as ChangeFrequency,
      priority: 0.8,
    });
  }

  // Add glossary entries
  for (const locale of UI_LOCALES) {
    const serverResult = await listPublishedPostsAction({
      locale: locale,
      pageSize: 1000,
      visibility: "public",
      postType: "glossary",
    });
    if (serverResult.success && serverResult.data?.posts) {
      serverResult.data.posts.forEach((post) => {
        const slugPart = post.slug?.replace(/^\//, "").replace(/^glossary\//, "");
        if (slugPart) {
          allGlossarySitemapEntries.push({
            url: `${siteUrl}${locale === DEFAULT_LOCALE ? '' : `/${locale}`}/glossary/${slugPart}`,
            lastModified: post.publishedAt || new Date(),
            changeFrequency: 'daily' as ChangeFrequency,
            priority: 0.7,
          });
        }
      });
    }
  }

  const uniqueGlossaryEntries = Array.from(
    new Map(allGlossarySitemapEntries.map((entry) => [entry.url, entry])).values()
  );

  // Documentation pages (MDX docs)
  const allDocSitemapEntries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    // Add docs index page
    allDocSitemapEntries.push({
      url: `${siteUrl}${locale === DEFAULT_LOCALE ? '' : `/${locale}`}/docs`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as ChangeFrequency,
      priority: 0.9,
    });

    // Add individual doc pages
    const slugs = await listDocSlugs(locale);
    for (const slug of slugs) {
      allDocSitemapEntries.push({
        url: `${siteUrl}${locale === DEFAULT_LOCALE ? '' : `/${locale}`}/docs/${slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as ChangeFrequency,
        priority: 0.8,
      });
    }
  }

  // Deduplicate doc entries (in case English fallback creates duplicates)
  const uniqueDocEntries = Array.from(
    new Map(allDocSitemapEntries.map((entry) => [entry.url, entry])).values()
  );

  return [
    ...pages,
    ...nonLocalizedPageEntries,
    ...uniqueBlogPostEntries,
    ...uniqueGlossaryEntries,
    ...uniqueDocEntries,
  ]
}
