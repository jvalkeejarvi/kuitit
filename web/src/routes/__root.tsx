import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet, redirect } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getMeOptions } from '@/api/client/@tanstack/react-query.gen';
import { loginUrl } from '@/api/setup';
import { Header } from '@/components/Header';
import { ToastProvider } from '@/components/Toaster';

const searchSchema = z.object({ authError: z.string().optional(), signedOut: z.boolean().optional() });

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  validateSearch: searchSchema,
  beforeLoad: async ({ context, search, location }) => {
    // A denied login must not redirect again, or the IdP's SSO session would loop straight back here.
    if (search.authError) return { me: null };
    try {
      const me = await context.queryClient.ensureQueryData({ ...getMeOptions(), retry: false });
      return { me };
    } catch {
      // Right after logout: show a sign-in button instead of bouncing to the IdP again.
      if (search.signedOut) return { me: null };
      throw redirect({ href: loginUrl(location.href), reloadDocument: true });
    }
  },
  component: RootLayout,
  errorComponent: RootError,
});

function RootLayout() {
  const { me } = Route.useRouteContext();
  const { signedOut } = Route.useSearch();
  return (
    <ToastProvider>
      <div className="min-h-dvh">
        <Header user={me ? me.email || me.name || '' : undefined} />
        <main className="mx-auto max-w-5xl px-4 py-6">
          {me ? <Outlet /> : signedOut ? <SignedOut /> : <AccessDenied />}
        </main>
      </div>
    </ToastProvider>
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

function SignedOut() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-semibold">{t('auth.signedOutTitle')}</h1>
      <a
        href={loginUrl('/')}
        className="mt-4 inline-block rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark"
      >
        {t('auth.signIn')}
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
