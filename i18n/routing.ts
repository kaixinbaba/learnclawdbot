import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

export const LOCALES = ['en', 'zh', 'ja', 'ko', 'ru']
// Locales shown in the language switcher UI (site-wide, excludes docs-only locales)
export const UI_LOCALES = ['en', 'zh', 'ja']
export const DEFAULT_LOCALE = 'en'
export const LOCALE_NAMES: Record<string, string> = {
  'en': "English",
  'zh': "中文",
  'ja': "日本語",
  'ko': "한국어",
  'ru': "Русский",
};
export const LOCALE_TO_HREFLANG: Record<string, string> = {
  'en': 'en-US',
  'zh': 'zh-CN',
  'ja': 'ja-JP',
  'ko': 'ko-KR',
  'ru': 'ru-RU',
};

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localeDetection: process.env.NEXT_PUBLIC_LOCALE_DETECTION && process.env.NEXT_PUBLIC_LOCALE_DETECTION === 'true' || false,

  localePrefix: 'as-needed',
});

export const {
  Link,
  redirect,
  usePathname,
  useRouter,
  getPathname,
} = createNavigation(routing);


export type Locale = (typeof routing.locales)[number];
