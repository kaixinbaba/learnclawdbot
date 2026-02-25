import { defineConfig, devices } from '@playwright/test';

/**
 * E2E Testing Configuration for learnclawdbot.org
 * 
 * This tests:
 * - Page loading (smoke tests)
 * - Internationalization (i18n)
 * - Image loading
 * - Link validation
 */
const E2E_PORT = Number(process.env.E2E_PORT || 3000);
const E2E_BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: './e2e',
  
  // Maximum time one test can run for
  timeout: 30 * 1000,
  
  expect: {
    // Maximum time expect() should wait for the condition to be met
    timeout: 5000
  },
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: process.env.CI 
    ? [['html'], ['list'], ['github']]
    : [['html'], ['list']],
  
  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: E2E_BASE_URL,
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: `pnpm run build && PORT=${E2E_PORT} pnpm run start`,
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
