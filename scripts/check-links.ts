#!/usr/bin/env tsx
/**
 * Script to check for broken internal links in MDX files
 * Helps diagnose "Page has links to broken page" issues
 */

import fs from 'fs/promises';
import path from 'path';
import { LOCALES } from '../i18n/routing';

const DOCS_DIR = path.join(process.cwd(), 'docs');
const BLOGS_DIR = path.join(process.cwd(), 'blogs');

interface BrokenLink {
  sourceFile: string;
  link: string;
  locale: string;
}

const brokenLinks: BrokenLink[] = [];

// Regex to find markdown links [text](url)
const LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkLinksInFile(
  filePath: string,
  content: string,
  locale: string,
  baseDir: string
): Promise<void> {
  const matches = content.matchAll(LINK_REGEX);
  
  for (const match of matches) {
    const link = match[2];
    
    // Skip external links, anchors, and special links
    if (
      link.startsWith('http://') ||
      link.startsWith('https://') ||
      link.startsWith('#') ||
      link.startsWith('mailto:') ||
      link.startsWith('tel:')
    ) {
      continue;
    }
    
    // Handle relative links
    let targetPath: string;
    if (link.startsWith('/')) {
      // Absolute path from site root
      // Check if it's a docs or blog link
      if (link.startsWith('/docs/')) {
        const slug = link.replace('/docs/', '').replace(/\/$/, '');
        targetPath = path.join(DOCS_DIR, locale, `${slug}.mdx`);
        const indexPath = path.join(DOCS_DIR, locale, slug, 'index.mdx');
        
        const exists = await fileExists(targetPath) || await fileExists(indexPath);
        if (!exists) {
          brokenLinks.push({
            sourceFile: filePath,
            link,
            locale,
          });
        }
      } else if (link.startsWith('/blog/')) {
        const slug = link.replace('/blog/', '').replace(/\/$/, '');
        targetPath = path.join(BLOGS_DIR, locale, `${slug}.mdx`);
        
        const exists = await fileExists(targetPath);
        if (!exists) {
          brokenLinks.push({
            sourceFile: filePath,
            link,
            locale,
          });
        }
      }
    } else {
      // Relative path from current file
      const fileDir = path.dirname(filePath);
      targetPath = path.join(fileDir, link);
      
      // Try both as-is and with .mdx extension
      const exists = await fileExists(targetPath) || await fileExists(`${targetPath}.mdx`);
      if (!exists && link.endsWith('/')) {
        const indexExists = await fileExists(path.join(targetPath, 'index.mdx'));
        if (!indexExists) {
          brokenLinks.push({
            sourceFile: filePath,
            link,
            locale,
          });
        }
      } else if (!exists) {
        brokenLinks.push({
          sourceFile: filePath,
          link,
          locale,
        });
      }
    }
  }
}

async function scanDirectory(dir: string, locale: string, baseDir: string): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      // Skip hidden files and directories
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) {
        continue;
      }
      
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await scanDirectory(fullPath, locale, baseDir);
      } else if (entry.name.endsWith('.mdx')) {
        const content = await fs.readFile(fullPath, 'utf-8');
        await checkLinksInFile(fullPath, content, locale, baseDir);
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dir}:`, error);
  }
}

async function main() {
  console.log('🔍 Checking for broken internal links in MDX files...\n');
  
  // Check docs
  console.log('📚 Scanning docs...');
  for (const locale of LOCALES) {
    const docsLocaleDir = path.join(DOCS_DIR, locale);
    await scanDirectory(docsLocaleDir, locale, DOCS_DIR);
  }
  
  // Check blogs if they exist
  console.log('📝 Scanning blogs...');
  try {
    await fs.access(BLOGS_DIR);
    for (const locale of LOCALES) {
      const blogsLocaleDir = path.join(BLOGS_DIR, locale);
      try {
        await fs.access(blogsLocaleDir);
        await scanDirectory(blogsLocaleDir, locale, BLOGS_DIR);
      } catch {
        // Locale dir doesn't exist, skip
      }
    }
  } catch {
    console.log('  (No blogs directory found)');
  }
  
  // Report results
  console.log('\n' + '='.repeat(80));
  if (brokenLinks.length === 0) {
    console.log('✅ No broken internal links found!');
  } else {
    console.log(`❌ Found ${brokenLinks.length} broken internal links:\n`);
    
    // Group by locale
    const byLocale: Record<string, BrokenLink[]> = {};
    for (const broken of brokenLinks) {
      if (!byLocale[broken.locale]) {
        byLocale[broken.locale] = [];
      }
      byLocale[broken.locale].push(broken);
    }
    
    for (const [locale, links] of Object.entries(byLocale)) {
      console.log(`\n📍 Locale: ${locale} (${links.length} broken links)`);
      for (const broken of links) {
        const relativePath = broken.sourceFile.replace(process.cwd(), '');
        console.log(`  ${relativePath}`);
        console.log(`    → ${broken.link}`);
      }
    }
  }
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
