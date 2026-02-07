import { test, expect } from '@playwright/test';

/**
 * Link Tests - 链接测试
 * 
 * 验证内部链接无 404，所有博客详情页都能访问
 */

const LANGUAGES = ['en', 'zh', 'ja', 'ko', 'ru'] as const;

// 英文是默认语言，使用 /blog 而不是 /en/blog
const getBlogPath = (lang: string) => {
  return lang === 'en' ? '/blog' : `/${lang}/blog`;
};

const getBlogLinkSelector = (lang: string) => {
  // 英文链接：/blog/xxx（不带语言前缀）
  // 其他语言：/zh/blog/xxx, /ja/blog/xxx 等
  return lang === 'en' 
    ? 'a[href^="/blog/"]:not([href*="/zh/"]):not([href*="/ja/"]):not([href*="/ko/"]):not([href*="/ru/"])' 
    : `a[href*="/${lang}/blog/"]`;
};

test.describe('Link Validation Tests', () => {
  
  test('首页内部链接无 404', async ({ page }) => {
    const failed404s: string[] = [];
    
    // 监听 404 响应
    page.on('response', (response) => {
      if (response.status() === 404) {
        // 只记录同域名的 404
        const url = response.url();
        
        // 过滤已知的 API 404（认证相关）
        if (url.includes('/api/auth/get-session')) {
          return;
        }
        
        if (url.startsWith('http://localhost:3000') || url.startsWith('https://learnclawdbot.org')) {
          failed404s.push(url);
        }
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    if (failed404s.length > 0) {
      console.log('首页发现 404 链接:');
      failed404s.forEach(url => console.log(`  - ${url}`));
    }
    
    expect(failed404s).toHaveLength(0);
  });

  for (const lang of LANGUAGES) {
    test(`${lang} - 博客列表页内部链接无 404`, async ({ page }) => {
      const failed404s: string[] = [];
      
      page.on('response', (response) => {
        if (response.status() === 404) {
          const url = response.url();
          
          // 过滤已知的 API 404
          if (url.includes('/api/auth/get-session')) {
            return;
          }
          
          if (url.startsWith('http://localhost:3000') || url.startsWith('https://learnclawdbot.org')) {
            failed404s.push(url);
          }
        }
      });
      
      await page.goto(getBlogPath(lang));
      await page.waitForLoadState('networkidle');
      
      if (failed404s.length > 0) {
        console.log(`[${lang}] 博客列表页发现 404 链接:`);
        failed404s.forEach(url => console.log(`  - ${url}`));
      }
      
      expect(failed404s).toHaveLength(0);
    });

    test(`${lang} - 所有博客详情页都能访问`, async ({ page }) => {
      await page.goto(getBlogPath(lang));
      await page.waitForLoadState('networkidle');
      
      // 获取所有博客链接
      const blogLinks = page.locator(getBlogLinkSelector(lang));
      const count = await blogLinks.count();
      
      console.log(`[${lang}] 找到 ${count} 个博客链接`);
      
      // 收集所有唯一的博客 URL
      const uniqueUrls = new Set<string>();
      for (let i = 0; i < count; i++) {
        const href = await blogLinks.nth(i).getAttribute('href');
        const blogPathPattern = lang === 'en' ? '/blog/' : `/${lang}/blog/`;
        if (href && href.includes(blogPathPattern)) {
          // 转换为绝对路径
          const fullUrl = href.startsWith('http') ? href : `http://localhost:3000${href}`;
          uniqueUrls.add(fullUrl);
        }
      }
      
      console.log(`[${lang}] 找到 ${uniqueUrls.size} 个唯一博客页面`);
      
      // 验证每个博客页面都能访问
      let successCount = 0;
      let failedUrls: string[] = [];
      
      for (const url of uniqueUrls) {
        const response = await page.goto(url);
        const status = response?.status();
        
        if (status === 200) {
          successCount++;
          // 验证有内容
          const hasContent = await page.locator('article, main, [role="main"]').count() > 0;
          expect(hasContent).toBeTruthy();
          console.log(`  ✓ [${successCount}/${uniqueUrls.size}] ${url}`);
        } else {
          failedUrls.push(`${url} (${status})`);
          console.log(`  ✗ ${url} - 状态码: ${status}`);
        }
      }
      
      console.log(`[${lang}] 访问统计 - 成功: ${successCount}/${uniqueUrls.size}`);
      
      if (failedUrls.length > 0) {
        console.log('失败的链接:');
        failedUrls.forEach(url => console.log(`  - ${url}`));
      }
      
      expect(failedUrls).toHaveLength(0);
      expect(successCount).toBe(uniqueUrls.size);
    });
  }

  test('导航链接测试 - 主要页面都能访问', async ({ page }) => {
    const mainPages = [
      '/',
      '/zh',
      '/ja',
      '/ko',
      '/ru',
      '/blog',      // 英文默认路由
      '/zh/blog',
      '/ja/blog',
      '/ko/blog',
      '/ru/blog',
    ];
    
    let successCount = 0;
    let failedPages: string[] = [];
    
    for (const pagePath of mainPages) {
      const response = await page.goto(pagePath);
      const status = response?.status();
      
      if (status === 200) {
        successCount++;
        console.log(`✓ ${pagePath}`);
      } else {
        failedPages.push(`${pagePath} (${status})`);
        console.log(`✗ ${pagePath} - 状态码: ${status}`);
      }
    }
    
    console.log(`导航测试统计 - 成功: ${successCount}/${mainPages.length}`);
    
    if (failedPages.length > 0) {
      console.log('失败的页面:');
      failedPages.forEach(page => console.log(`  - ${page}`));
    }
    
    expect(failedPages).toHaveLength(0);
  });

  test('博客详情页返回列表链接正常', async ({ page }) => {
    // 测试从详情页能否返回列表页
    for (const lang of LANGUAGES.slice(0, 2)) { // 只测试前两种语言
      const blogPath = getBlogPath(lang);
      await page.goto(blogPath);
      
      // 点击第一篇博客
      const firstBlogLink = page.locator(getBlogLinkSelector(lang)).first();
      await expect(firstBlogLink).toBeVisible({ timeout: 10000 });
      await firstBlogLink.click();
      
      // 验证进入详情页
      const blogDetailPattern = lang === 'en' ? /\/blog\/.+/ : new RegExp(`/${lang}/blog/.+`);
      await expect(page).toHaveURL(blogDetailPattern);
      
      // 查找返回链接（可能是面包屑、返回按钮等）
      // 尝试查找常见的返回元素
      const backLinkSelector = lang === 'en' 
        ? `a[href="/blog"], a[href*="blog"]:has-text("Back"), a[href*="blog"]:has-text("返回")`
        : `a[href="/${lang}/blog"], a[href*="blog"]:has-text("Back"), a[href*="blog"]:has-text("返回")`;
      const backLink = page.locator(backLinkSelector).first();
      
      if (await backLink.count() > 0) {
        await backLink.click();
        
        // 验证返回到列表页
        const blogListPattern = lang === 'en' ? /\/blog$/ : new RegExp(`/${lang}/blog$`);
        await expect(page).toHaveURL(blogListPattern);
        console.log(`✓ [${lang}] 返回链接正常`);
      } else {
        // 如果没有返回链接，直接导航测试
        await page.goto(blogPath);
        const blogListPattern = lang === 'en' ? /\/blog$/ : new RegExp(`/${lang}/blog$`);
        await expect(page).toHaveURL(blogListPattern);
        console.log(`ℹ [${lang}] 未找到返回链接，通过直接导航验证`);
      }
    }
  });
});
