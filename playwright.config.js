import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  workers: 1,
  reporter: 'list',
  use: {baseURL:'http://localhost:5188', channel:'chrome', headless:true, trace:'retain-on-failure'},
  webServer: {
    command: 'node scripts/dev.mjs --demo',
    url: 'http://localhost:5188/api/health',
    timeout: 120000,
    reuseExistingServer: false,
    env: {VITRA_API_PORT:'8018', VITRA_WEB_PORT:'5188'},
  },
});
