// Mirrors Kuitit.Api ReceiptRules; the API re-validates everything.
export const MAX_NAME_LENGTH = 200;
export const MAX_STORE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_FILE_MB = 20;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
export const MAX_FILES = 10;
/** Deleted receipts stay in the trash this long (API purges them). */
export const TRASH_DAYS = 30;
export const MAX_UPLOAD_MB = 60;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const MIN_WARRANTY_MONTHS = 1;
export const MAX_WARRANTY_MONTHS = 600;
export const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'];
/** For <input accept>; HEIC often has no MIME type in browsers, hence the extensions. */
export const ACCEPT = 'image/*,application/pdf,.heic,.heif';
const ACCEPTED_EXTENSIONS = /\.(pdf|jpe?g|png|hei[cf])$/i;

/** Browsers often leave HEIC's type empty, so fall back to the extension. The API checks the bytes. */
export function isAcceptedFile(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.test(file.name);
}

/** Problems with a set of files about to be uploaded (`existing` files already on the receipt), as i18n keys. */
export function fileProblems(files: File[], existing = 0): ('tooMany' | 'tooLarge' | 'type' | 'totalTooLarge')[] {
  const problems: ('tooMany' | 'tooLarge' | 'type' | 'totalTooLarge')[] = [];
  if (existing + files.length > MAX_FILES) problems.push('tooMany');
  if (files.some(f => f.size > MAX_FILE_BYTES)) problems.push('tooLarge');
  if (files.some(f => !isAcceptedFile(f))) problems.push('type');
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_UPLOAD_BYTES) problems.push('totalTooLarge');
  return problems;
}
