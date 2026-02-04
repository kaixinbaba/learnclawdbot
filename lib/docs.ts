import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { LOCALES } from "@/i18n/routing";

const DOCS_DIR = path.join(process.cwd(), "docs");

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
 * Falls back to "en" if the requested locale file doesn't exist.
 */
export async function getDocBySlug(
  slug: string,
  locale: string
): Promise<DocContent | null> {
  // Try locale-specific file first, then fallback to en
  const locales = locale === "en" ? ["en"] : [locale, "en"];

  for (const loc of locales) {
    // Try slug.mdx directly
    const directPath = path.join(DOCS_DIR, loc, `${slug}.mdx`);
    // Try slug/index.mdx
    const indexPath = path.join(DOCS_DIR, loc, slug, "index.mdx");

    for (const filePath of [directPath, indexPath]) {
      try {
        const raw = await fs.readFile(filePath, "utf-8");
        const { content, data } = matter(raw);

        // Extract title from first h1 in content, or from frontmatter
        let title = data.title || "";
        if (!title) {
          const h1Match = content.match(/^#\s+(.+)$/m);
          if (h1Match) {
            title = h1Match[1].replace(/[*_`]/g, "").trim();
          }
        }
        if (!title) {
          title = slug.split("/").pop() || "Untitled";
        }

        return {
          content,
          frontmatter: data,
          title,
          slug,
        };
      } catch {
        // File doesn't exist, try next
      }
    }
  }

  return null;
}

/**
 * Get list of locales that have actual content for a specific doc slug.
 * Used to generate accurate hreflang tags (only for locales with real content).
 */
export async function getAvailableLocalesForDoc(slug: string): Promise<string[]> {
  const available: string[] = [];
  
  for (const locale of LOCALES) {
    const directPath = path.join(DOCS_DIR, locale, `${slug}.mdx`);
    const indexPath = path.join(DOCS_DIR, locale, slug, "index.mdx");
    
    try {
      await fs.access(directPath);
      available.push(locale);
      continue;
    } catch {}
    
    try {
      await fs.access(indexPath);
      available.push(locale);
    } catch {}
  }
  
  return available;
}

/**
 * List all doc slugs for a given locale (for generateStaticParams).
 */
export async function listDocSlugs(locale: string): Promise<string[]> {
  const slugs: string[] = [];
  const localeDir = path.join(DOCS_DIR, locale);

  try {
    await collectSlugs(localeDir, "", slugs);
  } catch {
    // Locale dir doesn't exist
  }

  return slugs;
}

async function collectSlugs(
  dir: string,
  prefix: string,
  slugs: string[]
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    // Skip hidden files, assets, layouts, config files
    if (
      entry.name.startsWith("_") ||
      entry.name.startsWith(".") ||
      entry.name === "assets" ||
      entry.name === "images" ||
      entry.name === "CNAME" ||
      entry.name === "docs.json"
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      const subPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
      await collectSlugs(path.join(dir, entry.name), subPrefix, slugs);
    } else if (entry.name.endsWith(".mdx")) {
      const name = entry.name.replace(/\.mdx$/, "");
      if (name === "index") {
        if (prefix) slugs.push(prefix);
      } else {
        slugs.push(prefix ? `${prefix}/${name}` : name);
      }
    }
  }
}

/**
 * Build a simple sidebar structure from the docs directory.
 */
export async function getDocSidebar(
  locale: string
): Promise<SidebarSection[]> {
  const localeDir = path.join(DOCS_DIR, locale);
  const sections: SidebarSection[] = [];

  try {
    const entries = await fs.readdir(localeDir, { withFileTypes: true });

    // Top-level .mdx files
    const topFiles: SidebarItem[] = [];
    const dirs: { name: string; path: string }[] = [];

    for (const entry of entries) {
      if (
        entry.name.startsWith("_") ||
        entry.name.startsWith(".") ||
        entry.name === "assets" ||
        entry.name === "images" ||
        entry.name === "CNAME" ||
        entry.name === "docs.json"
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        dirs.push({ name: entry.name, path: path.join(localeDir, entry.name) });
      } else if (entry.name.endsWith(".mdx") && entry.name !== "index.mdx") {
        const slug = entry.name.replace(/\.mdx$/, "");
        const title = await getDocTitle(path.join(localeDir, entry.name), slug);
        topFiles.push({ title, slug });
      }
    }

    if (topFiles.length > 0) {
      sections.push({ title: "General", items: topFiles.sort((a, b) => a.title.localeCompare(b.title)) });
    }

    // Subdirectories
    for (const dir of dirs.sort((a, b) => a.name.localeCompare(b.name))) {
      const items: SidebarItem[] = [];
      const subEntries = await fs.readdir(dir.path, { withFileTypes: true });

      for (const sub of subEntries) {
        if (sub.isFile() && sub.name.endsWith(".mdx")) {
          const name = sub.name.replace(/\.mdx$/, "");
          const slug =
            name === "index"
              ? dir.name
              : `${dir.name}/${name}`;
          const title = await getDocTitle(path.join(dir.path, sub.name), name);
          items.push({ title, slug });
        } else if (sub.isDirectory()) {
          // Handle nested dirs (e.g., gateway/security/)
          try {
            const nestedEntries = await fs.readdir(path.join(dir.path, sub.name), { withFileTypes: true });
            for (const nested of nestedEntries) {
              if (nested.isFile() && nested.name.endsWith(".mdx")) {
                const nName = nested.name.replace(/\.mdx$/, "");
                const slug =
                  nName === "index"
                    ? `${dir.name}/${sub.name}`
                    : `${dir.name}/${sub.name}/${nName}`;
                const title = await getDocTitle(
                  path.join(dir.path, sub.name, nested.name),
                  nName
                );
                items.push({ title, slug });
              }
            }
          } catch {
            // skip
          }
        }
      }

      if (items.length > 0) {
        const sectionTitle = dir.name
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        sections.push({ title: sectionTitle, items: items.sort((a, b) => a.title.localeCompare(b.title)) });
      }
    }
  } catch {
    // locale dir doesn't exist
  }

  return sections;
}

async function getDocTitle(filePath: string, fallback: string): Promise<string> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const { content, data } = matter(raw);
    if (data.title) return data.title;
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1].replace(/[*_`]/g, "").trim();
  } catch {
    // ignore
  }
  return fallback.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface SidebarItem {
  title: string;
  slug: string;
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}
