import './index.css';
import './i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { configureApiClient } from './api/setup';
import { reloadOnStaleChunks } from './lib/staleChunks';
import { routeTree } from './routeTree.gen';

configureApiClient();
reloadOnStaleChunks();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: false }, mutations: { retry: false } },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
