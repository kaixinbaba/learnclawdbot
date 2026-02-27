#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL!);

async function checkPosts() {
  // Check posts with 'c0' in slug
  const cPosts = await sql`
    SELECT id, slug, title FROM learnclawdbot.posts WHERE slug ILIKE '%c0%' OR slug ILIKE '%case%'
  `;
  console.log('Posts with c0 or case in slug:', cPosts.length);
  for (const p of cPosts) {
    console.log(`- ${p.slug}: ${p.title}`);
  }
  
  // Also check all recent posts
  console.log('\n--- Recent posts ---');
  const posts = await sql`
    SELECT id, slug, title, post_type FROM learnclawdbot.posts ORDER BY created_at DESC LIMIT 10
  `;
  for (const p of posts) {
    console.log(`- ${p.slug}: ${p.title}`);
  }
}

checkPosts().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
