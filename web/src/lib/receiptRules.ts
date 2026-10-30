// Mirrors Kuitit.Api ReceiptRules; the API re-validates everything.
export const MAX_NAME_LENGTH = 200;
export const MAX_STORE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_FILE_MB = 20;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
export const MIN_WARRANTY_MONTHS = 1;
export const MAX_WARRANTY_MONTHS = 600;
export const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'];
const ACCEPTED_EXTENSIONS = /\.(pdf|jpe?g|png|hei[cf])$/i;

/** Browsers often leave HEIC's type empty, so fall back to the extension. The API checks the bytes. */
export function isAcceptedFile(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.test(file.name);
}
