import { defineConfig } from '@hey-api/openapi-ts';

// openapi.json is written by the API build (Microsoft.Extensions.ApiDescription.Server).
export default defineConfig({
  input: './openapi.json',
  output: { path: 'src/api/client', entryFile: true },
  plugins: [
    { name: '@hey-api/typescript', enums: 'javascript' },
    { name: '@hey-api/client-fetch', baseUrl: false },
    '@hey-api/sdk',
    { name: '@tanstack/react-query', mutationKeys: true },
  ],
});
