import { useTranslation } from 'react-i18next';
import { expiryStatus, type ExpiryStatus, type IsoDate } from '@/lib/dates';

const statusClass: Record<ExpiryStatus, string> = {
  expired: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  expiringSoon: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  valid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};

export function StatusBadge({ expiresOn }: { expiresOn: IsoDate }) {
  const { t } = useTranslation();
  const status = expiryStatus(expiresOn);
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${statusClass[status]}`}>
      {t(`receipts.status.${status}`)}
    </span>
  );
}
