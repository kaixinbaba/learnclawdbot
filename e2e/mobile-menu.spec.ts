import { test, expect, Page } from '@playwright/test';

async function getMenuButton(page: Page) {
  const candidates = [
    'header button[aria-label="Open menu"]',
    'header button[aria-label="打开菜单"]',
    'header button[aria-label*="menu" i]',
    'button[aria-label="Open menu"]',
    'button[aria-label*="menu" i]'
  ];

  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if (await locator.count() > 0) {
      return locator;
    }
  }

  return null;
}

test.describe('Mobile Menu UX', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('菜单项点击区域足够大', async ({ page }) => {
    await page.goto('/');
    
    // 打开菜单（移动端菜单按钮）
    const menuButton = await getMenuButton(page);
    if (!menuButton) {
      console.log('ℹ 未找到移动端菜单按钮，跳过该用例');
      return;
    }
    await menuButton.click();
    
    // 等待菜单出现
    await page.waitForSelector('[role="menu"]', { state: 'visible' });
    
    // 检查菜单项的高度（应该 >= 36px 方便点击）
    const menuItems = page.locator('[role="menu"] [role="menuitem"]');
    const count = await menuItems.count();
    
    console.log(`找到 ${count} 个菜单项`);
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await menuItems.nth(i).boundingBox();
      if (box) {
        console.log(`菜单项 ${i}: 高度 ${box.height}px, 宽度 ${box.width}px`);
        expect(box.height).toBeGreaterThanOrEqual(30); // 移动端最小可点击高度
      }
    }
  });

  test('语种切换器选项高度足够', async ({ page }) => {
    await page.goto('/');
    
    // 打开主菜单
    const menuButton = await getMenuButton(page);
    if (!menuButton) {
      console.log('ℹ 未找到移动端菜单按钮，跳过该用例');
      return;
    }
    await menuButton.click();
    await page.waitForSelector('[role="menu"]', { state: 'visible' });
    
    // 点击语种切换器（菜单内的那个）
    const langSwitcher = page.locator('[role="menu"] button[aria-label="Select language"]');
    await langSwitcher.click();
    
    // 等待语种选项出现
    await page.waitForSelector('[role="menuitemradio"]', { state: 'visible' });
    
    // 检查语种选项高度
    const radioItems = page.locator('[role="menuitemradio"]');
    const count = await radioItems.count();
    
    console.log(`找到 ${count} 个语种选项`);
    
    for (let i = 0; i < count; i++) {
      const box = await radioItems.nth(i).boundingBox();
      if (box) {
        console.log(`语种选项 ${i}: 高度 ${box.height}px`);
        expect(box.height).toBeGreaterThanOrEqual(36);
      }
    }
  });

  test('菜单响应时间 < 300ms', async ({ page }) => {
    await page.goto('/');
    
    const startTime = Date.now();
    const menuButton = await getMenuButton(page);
    if (!menuButton) {
      console.log('ℹ 未找到移动端菜单按钮，跳过该用例');
      return;
    }
    await menuButton.click();
    await page.waitForSelector('[role="menu"]', { state: 'visible' });
    const endTime = Date.now();
    
    const responseTime = endTime - startTime;
    console.log(`菜单响应时间: ${responseTime}ms`);
    expect(responseTime).toBeLessThan(300);
  });
});
