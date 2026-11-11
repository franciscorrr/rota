import { defineConfig } from '@playwright/test';

// Browser tests (Chromium). By default against the Vite development server;
// with E2E_BUILD=1 they build the project and test `dist/` served by `vite preview`.
const PORT = 8080;
const useBuild = Boolean(process.env.E2E_BUILD);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: useBuild
      ? `npm run build && npx vite preview --port ${PORT} --strictPort`
      : `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
