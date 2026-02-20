#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

const DATABASE_URL = 'postgresql://postgres.mvruafyexvrqcjihqrli:Qei6L56bcQ19VjVN@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres';

// Parse connection string
const url = new URL(DATABASE_URL);
const supabaseUrl = `https://${url.hostname.replace('.pooler.supabase.com', '.supabase.co')}`;
const supabaseKey = url.password; // Use password as service key for now

const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_KEY || supabaseKey);

// Get author ID
async function getAuthorId() {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', '452914639@qq.com')
    .single();
  
  if (error) {
    console.error('Error fetching author:', error);
    throw error;
  }
  
  return data.id;
}

// Extract title from content
function extractTitle(content) {
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('# ')) {
      return line.replace('# ', '').trim();
    }
  }
  return null;
}

// Generate slug from file path
function generateSlug(filePath) {
  // docs/en/cli/setup.mdx → cli/setup
  const relativePath = filePath
    .replace(/^docs\/[^/]+\//, '') // Remove docs/{lang}/
    .replace(/\.mdx$/, '') // Remove .mdx
    .replace(/\/index$/, ''); // Remove /index
  
  return relativePath || 'index';
}

// Get language from file path
function getLanguage(filePath) {
  const match = filePath.match(/^docs\/([^/]+)\//);
  return match ? match[1] : 'en';
}

async function migrateDocsToDatabase() {
  console.log('Starting docs migration...\n');
  
  // Get author ID
  const authorId = await getAuthorId();
  console.log(`Author ID: ${authorId}\n`);
  
  // Find all MDX files
  const files = await glob('docs/**/*.mdx', { cwd: process.cwd() });
  console.log(`Found ${files.length} MDX files\n`);
  
  const results = {
    total: files.length,
    success: 0,
    failed: 0,
    errors: []
  };
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const { data: frontmatter, content: mdxContent } = matter(content);
      
      const slug = generateSlug(file);
      const language = getLanguage(file);
      const title = frontmatter.title || extractTitle(mdxContent) || slug;
      const description = frontmatter.summary || frontmatter.description || '';
      
      // Prepare post data
      const postData = {
        slug,
        title,
        content: mdxContent,
        description,
        language,
        post_type: 'doc',
        status: 'published',
        visibility: 'public',
        author_id: authorId,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Upsert to database
      const { error } = await supabase
        .from('posts')
        .upsert(postData, {
          onConflict: 'slug,language,post_type',
          ignoreDuplicates: false
        });
      
      if (error) {
        console.error(`❌ Failed: ${file}`, error.message);
        results.failed++;
        results.errors.push({ file, error: error.message });
      } else {
        console.log(`✅ Migrated: ${language}/${slug}`);
        results.success++;
      }
      
    } catch (err) {
      console.error(`❌ Error processing ${file}:`, err.message);
      results.failed++;
      results.errors.push({ file, error: err.message });
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
