import { Link } from '@tanstack/react-router';
import { ChevronDown, Menu, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { languages, type Language } from '@/i18n';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useCssHeightVar } from '@/lib/useCssHeightVar';

// Every control in the bar is h-9 (36px). The select drops its native look (Safari ignores a native select's
// height) and draws its own chevron.
const selectClass =
  'h-9 appearance-none rounded-md border border-slate-300 bg-white pr-8 pl-3 text-sm dark:border-slate-700 dark:bg-slate-900';

/**
 * `user` is the signed-in user's label (email, else name); undefined when signed out.
 * The controls render once: inline from `sm` up, folded into a menu panel below the bar on phones.
 */
export function Header({ user }: { user: string | undefined }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  useCssHeightVar(headerRef, '--header-h');

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
      // Sticky: stays at the top while the list scrolls (and anchors the phone menu panel below it).
      className="sticky top-0 z-30 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <span className="mr-auto text-lg font-bold text-brand dark:text-teal-400">{t('app.title')}</span>
        {user !== undefined && (
          // The app's main action, always in the same place: a round + on phones, + with text from sm up.
          <Link
            to="/"
            search={prev => ({ ...prev, add: true })}
            title={t('receipts.add')}
            className="inline-flex size-9 items-center justify-center gap-1.5 rounded-full bg-brand font-medium text-white hover:bg-brand-dark sm:h-9 sm:w-auto sm:rounded-md sm:px-3 sm:text-sm"
          >
            <Plus className="size-5" aria-hidden />
            <span className="sr-only sm:not-sr-only">{t('receipts.add')}</span>
          </Link>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="header-menu"
          aria-label={t('menu.label')}
          onClick={() => setOpen(o => !o)}
          className="inline-flex size-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 sm:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
        <div
          id="header-menu"
          // Phones: a two-column grid (label | control); the row wrappers are display:contents there.
          className={`${open ? 'grid' : 'hidden'} absolute inset-x-0 top-full z-40 grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 border-b border-slate-200 bg-white px-4 py-4 shadow-md sm:static sm:flex sm:items-center sm:gap-3 sm:border-0 sm:p-0 sm:shadow-none dark:border-slate-800 dark:bg-slate-900`}
        >
          <div className="contents sm:flex sm:items-center">
            <label className="text-sm sm:sr-only" htmlFor="language">
              {t('language.label')}
            </label>
            <span className="relative justify-self-start">
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
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-slate-500"
                aria-hidden
              />
            </span>
          </div>
          <div className="contents sm:flex sm:items-center">
            <span className="text-sm sm:hidden" aria-hidden>
              {t('theme.label')}
            </span>
            <ThemeToggle withLabel />
          </div>
          {user !== undefined && (
            <form
              method="post"
              action="/auth/logout"
              className="col-span-2 flex items-center gap-2 border-t border-slate-200 pt-3 sm:border-0 sm:pt-0 dark:border-slate-800"
            >
              {user && <span className="text-sm text-slate-600 dark:text-slate-400">{user}</span>}
              <button
                type="submit"
                className="ml-auto h-9 rounded-md px-3 text-sm hover:bg-slate-100 sm:ml-0 dark:hover:bg-slate-800"
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
