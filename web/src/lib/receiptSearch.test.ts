import type { ReceiptDto } from '@/api/client/types.gen';
import { filterReceipts } from './receiptSearch';

const receipt = (name: string, store: string | null, description: string | null) =>
  ({ id: name, name, store, description }) as ReceiptDto;

const receipts = [
  receipt('Pesukone', 'Gigantti', 'Bosch Serie 6'),
  receipt('Jääkaappi', 'Power', null),
  receipt('Kamera', 'Rajala', 'Sony a6400'),
];

describe('filterReceipts', () => {
  const names = (query: string) => filterReceipts(receipts, query, 'fi').map(r => r.name);

  it('matches name, store and description, ignoring case and surrounding space', () => {
    expect(names('pesu')).toEqual(['Pesukone']);
    expect(names('POWER')).toEqual(['Jääkaappi']);
    expect(names(' sony ')).toEqual(['Kamera']);
    expect(names('jää')).toEqual(['Jääkaappi']);
  });

  it('returns everything for a blank query, the same array so the table keeps its identity', () => {
    expect(filterReceipts(receipts, '  ', 'fi')).toBe(receipts);
  });

  it('returns nothing when nothing matches', () => {
    expect(names('pyörä')).toEqual([]);
  });
});
