import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { archiveReceipt } from '@/api/client/sdk.gen';
import type { ReceiptDto } from '@/api/client/types.gen';
import i18n from '@/i18n';
import type { ReceiptSort } from '@/lib/receiptSort';
import { ReceiptTable } from './ReceiptTable';

vi.mock('@/api/client/sdk.gen', async importOriginal => ({
  ...(await importOriginal<typeof import('@/api/client/sdk.gen')>()),
  archiveReceipt: vi.fn(),
}));

const receipt = (name: string, purchasedOn: string, expiresOn: string): ReceiptDto => ({
  id: name,
  name,
  store: null,
  description: null,
  purchasedOn,
  warrantyMonths: 24,
  expiresOn,
  files: [{ id: `${name}-file`, fileName: 'r.pdf', contentType: 'application/pdf', sizeBytes: 1 }],
  createdAt: '2026-01-01T00:00:00Z',
  archivedAt: null,
  deletedAt: null,
});

const receipts = [
  receipt('Washer', '2024-03-01', '2026-03-01'),
  receipt('älypuhelin', '2026-01-10', '2028-01-10'),
  receipt('Bike', '2025-05-05', '2027-05-05'),
];

function Harness() {
  const [sort, setSort] = useState<ReceiptSort>({ column: 'expiresOn', desc: false });
  return <ReceiptTable receipts={receipts} sort={sort} onSortChange={setSort} />;
}

async function renderTable() {
  // Rows link to the detail page, so the table needs a router around it.
  const router = createRouter({ routeTree: createRootRoute({ component: Harness }), history: createMemoryHistory() });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole('table');
}

const names = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map(r => within(r).getAllByRole('cell')[0]!.textContent);

describe('ReceiptTable', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fi');
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 12), shouldAdvanceTime: true });
  });

  afterEach(() => vi.useRealTimers());

  it('sorts by expiry by default and by clicked column, toggling direction', async () => {
    await renderTable();
    expect(names()).toEqual(['Washer', 'Bike', 'älypuhelin']);

    // Finnish collation puts ä after z.
    await userEvent.click(screen.getByRole('button', { name: /Nimi/ }));
    expect(names()).toEqual(['Bike', 'Washer', 'älypuhelin']);

    await userEvent.click(screen.getByRole('button', { name: /Nimi/ }));
    expect(names()).toEqual(['älypuhelin', 'Washer', 'Bike']);

    await userEvent.click(screen.getByRole('button', { name: /Nimi/ }));
    expect(names()).toEqual(['Bike', 'Washer', 'älypuhelin']);
  });

  it('sorts by purchase date and expired flag', async () => {
    await renderTable();

    await userEvent.click(screen.getByRole('button', { name: /^Ostettu/ }));
    expect(names()).toEqual(['Washer', 'Bike', 'älypuhelin']);

    expect(screen.getAllByRole('img', { name: 'Päättynyt' })).toHaveLength(1);

    // Ties on the flag fall back to expiry date.
    await userEvent.click(screen.getByRole('button', { name: /^Päättynyt/ }));
    expect(names()).toEqual(['Bike', 'älypuhelin', 'Washer']);
  });

  it('asks before archiving and archives only on confirm', async () => {
    vi.mocked(archiveReceipt)
      .mockReset()
      .mockResolvedValue({ data: receipts[0] } as never);
    await renderTable();

    await userEvent.click(screen.getByRole('button', { name: 'Arkistoi: Washer' }));
    const dialog = screen.getByRole('dialog', { name: 'Arkistoidaanko kuitti?' });
    expect(within(dialog).getByRole('button', { name: 'Peruuta' })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Peruuta' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(archiveReceipt).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Arkistoi: Washer' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Arkistoi' }));
    await vi.waitFor(() => expect(archiveReceipt).toHaveBeenCalledOnce());
    expect(vi.mocked(archiveReceipt).mock.calls[0]![0].path).toEqual({ id: 'Washer' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
