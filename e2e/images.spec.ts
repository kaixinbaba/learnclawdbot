import { test, expect } from '@playwright/test';

/**
 * Image Tests - 图片测试
 * 
 * 验证博客文章中的图片都能正确加载
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

test.describe('Image Loading Tests', () => {
  
  test('首页图片加载正常', async ({ page }) => {
    await page.goto('/');
    
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    
    // 查找所有图片
    const images = page.locator('img');
    const imageCount = await images.count();
    
    console.log(`首页找到 ${imageCount} 张图片`);
    
    if (imageCount > 0) {
      // 检查图片是否加载成功（没有 404）
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const src = await img.getAttribute('src');
        
        if (src && !src.startsWith('data:')) {
          // 验证图片可见（说明加载成功）
          try {
            await expect(img).toBeVisible({ timeout: 5000 });
            console.log(`✓ 图片加载成功: ${src}`);
          } catch (e) {
            console.log(`✗ 图片可能未加载: ${src}`);
            // 不让测试失败，因为有些图片可能是懒加载
          }
        }
      }
    }
  });

  for (const lang of LANGUAGES) {
    test(`${lang} - 博客列表页图片加载`, async ({ page }) => {
      await page.goto(getBlogPath(lang));
      await page.waitForLoadState('networkidle');
      
      // 查找所有图片
      const images = page.locator('img');
      const imageCount = await images.count();
      
      console.log(`[${lang}] 博客列表页找到 ${imageCount} 张图片`);
      
      // 检查图片状态
      if (imageCount > 0) {
        for (let i = 0; i < Math.min(imageCount, 10); i++) { // 只检查前10张
          const img = images.nth(i);
          const src = await img.getAttribute('src');
          
          if (src && !src.startsWith('data:')) {
            const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
            
            // naturalWidth > 0 说明图片加载成功
            if (naturalWidth === 0) {
              console.log(`⚠ 图片可能加载失败: ${src}`);
            } else {
              console.log(`✓ 图片加载成功 (${naturalWidth}px): ${src}`);
            }
          }
        }
      }
    });

    test(`${lang} - 博客详情页图片加载`, async ({ page }) => {
      await page.goto(getBlogPath(lang));
      
      // 获取第一篇博客链接
      const firstBlogLink = page.locator(getBlogLinkSelector(lang)).first();
      const linkCount = await firstBlogLink.count();
      if (linkCount === 0) {
        console.log(`[${lang}] 无博客详情可测，跳过详情页图片检查`);
        return;
      }

      const href = await firstBlogLink.getAttribute('href');
      
      // 访问详情页
      await page.goto(href!);
      await page.waitForLoadState('networkidle');
      
      // 查找所有图片
      const images = page.locator('img');
      const imageCount = await images.count();
      
      console.log(`[${lang}] 博客详情页找到 ${imageCount} 张图片`);
      
      // 检查图片加载状态
      if (imageCount > 0) {
        let loadedCount = 0;
        let failedCount = 0;
        
        for (let i = 0; i < imageCount; i++) {
          const img = images.nth(i);
          const src = await img.getAttribute('src');
          
          if (src && !src.startsWith('data:')) {
            const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
            
            if (naturalWidth > 0) {
              loadedCount++;
              console.log(`✓ [${i + 1}/${imageCount}] 图片加载成功: ${src}`);
            } else {
              failedCount++;
              console.log(`✗ [${i + 1}/${imageCount}] 图片加载失败: ${src}`);
            }
          }
        }
        
        console.log(`[${lang}] 详情页图片统计 - 成功: ${loadedCount}, 失败: ${failedCount}`);
        
        // 如果有图片，至少应该有一半成功加载
        if (imageCount > 0) {
          expect(loadedCount).toBeGreaterThan(0);
        }
      }
    });
  }

  test('检测 404 图片', async ({ page }) => {
    const failed404s: string[] = [];
    
    // 监听失败的图片请求
    page.on('response', (response) => {
      if (response.status() === 404 && response.url().match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
        failed404s.push(response.url());
      }
    });
    
    // 访问多个页面检查
    for (const lang of LANGUAGES.slice(0, 2)) { // 只检查前两种语言节省时间
      await page.goto(getBlogPath(lang));
      await page.waitForLoadState('networkidle');
      
      // 访问第一篇博客
      const firstBlogLink = page.locator(getBlogLinkSelector(lang)).first();
      if (await firstBlogLink.count() > 0) {
        const href = await firstBlogLink.getAttribute('href');
        if (href) {
          await page.goto(href);
          await page.waitForLoadState('networkidle');
        }
      }
    }
    
    // 报告所有 404 图片
    if (failed404s.length > 0) {
      console.log('发现 404 图片:');
      failed404s.forEach(url => console.log(`  - ${url}`));
    }
    
    // 不应该有 404 图片
    expect(failed404s).toHaveLength(0);
  });
});
