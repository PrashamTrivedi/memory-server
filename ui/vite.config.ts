import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist/ui',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    allowedHosts: ['localhost-memory-ui.prashamhtrivedi.app'],
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/skills': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
