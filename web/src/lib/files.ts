import type { TFunction } from 'i18next';
import { MAX_FILE_MB, MAX_FILES, MAX_UPLOAD_MB, type fileProblems } from '@/lib/receiptRules';

export function formatFileSize(bytes: number, locale: string): string {
  const mb = bytes >= 1024 * 1024;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: mb ? 'megabyte' : 'kilobyte',
    maximumFractionDigits: 1,
  }).format(mb ? bytes / (1024 * 1024) : Math.max(bytes / 1024, 0.1));
}

export function fileProblemMessage(problem: ReturnType<typeof fileProblems>[number], t: TFunction): string {
  switch (problem) {
    case 'tooMany':
      return t('files.errors.tooMany', { max: MAX_FILES });
    case 'tooLarge':
      return t('files.errors.tooLarge', { mb: MAX_FILE_MB });
    case 'type':
      return t('files.errors.type');
    case 'totalTooLarge':
      return t('files.errors.totalTooLarge', { mb: MAX_UPLOAD_MB });
  }
}

/** Formats browsers can show in an <img>; PDF and HEIC open in a new tab instead. */
export const previewTypes = new Set(['image/jpeg', 'image/png']);
