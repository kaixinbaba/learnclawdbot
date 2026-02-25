import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });

const BLOG_CATEGORIES = [
  "Beginner Basics",
  "Configuration & Manifest",
  "Channel Integrations",
  "Multi-Agent & Browser",
  "Reliability & Performance",
  "Voice & Audio",
] as const;

const BLOG_SLUG_TO_CATEGORY: Record<string, (typeof BLOG_CATEGORIES)[number]> = {
  guide: "Beginner Basics",
  "how-to-open-terminal": "Beginner Basics",
  "openclaw-environment-variables": "Configuration & Manifest",
  "openclaw-plugin-json-guide": "Configuration & Manifest",
  "feishu-lark-integration": "Channel Integrations",
  "line-integration": "Channel Integrations",
  "multi-agent-setup": "Multi-Agent & Browser",
  "browser-relay": "Multi-Agent & Browser",
  "websocket-disconnect-fix": "Reliability & Performance",
  "performance-optimization": "Reliability & Performance",
  "cron-job-best-practices": "Reliability & Performance",
  "voice-call-setup": "Voice & Audio",
};

const args = new Set(process.argv.slice(2));
const shouldApply = args.has("--apply");
const strictMode = args.has("--strict");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Please set it in .env.local");
}

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

type BlogPostRow = {
  id: string;
  slug: string;
  language: string;
};

async function getPublishedBlogPosts() {
  return (await sql`
    SELECT id, slug, language
    FROM posts
    WHERE post_type = 'blog' AND status = 'published'
    ORDER BY language, slug;
  `) as BlogPostRow[];
}

async function getSummary() {
  const byLanguage = await sql`
    SELECT language, COUNT(*)::int AS count
    FROM posts
    WHERE post_type = 'blog' AND status = 'published'
    GROUP BY language
    ORDER BY language;
  `;

  const postsWithoutTag = await sql`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT p.id
      FROM posts p
      LEFT JOIN post_tags pt ON pt.post_id = p.id
      WHERE p.post_type = 'blog' AND p.status = 'published'
      GROUP BY p.id
      HAVING COUNT(pt.tag_id) = 0
    ) t;
  `;

  const categoryCoverage = await sql`
    SELECT t.name, COUNT(DISTINCT pt.post_id)::int AS count
    FROM tags t
    LEFT JOIN post_tags pt ON pt.tag_id = t.id
    LEFT JOIN posts p ON p.id = pt.post_id
    WHERE t.post_type = 'blog'
      AND (p.id IS NULL OR (p.post_type = 'blog' AND p.status = 'published'))
    GROUP BY t.id, t.name
    ORDER BY t.name;
  `;

  const uniqueSlugs = await sql`
    SELECT COUNT(DISTINCT slug)::int AS count
    FROM posts
    WHERE post_type = 'blog' AND status = 'published';
  `;

  return {
    byLanguage,
    postsWithoutTagCount: postsWithoutTag[0]?.count ?? 0,
    uniquePublishedSlugCount: uniqueSlugs[0]?.count ?? 0,
    categoryCoverage,
  };
}

async function applyBlogTagTaxonomy() {
  let insertedTags = 0;
  let insertedPostTags = 0;

  for (const category of BLOG_CATEGORIES) {
    const inserted = await sql`
      INSERT INTO tags (name, post_type)
      VALUES (${category}, 'blog')
      ON CONFLICT (name, post_type) DO NOTHING
      RETURNING id;
    `;
    insertedTags += inserted.length;
  }

  const existingTags = (await sql`
    SELECT id, name
    FROM tags
    WHERE post_type = 'blog';
  `) as Array<{ id: string; name: string }>;

  const tagIdByName = Object.fromEntries(existingTags.map((t) => [t.name, t.id])) as Record<
    string,
    string
  >;

  const posts = await getPublishedBlogPosts();

  const missingMappings: Array<{ id: string; slug: string; language: string }> = [];
  const missingTagDefinitions: Array<{ slug: string; category: string }> = [];

  for (const post of posts) {
    const category = BLOG_SLUG_TO_CATEGORY[post.slug];

    if (!category) {
      missingMappings.push(post);
      continue;
    }

    const tagId = tagIdByName[category];
    if (!tagId) {
      missingTagDefinitions.push({ slug: post.slug, category });
      continue;
    }

    const inserted = await sql`
      INSERT INTO post_tags (post_id, tag_id)
      VALUES (${post.id}, ${tagId})
      ON CONFLICT (post_id, tag_id) DO NOTHING
      RETURNING post_id;
    `;
    insertedPostTags += inserted.length;
  }

  return {
    insertedTags,
    insertedPostTags,
    missingMappings,
    missingTagDefinitions,
    totalPublishedBlogPosts: posts.length,
  };
}

(async () => {
  try {
    const publishedPosts = await getPublishedBlogPosts();

    const missingMappings = publishedPosts
      .filter((post) => !BLOG_SLUG_TO_CATEGORY[post.slug])
      .map((post) => ({ id: post.id, slug: post.slug, language: post.language }));

    const applyResult = shouldApply ? await applyBlogTagTaxonomy() : null;
    const summary = await getSummary();

    const sampleFilterValidation = await sql`
      SELECT t.name, COUNT(DISTINCT p.id)::int AS count
      FROM posts p
      JOIN post_tags pt ON pt.post_id = p.id
      JOIN tags t ON t.id = pt.tag_id
      WHERE p.post_type = 'blog'
        AND p.status = 'published'
        AND p.language = 'en'
      GROUP BY t.name
      ORDER BY count DESC, t.name ASC;
    `;

    const output = {
      mode: shouldApply ? "apply" : "check",
      strictMode,
      taxonomy: {
        categories: BLOG_CATEGORIES,
        mappedSlugCount: Object.keys(BLOG_SLUG_TO_CATEGORY).length,
      },
      applyResult,
      missingMappings,
      summary,
      sampleFilterValidation,
    };

    console.log(JSON.stringify(output, null, 2));

    if (strictMode && missingMappings.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("blog-tag-taxonomy failed:", error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
})();
