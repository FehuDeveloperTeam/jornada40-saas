import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Pruebas unitarias del frontend (lógica y componentes) y de la extensión para
// Mi DT (extension/src). Los recorridos completos contra el backend son las
// pruebas e2e de Playwright (e2e/).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'extension/src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    // npm run test:cobertura. Mide solo lo que ejecutan estas pruebas: las
    // pantallas se cubren sobre todo con los recorridos de Playwright.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'extension/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', 'src/main.tsx', 'src/vite-env.d.ts', 'src/types/**', 'extension/src/panel/main.tsx'],
      reporter: ['text-summary', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      // Mínimos para la lógica que cubren estas pruebas (medido el 11-10-2026:
      // utilidades 83 %, lógica de la extensión 86 %).
      thresholds: {
        'src/utils/**': { lines: 75 },
        'extension/src/*.ts': { lines: 80 },
      },
    },
  },
});
