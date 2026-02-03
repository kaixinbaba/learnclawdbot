import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';

const DEFAULT_LOCALE = 'en';

const NON_DOCS_ROUTES = [
  '/docs/',
  '/blog/',
  '/about',
  '/what-is-openclaw',
  '/pricing',
  '/_next/',
  '/api/',
  '/static/',
];

/**
 * Rehype plugin to automatically prefix internal links in docs with /docs/
 * and the current locale prefix (for non-default locales).
 *
 * Examples (locale = 'zh'):
 *   /gateway/configuration → /zh/docs/gateway/configuration
 *   /concepts/models       → /zh/docs/concepts/models
 *
 * Examples (locale = 'en' / default):
 *   /gateway/configuration → /docs/gateway/configuration
 *
 * Skips external links, anchor links, and known non-docs routes.
 */
export default function rehypeDocsLinks(options?: { locale?: string }) {
  const locale = options?.locale || DEFAULT_LOCALE;
  const prefix = locale === DEFAULT_LOCALE ? '/docs' : `/${locale}/docs`;

  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'a' && node.properties?.href) {
        const href = String(node.properties.href);

        // Skip external links
        if (href.startsWith('http://') || href.startsWith('https://')) {
          return;
        }

        // Skip anchor links
        if (href.startsWith('#')) {
          return;
        }

        // Skip relative links (not starting with /)
        if (!href.startsWith('/')) {
          return;
        }

        // Skip links that already have a known route prefix
        const shouldSkip = NON_DOCS_ROUTES.some(route => href.startsWith(route));
        if (shouldSkip) {
          return;
        }

        // Also skip links that already have a locale prefix (e.g. /zh/docs/...)
        if (/^\/[a-z]{2}\//.test(href)) {
          return;
        }

        // Add locale + /docs/ prefix to internal links
        node.properties.href = `${prefix}${href}`;
      }
    });
  };
}
