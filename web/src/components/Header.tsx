import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { languages, type Language } from '@/i18n';
import { ThemeToggle } from '@/components/ThemeToggle';

const selectClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900';

/**
 * `user` is the signed-in user's label (email, else name); undefined when signed out.
 * The controls render once: inline from `sm` up, folded into a menu panel below the bar on phones.
 */
export function Header({ user }: { user: string | undefined }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onPointer = (e: PointerEvent) => !headerRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <header
      ref={headerRef}
      className="relative border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <span className="mr-auto text-lg font-bold text-brand dark:text-teal-400">{t('app.title')}</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="header-menu"
          aria-label={t('menu.label')}
          onClick={() => setOpen(o => !o)}
          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 sm:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
        <div
          id="header-menu"
          className={`${open ? 'flex' : 'hidden'} absolute inset-x-0 top-full z-40 flex-col items-start gap-4 border-b border-slate-200 bg-white px-4 py-4 shadow-md sm:static sm:flex sm:flex-row sm:items-center sm:gap-3 sm:border-0 sm:p-0 sm:shadow-none dark:border-slate-800 dark:bg-slate-900`}
        >
          <div className="flex items-center gap-2">
            <label className="text-sm sm:sr-only" htmlFor="language">
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
          </div>
          <ThemeToggle withLabel />
          {user !== undefined && (
            <form
              method="post"
              action="/auth/logout"
              className="flex w-full items-center gap-2 border-t border-slate-200 pt-4 sm:w-auto sm:border-0 sm:pt-0 dark:border-slate-800"
            >
              {user && <span className="text-sm text-slate-600 dark:text-slate-400">{user}</span>}
              <button
                type="submit"
                className="ml-auto rounded-md px-2 py-1 text-sm hover:bg-slate-100 sm:ml-0 dark:hover:bg-slate-800"
              >
                {t('auth.logout')}
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
