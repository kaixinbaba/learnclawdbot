import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';

/**
 * Rehype plugin to automatically prefix internal links in docs with /docs/
 * 
 * This fixes the issue where MDX files contain links like /gateway/configuration
 * but the actual route is /docs/gateway/configuration, causing 404s.
 * 
 * The plugin:
 * - Only processes <a> tags with href attributes
 * - Only modifies absolute internal links (starting with /)
 * - Excludes links that already start with /docs/, /blog/, or other known non-docs routes
 * - Excludes external links (http://, https://)
 * - Excludes anchor links (starting with #)
 */
export default function rehypeDocsLinks() {
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

        // Add /docs/ prefix to internal links
        node.properties.href = `/docs${href}`;
      }
    });
  };
}
