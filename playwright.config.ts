import { defineConfig } from "@playwright/test";

const PORT = 5182;

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 360, height: 780 } },
  webServer: { command: `pnpm build && pnpm exec vite preview --config static-demo/vite.config.ts --port ${PORT}`, url: `http://localhost:${PORT}/`, reuseExistingServer: false, timeout: 180_000 },
});
