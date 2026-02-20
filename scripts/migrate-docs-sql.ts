#!/usr/bin/env tsx
import postgres from 'postgres';
import fs from 'fs';
import { glob } from 'glob';
import matter from 'gray-matter';

const AUTHOR_EMAIL = '452914639@qq.com';
const SCHEMA = 'learnclawdbot';

// Extract title from content
function extractTitle(content: string): string | null {
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('# ')) {
      return line.replace('# ', '').trim();
    }
  }
  return null;
}

// Generate slug from file path
function generateSlug(filePath: string): string {
  const relativePath = filePath
    .replace(/^docs\/[^/]+\//, '') // Remove docs/{lang}/
    .replace(/\.mdx$/, '') // Remove .mdx
    .replace(/\/index$/, ''); // Remove /index
  
  return relativePath || 'index';
}

// Get language from file path
function getLanguage(filePath: string): string {
  const match = filePath.match(/^docs\/([^/]+)\//);
  return match ? match[1] : 'en';
}

async function migrateDocsToDatabase() {
  console.log('Starting docs migration...\n');
  
  const connectionString = process.env.DATABASE_URL!;
  const sql = postgres(connectionString, {
    max: 1,
    ssl: 'require',
  });
  
  try {
    // Get author ID
    const [author] = await sql`
      SELECT id, email 
      FROM ${sql(SCHEMA)}.user 
      WHERE email = ${AUTHOR_EMAIL} 
      LIMIT 1
    `;
    
    if (!author) {
      throw new Error(`Author with email ${AUTHOR_EMAIL} not found!`);
    }
    
    console.log(`Author ID: ${author.id}\n`);
    
    // Find all MDX files
    const files = await glob('docs/**/*.mdx', { cwd: process.cwd() });
    console.log(`Found ${files.length} MDX files\n`);
    
    const results = {
      total: files.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ file: string; error: string }>,
    };
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const { data: frontmatter, content: mdxContent } = matter(content);
        
        const slug = generateSlug(file);
        const language = getLanguage(file);
        const title = (frontmatter.title as string) || extractTitle(mdxContent) || slug;
        const description = (frontmatter.summary as string) || (frontmatter.description as string) || '';
        
        // Upsert to database using raw SQL
        await sql`
          INSERT INTO ${sql(SCHEMA)}.posts (
            slug, title, content, description, language, 
            post_type, status, visibility, author_id, published_at
          ) VALUES (
            ${slug}, ${title}, ${mdxContent}, ${description}, ${language},
            'doc', 'published', 'public', ${author.id}, NOW()
          )
          ON CONFLICT (slug, language, post_type) 
          DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            description = EXCLUDED.description,
            updated_at = NOW()
        `;
        
        console.log(`✅ Migrated: ${language}/${slug}`);
        results.success++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`❌ Error processing ${file}:`, errorMessage);
        results.failed++;
        results.errors.push({ file, error: errorMessage });
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary:');
    console.log('='.repeat(60));
    console.log(`Total files: ${results.total}`);
    console.log(`Successful: ${results.success}`);
    console.log(`Failed: ${results.failed}`);
    
    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach(({ file, error }) => {
        console.log(`  - ${file}: ${error}`);
      });
    }
    
    console.log('='.repeat(60));
    
    return results;
  } finally {
    await sql.end();
  }
}

// Run migration
migrateDocsToDatabase()
  .then(() => {
    console.log('\n✅ Migration completed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  });
