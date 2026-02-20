import { db } from "./db";
import { posts } from "./db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { LOCALES } from "@/i18n/routing";

export interface DocMeta {
  title: string;
  summary?: string;
  slug: string;
  children?: DocMeta[];
}

export interface DocContent {
  content: string;
  frontmatter: Record<string, any>;
  title: string;
  slug: string;
}

/**
 * Get MDX content for a doc page by slug and locale.
 * Falls back to "en" if the requested locale doesn't exist.
 */
export async function getDocBySlug(
  slug: string,
  locale: string
): Promise<DocContent | null> {
  // Try locale-specific first, then fallback to en
  const locales = locale === "en" ? ["en"] : [locale, "en"];

  for (const loc of locales) {
    const [post] = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.slug, slug),
          eq(posts.language, loc),
          eq(posts.postType, "doc"),
          eq(posts.status, "published")
        )
      )
      .limit(1);

    if (post) {
      return {
        content: post.content || "",
        frontmatter: {
          title: post.title,
          summary: post.description,
        },
        title: post.title,
        slug: post.slug,
      };
    }
  }

  return null;
}

/**
 * Get list of locales that have actual content for a specific doc slug.
 * Used to generate accurate hreflang tags (only for locales with real content).
 */
export async function getAvailableLocalesForDoc(slug: string): Promise<string[]> {
  const availablePosts = await db
    .select({ language: posts.language })
    .from(posts)
    .where(
      and(
        eq(posts.slug, slug),
        eq(posts.postType, "doc"),
        eq(posts.status, "published")
      )
    );

  return availablePosts.map((p) => p.language).filter((lang) => LOCALES.includes(lang as any));
}

/**
 * List all doc slugs for a given locale (for generateStaticParams).
 */
export async function listDocSlugs(locale: string): Promise<string[]> {
  const docPosts = await db
    .select({ slug: posts.slug })
    .from(posts)
    .where(
      and(
        eq(posts.language, locale),
        eq(posts.postType, "doc"),
        eq(posts.status, "published")
      )
    );

  return docPosts.map((p) => p.slug);
}

/**
 * Build a simple sidebar structure from the database.
 * Groups docs by top-level category (first part of slug before /).
 */
export async function getDocSidebar(
  locale: string
): Promise<SidebarSection[]> {
  const docPosts = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.language, locale),
        eq(posts.postType, "doc"),
        eq(posts.status, "published")
      )
    )
    .orderBy(desc(posts.isPinned), asc(posts.slug));

  // Group by top-level category
  const sections: Map<string, SidebarItem[]> = new Map();
  
  for (const post of docPosts) {
    const parts = post.slug.split("/");
    const category = parts.length > 1 ? parts[0] : "General";
    
    const item: SidebarItem = {
      title: post.title,
      slug: post.slug,
    };
    
    if (!sections.has(category)) {
      sections.set(category, []);
    }
    sections.get(category)!.push(item);
  }

  // Convert to sidebar sections
  const result: SidebarSection[] = [];
  
  // Sort sections by name, but put "General" first
  const sortedCategories = Array.from(sections.keys()).sort((a, b) => {
    if (a === "General") return -1;
    if (b === "General") return 1;
    return a.localeCompare(b);
  });

  for (const category of sortedCategories) {
    const items = sections.get(category)!;
    const title = category
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    
    result.push({
      title,
      items: items.sort((a, b) => a.title.localeCompare(b.title)),
    });
  }

  return result;
}

export interface SidebarItem {
  title: string;
  slug: string;
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}
