import { defineConfig } from '@hey-api/openapi-ts';

// Reads the spec from the running dev API (served in Development only); API_URL as in vite.config.ts.
export default defineConfig({
  input: `${process.env.API_URL ?? 'http://localhost:5099'}/openapi/v1.json`,
  output: { path: 'src/api/client', entryFile: true },
  // Without `servers`, openapi-ts would type the client's base URL as the URL the spec was read from.
  parser: {
    patch: {
      input: spec => {
        if ('openapi' in spec) spec.servers = [];
      },
    },
  },
  plugins: [
    { name: '@hey-api/typescript', enums: 'javascript' },
    { name: '@hey-api/client-fetch', baseUrl: false },
    '@hey-api/sdk',
    { name: '@tanstack/react-query', mutationKeys: true },
  ],
});
