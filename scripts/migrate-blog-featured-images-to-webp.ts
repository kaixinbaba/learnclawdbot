import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Please set it in .env.local");
}

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

const FEATURED_IMAGE_MAPPINGS = [
  [
    "/images/blog/browser-relay-hero.svg",
    "/images/blog/browser-relay-hero.webp",
  ],
  [
    "/images/blog/c01-nix-openclaw-declarative-deployment.svg",
    "/images/blog/c01-nix-openclaw-declarative-deployment.webp",
  ],
  [
    "/images/blog/c02-padel-cli-booking-automation.svg",
    "/images/blog/c02-padel-cli-booking-automation.webp",
  ],
  [
    "/images/blog/c03-snag-screenshot-to-markdown.svg",
    "/images/blog/c03-snag-screenshot-to-markdown.webp",
  ],
  [
    "/images/blog/discord-integration.png",
    "/images/blog/discord-integration.webp",
  ],
  [
    "/images/blog/fix-session-memory-issues.png",
    "/images/blog/fix-session-memory-issues.webp",
  ],
  [
    "/images/blog/websocket-disconnect-fix.png",
    "/images/blog/websocket-disconnect-fix.webp",
  ],
] as const;

async function run() {
  const updatedRows: Array<{
    slug: string;
    language: string;
    oldUrl: string;
    newUrl: string;
  }> = [];

  for (const [oldUrl, newUrl] of FEATURED_IMAGE_MAPPINGS) {
    const updated = await sql<{
      slug: string;
      language: string;
    }[]>`
      UPDATE posts
      SET featured_image_url = ${newUrl},
          updated_at = NOW()
      WHERE post_type = 'blog'
        AND featured_image_url = ${oldUrl}
      RETURNING slug, language;
    `;

    for (const row of updated) {
      updatedRows.push({
        slug: row.slug,
        language: row.language,
        oldUrl,
        newUrl,
      });
    }
  }

  const remainingLegacyRefs = await sql<{
    featured_image_url: string;
    count: string;
  }[]>`
    SELECT featured_image_url, COUNT(*)::text AS count
    FROM posts
    WHERE post_type = 'blog'
      AND featured_image_url ~ '^/images/blog/[^/]+\\.(svg|png|jpe?g)$'
    GROUP BY featured_image_url
    ORDER BY featured_image_url;
  `;

  console.log(
    JSON.stringify(
      {
        ok: true,
        mappings: FEATURED_IMAGE_MAPPINGS,
        updatedCount: updatedRows.length,
        updatedRows,
        remainingLegacyRefs,
      },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    console.error("migrate-blog-featured-images-to-webp failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
