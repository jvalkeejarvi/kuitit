import { Moon, Sun, SunMoon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { nextTheme, useTheme, type Theme } from '@/lib/theme';

const icons = { light: Sun, dark: Moon, system: SunMoon } satisfies Record<Theme, unknown>;

/** Cycles light -> dark -> system, showing the current theme. */
export function ThemeToggle() {
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
      className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}
