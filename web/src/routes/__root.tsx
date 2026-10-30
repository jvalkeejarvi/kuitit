import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet, redirect } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getMeOptions } from '@/api/client/@tanstack/react-query.gen';
import { loginUrl } from '@/api/setup';
import { Header } from '@/components/Header';

const searchSchema = z.object({ authError: z.string().optional() });

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  validateSearch: searchSchema,
  beforeLoad: async ({ context, search, location }) => {
    // A denied login must not redirect again, or the IdP's SSO session would loop straight back here.
    if (search.authError) return { me: null };
    try {
      const me = await context.queryClient.ensureQueryData({ ...getMeOptions(), retry: false });
      return { me };
    } catch {
      throw redirect({ href: loginUrl(location.href), reloadDocument: true });
    }
  },
  component: RootLayout,
  errorComponent: RootError,
});

function RootLayout() {
  const { me } = Route.useRouteContext();
  return (
    <div className="min-h-dvh">
      <Header email={me?.email} />
      <main className="mx-auto max-w-5xl px-4 py-6">{me ? <Outlet /> : <AccessDenied />}</main>
    </div>
  );
}

function AccessDenied() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-semibold">{t('auth.deniedTitle')}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">{t('auth.deniedBody')}</p>
      <a href="/auth/login?prompt=login" className="mt-4 inline-block text-brand underline dark:text-teal-400">
        {t('auth.signInAgain')}
      </a>
    </div>
  );
}

function RootError({ reset }: { reset: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="p-6 text-center">
      <p>{t('app.error')}</p>
      <button type="button" onClick={reset} className="mt-2 underline">
        {t('app.retry')}
      </button>
    </div>
  );
}
