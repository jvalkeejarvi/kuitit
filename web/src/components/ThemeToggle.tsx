import { Moon, Sun, SunMoon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { nextTheme, useTheme, type Theme } from '@/lib/theme';

const icons = { light: Sun, dark: Moon, system: SunMoon } satisfies Record<Theme, unknown>;

/**
 * Cycles light -> dark -> system, showing the current theme.
 * `withLabel` also shows the theme's name on phones, where the toggle sits in the menu panel.
 */
export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const { t } = useTranslation();
  const [theme, setTheme] = useTheme();
  const label = t('theme.current', { theme: t(`theme.${theme}`) });
  const Icon = icons[theme];

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(nextTheme(theme))}
      className="inline-flex items-center gap-2 rounded-md p-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    >
      <Icon className="size-5" aria-hidden />
      {withLabel && (
        <span aria-hidden className="sm:hidden">
          {label}
        </span>
      )}
    </button>
  );
}
