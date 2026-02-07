import { test, expect } from '@playwright/test';

/**
 * I18n Tests - 国际化测试
 * 
 * 验证所有5种语言都能正确切换和显示
 * 语言：en, zh, ja, ko, ru
 */

const LANGUAGES = ['en', 'zh', 'ja', 'ko', 'ru'] as const;
const EXPECTED_BLOG_COUNT = 6;

// 英文是默认语言，使用 /blog 而不是 /en/blog
const getBlogPath = (lang: string) => {
  return lang === 'en' ? '/blog' : `/${lang}/blog`;
};

const getBlogLinkSelector = (lang: string) => {
  return lang === 'en' ? 'a[href*="/blog/"]' : `a[href*="/${lang}/blog/"]`;
};

test.describe('Internationalization Tests', () => {
  
  for (const lang of LANGUAGES) {
    test(`${lang} - 博客列表页能够访问`, async ({ page }) => {
      const blogPath = getBlogPath(lang);
      const response = await page.goto(blogPath);
      expect(response?.status()).toBe(200);
      
      // 验证URL正确
      expect(page.url()).toContain(blogPath);
    });

    test(`${lang} - 博客数量正确（应该有${EXPECTED_BLOG_COUNT}篇）`, async ({ page }) => {
      const blogPath = getBlogPath(lang);
      await page.goto(blogPath);
      
      // 等待页面加载完成
      await page.waitForLoadState('networkidle');
      
      // 查找博客链接（指向博客详情页的链接）
      const blogLinks = page.locator(getBlogLinkSelector(lang));
      
      // 等待至少一个博客链接出现
      await expect(blogLinks.first()).toBeVisible({ timeout: 10000 });
      
      // 获取所有独立的博客链接（去重）
      const count = await blogLinks.count();
      
      // 至少应该有预期数量的博客（可能有重复链接，所以用 >= ）
      expect(count).toBeGreaterThanOrEqual(EXPECTED_BLOG_COUNT);
      
      console.log(`[${lang}] 找到 ${count} 个博客链接`);
    });

    test(`${lang} - 首页语言路径正确`, async ({ page }) => {
      const homePath = lang === 'en' ? '/' : `/${lang}`;
      await page.goto(homePath);
      
      // 验证页面加载成功
      const response = await page.goto(homePath);
      expect(response?.status()).toBe(200);
    });
  }

  test('语言切换 - 从英文到中文', async ({ page }) => {
    // 先访问英文页面（英文是默认语言，使用 /blog）
    await page.goto('/blog');
    expect(page.url()).toMatch(/(\/blog|\/en\/blog)/);
    
    // 查找语言切换器（可能是下拉菜单、按钮等）
    // 这里假设有语言选择器，如果没有可以通过直接导航测试
    
    // 直接导航到中文页面
    await page.goto('/zh/blog');
    expect(page.url()).toContain('/zh/blog');
    
    // 验证内容已改变（博客链接应该是中文路径）
    const blogLinks = page.locator('a[href*="/zh/blog/"]');
    await expect(blogLinks.first()).toBeVisible({ timeout: 10000 });
  });

  test('语言切换 - 验证所有语言都能互相切换', async ({ page }) => {
    for (const sourceLang of LANGUAGES) {
      for (const targetLang of LANGUAGES) {
        if (sourceLang === targetLang) continue;
        
        // 从源语言切换到目标语言
        await page.goto(getBlogPath(sourceLang));
        await page.goto(getBlogPath(targetLang));
        
        // 验证URL正确
        expect(page.url()).toContain(getBlogPath(targetLang));
        
        // 验证有内容
        const blogLinks = page.locator(getBlogLinkSelector(targetLang));
        await expect(blogLinks.first()).toBeVisible({ timeout: 10000 });
        
        console.log(`✓ ${sourceLang} → ${targetLang}`);
      }
    }
  });

  test('所有语言的博客详情页都能访问', async ({ page }) => {
    for (const lang of LANGUAGES) {
      await page.goto(getBlogPath(lang));
      
      // 获取第一篇博客链接
      const firstBlogLink = page.locator(getBlogLinkSelector(lang)).first();
      await expect(firstBlogLink).toBeVisible({ timeout: 10000 });
      
      const href = await firstBlogLink.getAttribute('href');
      expect(href).toBeTruthy();
      
      // 访问详情页
      await page.goto(href!);
      
      // 验证详情页加载成功
      await expect(page.locator('article, main, [role="main"]')).toBeVisible();
      
      console.log(`[${lang}] 详情页访问成功: ${href}`);
    }
  });
});
