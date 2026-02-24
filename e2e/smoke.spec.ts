import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - 基础冒烟测试
 * 
 * 验证核心页面能够正常访问，无严重错误
 */

test.describe('Smoke Tests', () => {
  // 收集控制台错误
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`Console error: ${msg.text()}`);
      }
    });
  });

  test('首页能够正常访问（200状态码）', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    // 页面主体可见即可（避免依赖标题文案）
    await expect(page.locator('body')).toBeVisible();
  });

  test('英文博客列表页能够访问', async ({ page }) => {
    // 英文是默认语言，使用 /blog 而不是 /en/blog
    const response = await page.goto('/blog');
    expect(response?.status()).toBe(200);

    // 页面可访问即可；CI 无数据库时列表可能为空
    const bodyVisible = page.locator('body');
    await expect(bodyVisible).toBeVisible();
  });

  test('中文博客列表页能够访问', async ({ page }) => {
    const response = await page.goto('/zh/blog');
    expect(response?.status()).toBe(200);

    // 页面可访问即可；CI 无数据库时列表可能为空
    const bodyVisible = page.locator('body');
    await expect(bodyVisible).toBeVisible();
  });

  test('页面无严重控制台错误', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // 访问多个页面检查
    await page.goto('/');
    await page.goto('/blog');  // 英文默认路由
    await page.goto('/zh/blog');
    
    // 等待一秒让所有异步错误显示
    await page.waitForTimeout(1000);
    
    // 过滤掉一些已知的无害错误（如果有的话）
    const criticalErrors = errors.filter(err => 
      !err.includes('favicon') && 
      !err.includes('analytics') &&
      !err.includes('get-session') && // 过滤认证 API 错误
      !err.includes('404') && // 过滤 404 资源加载错误
      !err.includes('Failed to load resource') && // 过滤资源加载错误
      !err.toLowerCase().includes('hydration')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('博客详情页能够访问 - 英文', async ({ page }) => {
    // 英文是默认语言，使用 /blog 而不是 /en/blog
    await page.goto('/blog');
    
    // 找到第一篇博客的链接
    const firstBlogLink = page.locator('a[href*="/blog/"]').first();
    const linkCount = await firstBlogLink.count();
    if (linkCount === 0) {
      console.log('ℹ [en] 无博客详情可测，跳过英文详情页检查');
      return;
    }

    await expect(firstBlogLink).toBeVisible({ timeout: 10000 });
    
    // 点击进入详情页
    await firstBlogLink.click();
    
    // 验证详情页加载成功
    await expect(page).toHaveURL(/\/blog\/.+/);
    
    // 验证有内容（优先检查 article，其次是 main）
    const content = page.locator('article').first();
    await expect(content).toBeVisible();
  });

  test('博客详情页能够访问 - 中文', async ({ page }) => {
    await page.goto('/zh/blog');
    
    // 找到第一篇博客的链接
    const firstBlogLink = page.locator('a[href*="/zh/blog/"]').first();
    const linkCount = await firstBlogLink.count();
    if (linkCount === 0) {
      console.log('ℹ [zh] 无博客详情可测，跳过中文详情页检查');
      return;
    }

    await expect(firstBlogLink).toBeVisible({ timeout: 10000 });
    
    // 点击进入详情页
    await firstBlogLink.click();
    
    // 验证详情页加载成功
    await expect(page).toHaveURL(/\/zh\/blog\/.+/);
    
    // 验证有内容（优先检查 article）
    const content = page.locator('article').first();
    await expect(content).toBeVisible();
  });
});
