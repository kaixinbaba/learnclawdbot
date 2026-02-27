import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL!);

async function check() {
  const result = await sql`
    SELECT DISTINCT post_type FROM learnclawdbot.posts WHERE slug LIKE 'c0%'
  `;
  console.log('Post types for c0% slugs:', result);
  
  // Also check one full record
  const one = await sql`SELECT * FROM learnclawdbot.posts WHERE slug LIKE 'c01%' LIMIT 1`;
  console.log('\nSample record:', JSON.stringify(one[0], null, 2));
}
check().then(() => process.exit(0));
