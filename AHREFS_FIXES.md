# Ahrefs Health Issues - Fixes Applied

## Summary
This document outlines the fixes applied to resolve Ahrefs health detection issues on learnclawdbot.org.

## Problems Identified and Fixed

### 1. Hreflang to redirect or broken page (58 issues)

**Root Cause**: The `constructMetadata()` function was generating hreflang tags for all UI_LOCALES/LOCALES even when the actual content didn't exist in all those locales.

**Fix Applied**:
- Added `getAvailableLocalesForDoc(slug)` function in `lib/docs.ts` that checks which locales actually have the doc file
- Updated docs page metadata generation to only include hreflang for locales where the doc exists
- Blog pages already had similar logic implemented

**Files Changed**:
- `lib/docs.ts` - Added `getAvailableLocalesForDoc()` function
- `app/[locale]/(basic-layout)/docs/[...slug]/page.tsx` - Updated `generateMetadata()` to check available locales

### 2. Page has links to broken page (27 issues)

**Root Cause**: Several documentation directories (`automation`, `concepts`, `diagnostics`, `plugins`) were missing `index.mdx` files, causing 404 errors when users navigated to `/docs/automation` etc.

**Fix Applied**:
- Created `index.mdx` files for all missing directories in all 5 locales (en, zh, ja, ko, ru)
- Each index provides an overview of the section with links to sub-pages

**Files Created**:
- `docs/{locale}/automation/index.mdx` (5 locales)
- `docs/{locale}/concepts/index.mdx` (5 locales)
- `docs/{locale}/diagnostics/index.mdx` (5 locales)
- `docs/{locale}/plugins/index.mdx` (5 locales)

Total: 20 new index files

### 3. Diagnostic Tool Created

**File Created**: `scripts/check-links.ts`

A TypeScript script to scan all MDX files for broken internal links. This helps identify broken links proactively.

Usage: `npx tsx scripts/check-links.ts`

## Technical Details

### How `getAvailableLocalesForDoc()` Works

```typescript
export async function getAvailableLocalesForDoc(slug: string): Promise<string[]> {
  const available: string[] = [];
  
  for (const locale of LOCALES) {
    // Check both direct file and index file patterns
    const directPath = path.join(DOCS_DIR, locale, `${slug}.mdx`);
    const indexPath = path.join(DOCS_DIR, locale, slug, "index.mdx");
    
    try {
      await fs.access(directPath);
      available.push(locale);
      continue;
    } catch {}
    
    try {
      await fs.access(indexPath);
      available.push(locale);
    } catch {}
  }
  
  return available;
}
```

This function:
1. Iterates through all defined locales
2. Checks if the doc exists as either `{slug}.mdx` or `{slug}/index.mdx`
3. Returns only locales where the file actually exists

### Metadata Generation Flow

Before:
```typescript
return constructMetadata({
  title: `${doc.title} - OpenClaw Docs`,
  availableLocales: LOCALES, // All locales, even if content doesn't exist
});
```

After:
```typescript
const availableLocales = await getAvailableLocalesForDoc(slugStr);

return constructMetadata({
  title: `${doc.title} - OpenClaw Docs`,
  availableLocales: availableLocales.length > 0 ? availableLocales : undefined,
});
```

## Impact

### Expected Improvements:
1. **Reduced 404s**: Missing index pages now exist
2. **Accurate hreflang tags**: Only generated for locales with actual content
3. **Better SEO**: Search engines won't be directed to non-existent pages
4. **Improved Ahrefs score**: Should resolve most of the 58 hreflang issues and 27 broken link issues

### Notes on Remaining Issues:

**Hreflang to non-canonical (4 issues)**: 
- These are likely homepage-related and may need verification
- Current logic should be correct but may need domain/redirect verification

**Timeout (1 issue)**:
- `https://learnclawdbot.org/docs/debugging` (non-www)
- This is likely a DNS/redirect configuration issue, not a code issue
- Check if non-www redirects properly to www

## Testing Recommendations

1. Build the site and verify no errors: `npm run build`
2. Check that `/docs/automation`, `/docs/concepts`, `/docs/diagnostics`, `/docs/plugins` now load properly
3. Verify hreflang tags in page source only include locales with actual content
4. Run link checker: `npx tsx scripts/check-links.ts`
5. After deployment, re-run Ahrefs audit to verify improvements

## Next Steps

1. Deploy changes
2. Wait for Ahrefs to re-crawl (may take a few days)
3. Monitor Ahrefs health score improvements
4. Address any remaining issues that surface
