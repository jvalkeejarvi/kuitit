// Dates are ISO `YYYY-MM-DD` strings (C# DateOnly) handled without time zones, so a date never shifts by a day.

export type IsoDate = string;

const pad = (n: number) => String(n).padStart(2, '0');

const toIso = (y: number, m: number, d: number): IsoDate => `${y}-${pad(m)}-${pad(d)}`;

const parts = (date: IsoDate): [number, number, number] => {
  const [y, m, d] = date.split('-').map(Number);
  return [y ?? 0, m ?? 1, d ?? 1];
};

export function today(now: Date = new Date()): IsoDate {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = parts(date);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return toIso(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

/** Same rule as .NET DateOnly.AddMonths: the day is clamped to the end of the target month. */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = parts(date);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return toIso(year, month, Math.min(d, lastDay));
}

export function formatDate(date: IsoDate, locale: string): string {
  const [y, m, d] = parts(date);
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', dateStyle: 'medium' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export type ExpiryStatus = 'expired' | 'expiringSoon' | 'valid';

export const EXPIRING_SOON_DAYS = 30;

export function expiryStatus(expiresOn: IsoDate, now: IsoDate = today()): ExpiryStatus {
  if (expiresOn < now) return 'expired';
  if (expiresOn <= addDays(now, EXPIRING_SOON_DAYS)) return 'expiringSoon';
  return 'valid';
}

/** A server timestamp (ISO with offset) as a local date. */
export function formatTimestamp(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
}
