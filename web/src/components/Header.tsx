import { useTranslation } from 'react-i18next';
import { languages, type Language } from '@/i18n';
import { themes, useTheme, type Theme } from '@/lib/theme';

const selectClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900';

/** `user` is the signed-in user's label (email, else name); undefined when signed out. */
export function Header({ user }: { user: string | undefined }) {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useTheme();

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="mr-auto">
          <span className="text-lg font-bold text-brand dark:text-teal-400">{t('app.title')}</span>
        </div>
        <label className="sr-only" htmlFor="language">
          {t('language.label')}
        </label>
        <select
          id="language"
          className={selectClass}
          value={i18n.resolvedLanguage}
          onChange={e => void i18n.changeLanguage(e.target.value as Language)}
        >
          {languages.map(lng => (
            <option key={lng} value={lng}>
              {t(`language.${lng}`)}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="theme">
          {t('theme.label')}
        </label>
        <select id="theme" className={selectClass} value={theme} onChange={e => setTheme(e.target.value as Theme)}>
          {themes.map(th => (
            <option key={th} value={th}>
              {t(`theme.${th}`)}
            </option>
          ))}
        </select>
        {user !== undefined && (
          <form method="post" action="/auth/logout" className="flex items-center gap-2">
            {user && <span className="hidden text-sm text-slate-600 sm:inline dark:text-slate-400">{user}</span>}
            <button type="submit" className="rounded-md px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
              {t('auth.logout')}
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
