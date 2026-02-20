#!/usr/bin/env tsx
import postgres from 'postgres';

async function updateEnum() {
  const connectionString = process.env.DATABASE_URL!;
  const sql = postgres(connectionString, {
    max: 1,
    ssl: 'require',
  });
  
  try {
    console.log('Adding "doc" to post_type enum...');
    
    await sql`
      ALTER TYPE learnclawdbot.post_type ADD VALUE IF NOT EXISTS 'doc'
    `;
    
    console.log('✅ Enum updated successfully!');
  } finally {
    await sql.end();
  }
}

updateEnum()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Failed to update enum:', err);
    process.exit(1);
  });
