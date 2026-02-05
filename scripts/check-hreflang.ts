#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { listDocSlugs } from '../lib/docs';

const DOCS_DIR = path.join(process.cwd(), 'docs');
const LOCALES = ['en', 'zh', 'ja', 'ko', 'ru'];

async function getAvailableLocalesForDoc(slug: string): Promise<string[]> {
  const available: string[] = [];
  
  for (const locale of LOCALES) {
    const directPath = path.join(DOCS_DIR, locale, `${slug}.mdx`);
    const indexPath = path.join(DOCS_DIR, locale, slug, 'index.mdx');
    
    if (fs.existsSync(directPath) || fs.existsSync(indexPath)) {
      available.push(locale);
    }
  }
  
  return available;
}

async function checkHreflangConsistency() {
  console.log('Checking hreflang consistency across all doc pages...\n');

  const allSlugs = new Set<string>();
  
  // Collect all unique slugs across all locales
  for (const locale of LOCALES) {
    const slugs = await listDocSlugs(locale);
    slugs.forEach(slug => allSlugs.add(slug));
  }

  console.log(`Found ${allSlugs.size} unique doc slugs\n`);

  let inconsistencies = 0;

  for (const slug of Array.from(allSlugs).sort()) {
    const availableLocales = await getAvailableLocalesForDoc(slug);
    
    // Check if this slug exists in multiple locales
    if (availableLocales.length > 1 && availableLocales.length < LOCALES.length) {
      console.log(`⚠️  ${slug}`);
      console.log(`   Available in: ${availableLocales.join(', ')}`);
      console.log(`   Missing in: ${LOCALES.filter(l => !availableLocales.includes(l)).join(', ')}`);
      console.log('');
      inconsistencies++;
    }
  }

  console.log('='.repeat(80));
  if (inconsistencies === 0) {
    console.log('✅ All doc pages have consistent hreflang across locales');
  } else {
    console.log(`⚠️  Found ${inconsistencies} doc pages with missing translations`);
    console.log('   These pages will have incomplete hreflang tags');
    console.log('   This is NORMAL - not all docs are translated to all languages');
  }
  
  return inconsistencies;
}

checkHreflangConsistency().catch(console.error);
