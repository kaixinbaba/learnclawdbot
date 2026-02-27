#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL!);

async function cleanupUserCases() {
  
  // 1. Delete C06 gh-cli wrong data
  console.log('1. Deleting C06 gh-cli wrong data...');
  const deleteResult = await sql`
    DELETE FROM learnclawdbot.posts 
    WHERE slug LIKE 'c06-gh-cli%' OR slug LIKE 'c06%' AND title LIKE '%gh-cli%'
  `;
  console.log('Deleted:', deleteResult);
  
  // 2. Remove C01, C02, C03, C04, C05 prefixes from titles (not C06 - already clean)
  console.log('\n2. Removing C01-C05 prefixes from user case titles...');
  
  // First, let's check what titles have C01-C05 prefixes
  const titlesWithPrefix = await sql`
    SELECT id, slug, title FROM learnclawdbot.posts
    WHERE (title ILIKE 'C01%' OR title ILIKE 'C02%' OR title ILIKE 'C03%' OR title ILIKE 'C04%' OR title ILIKE 'C05%')
    AND post_type = 'blog'
  `;
  
  console.log(`Found ${titlesWithPrefix.length} posts with C01-C05 prefix`);
  
  // Update each one
  for (const post of titlesWithPrefix) {
    const newTitle = post.title.replace(/^C[0-9]+[.:\s]+/, '');
    await sql`
      UPDATE learnclawdbot.posts
      SET title = ${newTitle}, updated_at = NOW()
      WHERE id = ${post.id}
    `;
    console.log(`  Updated: ${post.slug} -> ${newTitle}`);
  }
  
  // 3. Verify current user case posts
  console.log('\n3. Current user case posts:');
  const posts = await sql`
    SELECT slug, title, featured_image_url
    FROM learnclawdbot.posts
    WHERE slug LIKE 'c0%' AND post_type = 'blog'
    ORDER BY slug
  `;
  
  for (const post of posts) {
    console.log(`\n- ${post.slug}`);
    console.log(`  Title: ${post.title}`);
    console.log(`  Image: ${post.featured_image_url}`);
  }
  
  console.log('\n✅ Cleanup completed!');
}

cleanupUserCases()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Cleanup failed:', err);
    process.exit(1);
  });
