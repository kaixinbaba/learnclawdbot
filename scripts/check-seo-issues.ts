#!/usr/bin/env tsx

/**
 * Check SEO issues for specific problem URLs
 * 
 * Usage:
 *   npx tsx scripts/check-seo-issues.ts                          # Check default problem URLs
 *   npx tsx scripts/check-seo-issues.ts /zh/docs/some/page       # Check specific URL paths
 *   npx tsx scripts/check-seo-issues.ts https://www.learnclawdbot.org/ja/docs/cli/browser
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const DOCS_DIR = path.join(process.cwd(), 'docs');
const SITE_URL = 'https://www.learnclawdbot.org';
const LOCALES = ['en', 'zh', 'ja', 'ko', 'ru'];

interface CheckTarget {
  url: string;
  locale: string;
  slug: string;
}

function parseUrlToTarget(input: string): CheckTarget | null {
  // Strip site URL prefix if present
  let urlPath = input.replace(SITE_URL, '');
  
  // Ensure starts with /
  if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;
  
  // Parse locale and slug from path like /zh/docs/some/page or /docs/some/page
  const match = urlPath.match(/^\/(en|zh|ja|ko|ru)\/docs\/(.+)$/);
  if (match) {
    return { url: `${SITE_URL}${urlPath}`, locale: match[1], slug: match[2] };
  }
  
  // Default locale (en) for /docs/some/page
  const enMatch = urlPath.match(/^\/docs\/(.+)$/);
  if (enMatch) {
    return { url: `${SITE_URL}${urlPath}`, locale: 'en', slug: enMatch[1] };
  }

  console.log(`⚠️  Cannot parse: ${input}`);
  return null;
}

function checkFile(locale: string, slug: string): { exists: boolean; path?: string; error?: string } {
  const directPath = path.join(DOCS_DIR, locale, `${slug}.mdx`);
  const indexPath = path.join(DOCS_DIR, locale, slug, 'index.mdx');

  for (const filePath of [directPath, indexPath]) {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { data } = matter(content);
        
        if (!data.title) {
          return { exists: true, path: filePath, error: 'Missing title in frontmatter' };
        }
        
        return { exists: true, path: filePath };
      } catch (err) {
        return { exists: true, path: filePath, error: `Parse error: ${err}` };
      }
    }
  }

  return { exists: false, error: 'File not found' };
}

// Parse targets from CLI args or use defaults
const args = process.argv.slice(2);
let targets: CheckTarget[] = [];

if (args.length > 0) {
  for (const arg of args) {
    const target = parseUrlToTarget(arg);
    if (target) targets.push(target);
  }
} else {
  // Scan all locales for all docs and check them all
  console.log('No URLs specified. Scanning all docs for issues...\n');
  
  function scanDir(dir: string, locale: string, prefix = '') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
      const slug = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        scanDir(path.join(dir, entry.name), locale, slug);
      } else if (entry.name.endsWith('.mdx')) {
        const cleanSlug = slug.replace(/\/index\.mdx$/, '').replace(/\.mdx$/, '');
        targets.push({
          url: `${SITE_URL}${locale === 'en' ? '' : '/' + locale}/docs/${cleanSlug}`,
          locale,
          slug: cleanSlug,
        });
      }
    }
  }

  for (const locale of LOCALES) {
    scanDir(path.join(DOCS_DIR, locale), locale);
  }
}

console.log(`Checking ${targets.length} URLs...\n`);

let hasErrors = false;
let errorCount = 0;
let okCount = 0;

for (const { url, locale, slug } of targets) {
  const result = checkFile(locale, slug);
  
  if (result.exists && !result.error) {
    okCount++;
  } else if (result.exists && result.error) {
    console.log(`⚠️  ${url}`);
    console.log(`   ${result.error}`);
    hasErrors = true;
    errorCount++;
  } else {
    console.log(`❌ ${url}`);
    console.log(`   File not found`);
    hasErrors = true;
    errorCount++;
  }
}

console.log('\n' + '='.repeat(80));
console.log(`✅ ${okCount} OK | ❌ ${errorCount} issues`);
if (hasErrors) {
  process.exit(1);
} else {
  console.log('All files exist and are valid!');
  process.exit(0);
}
