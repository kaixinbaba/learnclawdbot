#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const DOCS_DIR = path.join(process.cwd(), 'docs');
const LOCALES = ['en', 'zh', 'ja', 'ko', 'ru'];

async function checkAllMdxFiles() {
  console.log('Checking all MDX files for valid frontmatter...\n');

  let totalFiles = 0;
  let missingTitle = 0;
  let parseErrors = 0;

  for (const locale of LOCALES) {
    const localeDir = path.join(DOCS_DIR, locale);
    
    if (!fs.existsSync(localeDir)) {
      console.log(`⚠️  Locale directory not found: ${locale}`);
      continue;
    }

    await checkDirectory(localeDir, locale);
  }

  async function checkDirectory(dir: string, locale: string, relativePath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      // Skip hidden files and asset directories
      if (entry.name.startsWith('.') || entry.name.startsWith('_') || 
          entry.name === 'assets' || entry.name === 'images') {
        continue;
      }

      if (entry.isDirectory()) {
        await checkDirectory(fullPath, locale, relPath);
      } else if (entry.name.endsWith('.mdx')) {
        totalFiles++;
        
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const { data, content: mdxContent } = matter(content);

          if (!data.title) {
            // Try to extract from first h1
            const h1Match = mdxContent.match(/^#\s+(.+)$/m);
            if (!h1Match) {
              console.log(`⚠️  Missing title: ${locale}/${relPath}`);
              missingTitle++;
            }
          }
        } catch (err) {
          console.log(`❌ Parse error: ${locale}/${relPath}`);
          console.log(`   ${err}`);
          parseErrors++;
        }
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`Checked ${totalFiles} MDX files`);
  console.log(`Missing titles: ${missingTitle}`);
  console.log(`Parse errors: ${parseErrors}`);

  if (missingTitle === 0 && parseErrors === 0) {
    console.log('✅ All MDX files are valid');
  } else {
    console.log('⚠️  Found issues that may need attention');
  }
}

checkAllMdxFiles().catch(console.error);
