import type { ReceiptDto } from '@/api/client/types.gen';

/** Receipts whose name, store or description contain `query` (case-insensitive); all of them when it's blank. */
export function filterReceipts(receipts: ReceiptDto[], query: string, locale: string): ReceiptDto[] {
  const needle = query.trim().toLocaleLowerCase(locale);
  if (!needle) return receipts;
  return receipts.filter(r =>
    [r.name, r.store, r.description].some(text => text?.toLocaleLowerCase(locale).includes(needle)),
  );
}
