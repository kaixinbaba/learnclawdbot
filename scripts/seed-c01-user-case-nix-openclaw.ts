import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import postgres from "postgres";

loadEnv({ path: ".env.local" });

const AUTHOR_EMAIL = "452914639@qq.com";
const POST_TYPE = "blog";
const SLUG = "c01-nix-openclaw-declarative-deployment";
const FEATURED_IMAGE_URL =
  "/images/blog/c01-nix-openclaw-declarative-deployment.webp";

const TAG_NAMES = [
  "User Cases",
  "Deployment & Infrastructure",
  "Configuration & Manifest",
] as const;

const LOCALES = ["en", "zh", "ja", "ko", "ru"] as const;
type SupportedLocale = (typeof LOCALES)[number];

type LocalizedPost = {
  title: string;
  description: string;
  content: string;
};

function loadLocalizedPostsFromMarkdown(): Record<SupportedLocale, LocalizedPost> {
  const baseDir = path.join(process.cwd(), "data", "cms", "c01");

  const posts = {} as Record<SupportedLocale, LocalizedPost>;

  for (const locale of LOCALES) {
    const filePath = path.join(baseDir, `${locale}.md`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing content file: ${filePath}`);
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);

    const title = typeof data.title === "string" ? data.title.trim() : "";
    const description =
      typeof data.description === "string" ? data.description.trim() : "";

    if (!title) {
      throw new Error(`Missing frontmatter title in ${filePath}`);
    }
    if (!description) {
      throw new Error(`Missing frontmatter description in ${filePath}`);
    }

    posts[locale] = {
      title,
      description,
      content: content.trim(),
    };
  }

  return posts;
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Please set it in .env.local");
}

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

async function resolveAuthorId(): Promise<string> {
  const explicit = await sql`
    SELECT id
    FROM "user"
    WHERE email = ${AUTHOR_EMAIL}
    LIMIT 1;
  `;

  if (explicit.length > 0) {
    return explicit[0].id;
  }

  const fallback = await sql`
    SELECT id
    FROM "user"
    ORDER BY created_at ASC
    LIMIT 1;
  `;

  if (fallback.length === 0) {
    throw new Error("No user record found. Cannot seed post author.");
  }

  return fallback[0].id;
}

async function ensureTags() {
  const tagIdByName: Record<string, string> = {};

  for (const tagName of TAG_NAMES) {
    const result = await sql`
      INSERT INTO tags (name, post_type)
      VALUES (${tagName}, ${POST_TYPE})
      ON CONFLICT (name, post_type)
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name;
    `;

    tagIdByName[result[0].name] = result[0].id;
  }

  return tagIdByName;
}

async function upsertLocalizedPosts(
  localizedPosts: Record<SupportedLocale, LocalizedPost>,
  authorId: string,
  tagIds: string[]
) {
  const summary = {
    inserted: 0,
    updated: 0,
    locales: [] as SupportedLocale[],
  };

  for (const locale of LOCALES) {
    const post = localizedPosts[locale];

    const existing = await sql`
      SELECT id
      FROM posts
      WHERE slug = ${SLUG}
        AND language = ${locale}
        AND post_type = ${POST_TYPE}
      LIMIT 1;
    `;

    const result = await sql`
      INSERT INTO posts (
        language,
        post_type,
        author_id,
        title,
        slug,
        content,
        description,
        featured_image_url,
        is_pinned,
        status,
        visibility,
        published_at
      )
      VALUES (
        ${locale},
        ${POST_TYPE},
        ${authorId},
        ${post.title},
        ${SLUG},
        ${post.content},
        ${post.description},
        ${FEATURED_IMAGE_URL},
        false,
        'published',
        'public',
        NOW()
      )
      ON CONFLICT (slug, language, post_type)
      DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        description = EXCLUDED.description,
        featured_image_url = EXCLUDED.featured_image_url,
        status = EXCLUDED.status,
        visibility = EXCLUDED.visibility,
        updated_at = NOW()
      RETURNING id;
    `;

    const postId = result[0].id as string;

    await sql`
      DELETE FROM post_tags
      WHERE post_id = ${postId};
    `;

    for (const tagId of tagIds) {
      await sql`
        INSERT INTO post_tags (post_id, tag_id)
        VALUES (${postId}, ${tagId})
        ON CONFLICT (post_id, tag_id) DO NOTHING;
      `;
    }

    if (existing.length > 0) {
      summary.updated += 1;
    } else {
      summary.inserted += 1;
    }

    summary.locales.push(locale);
  }

  return summary;
}

async function main() {
  try {
    const localizedPosts = loadLocalizedPostsFromMarkdown();
    const authorId = await resolveAuthorId();
    const tagIdByName = await ensureTags();
    const tagIds = TAG_NAMES.map((name) => tagIdByName[name]);

    const postSummary = await upsertLocalizedPosts(
      localizedPosts,
      authorId,
      tagIds
    );

    const validation = await sql`
      SELECT p.language, p.slug, p.title, p.featured_image_url,
             array_agg(t.name ORDER BY t.name) AS tags
      FROM posts p
      JOIN post_tags pt ON pt.post_id = p.id
      JOIN tags t ON t.id = pt.tag_id
      WHERE p.post_type = ${POST_TYPE}
        AND p.slug = ${SLUG}
      GROUP BY p.id, p.language, p.slug, p.title, p.featured_image_url
      ORDER BY p.language;
    `;

    console.log(
      JSON.stringify(
        {
          ok: true,
          slug: SLUG,
          featuredImageUrl: FEATURED_IMAGE_URL,
          tags: TAG_NAMES,
          postSummary,
          validation,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error("seed-c01-user-case-nix-openclaw failed:", error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
