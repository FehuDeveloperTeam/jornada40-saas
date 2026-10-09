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
  },
});
