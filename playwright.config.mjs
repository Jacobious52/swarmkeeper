import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 150000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    // CI renders WebGL on the CPU. Keep the real renderer enabled at a modest viewport.
    viewport: { width: 960, height: 640 },
    deviceScaleFactor: 0.5,
    launchOptions: {
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    env: { PORT: "4174" },
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
  },
});
