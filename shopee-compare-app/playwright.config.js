import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const frontendDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(frontendDirectory, '..');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      name: 'Luna test API',
      command: 'uv run --frozen uvicorn tests.e2e_app:app --host 127.0.0.1 --port 18000',
      cwd: path.join(repositoryRoot, 'services/luna-api'),
      env: {
        ...process.env,
        PYTHONPATH: '../..',
        UV_CACHE_DIR: '/tmp/decodex-uv-cache',
      },
      url: 'http://127.0.0.1:18000/api/health',
      timeout: 120_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
    {
      name: 'Host A',
      command: 'npm run dev -- --host 127.0.0.1 --port 15173',
      cwd: frontendDirectory,
      env: {
        ...process.env,
        LUNA_API_PROXY_TARGET: 'http://127.0.0.1:18000',
      },
      url: 'http://127.0.0.1:15173',
      timeout: 120_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
    {
      name: 'Host B',
      command: 'npm run dev -- --host 127.0.0.1 --port 15174',
      cwd: path.join(repositoryRoot, 'apps/minimal-host'),
      env: {
        ...process.env,
        LUNA_API_PROXY_TARGET: 'http://127.0.0.1:18000',
      },
      url: 'http://127.0.0.1:15174',
      timeout: 120_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
  ],
  projects: [
    {
      name: 'host-a-chromium',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:15173' },
    },
    {
      name: 'host-b-chromium',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:15174' },
    },
  ],
});
