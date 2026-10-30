export const sortColumns = ['name', 'purchasedOn', 'expiresOn'] as const;
export type SortColumn = (typeof sortColumns)[number];
export type ReceiptSort = { column: SortColumn; desc: boolean };
