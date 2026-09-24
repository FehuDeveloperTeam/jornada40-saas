import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de navegador de extremo a extremo. Levantan el backend con
 * config.settings_e2e (base SQLite propia, sin servicios externos) y el
 * frontend de desarrollo, que llega al backend por el proxy de Vite.
 *
 *   npm run e2e
 *
 * Los recorridos comparten la base y la restauran al empezar (preparar_e2e --reset),
 * por eso corren en serie.
 */
const python = process.env.PYTHON ?? 'python';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: [
    {
      command: `${python} manage.py preparar_e2e && ${python} manage.py runserver 127.0.0.1:8000 --noreload`,
      cwd: '../backend',
      env: { DJANGO_SETTINGS_MODULE: 'config.settings_e2e' },
      url: 'http://127.0.0.1:8000/api/planes/',
      timeout: 180_000,
      // El log de cada solicitud tapa el resultado en local; en CI se deja para diagnosticar.
      stderr: process.env.CI ? 'pipe' : 'ignore',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx vite --port 5173 --strictPort',
      url: 'http://localhost:5173',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
