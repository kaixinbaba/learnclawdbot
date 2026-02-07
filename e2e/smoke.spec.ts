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
    
    // 验证页面标题存在
    await expect(page).toHaveTitle(/.*learnclawdbot.*/i);
  });

  test('英文博客列表页能够访问', async ({ page }) => {
    const response = await page.goto('/en/blog');
    expect(response?.status()).toBe(200);
    
    // 验证博客列表有内容
    const blogItems = page.locator('article, [data-testid="blog-item"], a[href*="/blog/"]');
    await expect(blogItems.first()).toBeVisible({ timeout: 10000 });
  });

  test('中文博客列表页能够访问', async ({ page }) => {
    const response = await page.goto('/zh/blog');
    expect(response?.status()).toBe(200);
    
    // 验证博客列表有内容
    const blogItems = page.locator('article, [data-testid="blog-item"], a[href*="/blog/"]');
    await expect(blogItems.first()).toBeVisible({ timeout: 10000 });
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
    await page.goto('/en/blog');
    await page.goto('/zh/blog');
    
    // 等待一秒让所有异步错误显示
    await page.waitForTimeout(1000);
    
    // 过滤掉一些已知的无害错误（如果有的话）
    const criticalErrors = errors.filter(err => 
      !err.includes('favicon') && 
      !err.includes('analytics') &&
      !err.includes('get-session') && // 过滤认证 API 错误
      !err.toLowerCase().includes('hydration')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('博客详情页能够访问 - 英文', async ({ page }) => {
    await page.goto('/en/blog');
    
    // 找到第一篇博客的链接
    const firstBlogLink = page.locator('a[href*="/en/blog/"]').first();
    await expect(firstBlogLink).toBeVisible({ timeout: 10000 });
    
    // 点击进入详情页
    await firstBlogLink.click();
    
    // 验证详情页加载成功
    await expect(page).toHaveURL(/\/en\/blog\/.+/);
    
    // 验证有内容（文章标题或内容）
    const content = page.locator('article, main, [role="main"]');
    await expect(content).toBeVisible();
  });

  test('博客详情页能够访问 - 中文', async ({ page }) => {
    await page.goto('/zh/blog');
    
    // 找到第一篇博客的链接
    const firstBlogLink = page.locator('a[href*="/zh/blog/"]').first();
    await expect(firstBlogLink).toBeVisible({ timeout: 10000 });
    
    // 点击进入详情页
    await firstBlogLink.click();
    
    // 验证详情页加载成功
    await expect(page).toHaveURL(/\/zh\/blog\/.+/);
    
    // 验证有内容
    const content = page.locator('article, main, [role="main"]');
    await expect(content).toBeVisible();
  });
});
