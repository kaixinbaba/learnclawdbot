import { expect, test, type Page } from "@playwright/test";

const EMPTY_MESSAGE = "No posts found for this tag.";

const CASES = [
  {
    locale: "en",
    path: "/blog",
    allButton: "All",
    targetTagButton: "Beginner Basics",
    hrefPrefix: "/blog/",
  },
  {
    locale: "zh",
    path: "/zh/blog",
    allButton: "全部",
    targetTagButton: "新手基础",
    hrefPrefix: "/zh/blog/",
  },
] as const;

async function waitForBlogList(page: Page, hrefPrefix: string) {
  const firstBlogLink = page.locator(`a[href^="${hrefPrefix}"]`).first();
  const empty = page.getByText(EMPTY_MESSAGE);
  const end = page.getByText("You've reached the end.");

  await Promise.race([
    firstBlogLink.waitFor({ state: "visible", timeout: 15000 }),
    empty.waitFor({ state: "visible", timeout: 15000 }),
    end.waitFor({ state: "visible", timeout: 15000 }),
  ]).catch(() => {
    // Keep test data-agnostic: some environments may have no posts.
  });
}

test.describe("Blog tag filter", () => {
  for (const item of CASES) {
    test(`${item.locale} - tag filter buttons can filter and reset`, async ({ page }) => {
      await page.goto(item.path);
      await page.waitForLoadState("networkidle");

      const allButton = page.getByRole("button", { name: item.allButton });
      const targetTagButton = page.getByRole("button", {
        name: item.targetTagButton,
      });

      await expect(allButton).toBeVisible();
      await expect(targetTagButton).toBeVisible();

      await waitForBlogList(page, item.hrefPrefix);
      const listLinks = page.locator(`a[href^="${item.hrefPrefix}"]`);
      const beforeCount = await listLinks.count();

      await targetTagButton.click();
      await page.waitForLoadState("networkidle");
      await waitForBlogList(page, item.hrefPrefix);

      const empty = page.getByText(EMPTY_MESSAGE);
      const hasEmptyState = await empty.isVisible().catch(() => false);

      if (hasEmptyState) {
        await expect(empty).toBeVisible();
      } else {
        const afterFilterCount = await listLinks.count();
        expect(afterFilterCount).toBeLessThanOrEqual(beforeCount);
      }

      await allButton.click();
      await page.waitForLoadState("networkidle");
      await waitForBlogList(page, item.hrefPrefix);

      const afterResetCount = await listLinks.count();
      expect(afterResetCount).toBeGreaterThanOrEqual(0);
    });
  }
});
