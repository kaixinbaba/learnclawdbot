#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';

async function checkDatabase() {
  const sql = neon(process.env.DATABASE_URL + '?options=-c%20search_path=learnclawdbot');
  
  // Check schemas
  console.log('Checking schemas...');
  const schemas = await sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'learnclawdbot'`;
  console.log('Schemas:', schemas);
  
  // Check users table
  console.log('\nChecking users table...');
  const users = await sql`SELECT id, email FROM learnclawdbot.users LIMIT 5`;
  console.log('Users:', users);
  
  //  Check for specific user
  console.log('\nChecking for specific user...');
  const targetUser = await sql`SELECT id, email FROM learnclawdbot.users WHERE email = '452914639@qq.com'`;
  console.log('Target user:', targetUser);
  
  // Check posts table structure
  console.log('\nChecking posts table...');
  const postsCheck = await sql`SELECT COUNT(*) FROM learnclawdbot.posts WHERE post_type = 'doc'`;
  console.log('Existing doc posts:', postsCheck);
}

checkDatabase()
  .then(() => {
    console.log('\n✅ Database check completed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Database check failed:', err);
    process.exit(1);
  });
