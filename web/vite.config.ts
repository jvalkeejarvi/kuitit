import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Set by the Aspire AppHost. The browser only ever talks to Vite, so auth cookies and the OIDC callback share
// one origin. The Host header is passed through so the API builds its redirect URI against this server.
const apiUrl = process.env.API_URL ?? 'http://localhost:5099';
const proxied = ['/api', '/auth', '/signin-oidc', '/signout-callback-oidc', '/healthz'];

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: Number(process.env.PORT ?? 5173),
    strictPort: true,
    proxy: Object.fromEntries(proxied.map(path => [path, { target: apiUrl, changeOrigin: false, xfwd: true }])),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
