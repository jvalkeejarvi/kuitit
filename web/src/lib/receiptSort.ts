export const sortColumns = ['name', 'purchasedOn', 'expiresOn', 'expired'] as const;
export type SortColumn = (typeof sortColumns)[number];
export type ReceiptSort = { column: SortColumn; desc: boolean };
