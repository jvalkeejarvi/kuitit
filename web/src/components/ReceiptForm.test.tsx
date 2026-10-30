import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { client } from '@/api/client/client.gen';
import i18n from '@/i18n';
import { createReceipt, updateReceipt } from '@/api/client/sdk.gen';
import type { ReceiptDto } from '@/api/client/types.gen';
import { ReceiptForm } from './ReceiptForm';

// jsdom's File can't pass through Node's Request/FormData, so assert on the generated SDK call instead.
vi.mock('@/api/client/sdk.gen', async importOriginal => ({
  ...(await importOriginal<typeof import('@/api/client/sdk.gen')>()),
  createReceipt: vi.fn(),
  updateReceipt: vi.fn(),
}));

function renderForm(onDone = vi.fn(), receipt?: ReceiptDto, onSaved?: (r: ReceiptDto) => void) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ReceiptForm receipt={receipt} onDone={onDone} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  return onDone;
}

describe('ReceiptForm', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 12), shouldAdvanceTime: true });
    fetchMock.mockReset();
    vi.mocked(createReceipt).mockReset();
    client.setConfig({ baseUrl: 'http://localhost', fetch: fetchMock });
  });

  afterEach(() => vi.useRealTimers());

  it('shows validation errors and does not submit', async () => {
    renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Add at least one photo or file of the receipt.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createReceipt).not.toHaveBeenCalled();
  });

  it('previews the expiry date from purchase date and warranty', async () => {
    renderForm();

    const purchased = screen.getByLabelText('Purchase date');
    await userEvent.clear(purchased);
    await userEvent.type(purchased, '2025-08-31');
    await userEvent.selectOptions(screen.getByLabelText('Unit'), 'months');
    const amount = screen.getByLabelText('Warranty length');
    await userEvent.clear(amount);
    await userEvent.type(amount, '6');

    expect(screen.getByText('Warranty until Feb 28, 2026')).toBeInTheDocument();
  });

  it('submits the receipt with warranty converted to months', async () => {
    vi.mocked(createReceipt).mockResolvedValue({ data: {} } as never);
    const onDone = renderForm();

    await userEvent.type(screen.getByLabelText('Name'), '  Laptop ');
    const file = new File(['%PDF-1.7'], 'receipt.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('Choose files'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(vi.mocked(createReceipt).mock.calls[0]![0].body).toEqual({
      name: 'Laptop',
      purchasedOn: '2026-06-15',
      warrantyMonths: 24,
      files: [file],
    });
  });

  it('sends trimmed store and description', async () => {
    vi.mocked(createReceipt).mockResolvedValue({ data: {} } as never);
    const onDone = renderForm();

    await userEvent.type(screen.getByLabelText('Name'), 'Laptop');
    await userEvent.type(screen.getByLabelText('Store'), ' Gigantti ');
    await userEvent.type(screen.getByLabelText('Description'), 'Serial ABC123{enter}Extra warranty ');
    await userEvent.upload(
      screen.getByLabelText('Choose files'),
      new File(['x'], 'r.pdf', { type: 'application/pdf' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(vi.mocked(createReceipt).mock.calls[0]![0].body).toMatchObject({
      store: 'Gigantti',
      description: 'Serial ABC123\nExtra warranty',
    });
  });

  it('collects files from several picks, lets one be removed and sends the rest', async () => {
    vi.mocked(createReceipt).mockResolvedValue({ data: {} } as never);
    const onDone = renderForm();
    const [a, b, c] = ['a.pdf', 'b.png', 'c.jpg'].map(name => new File(['x'], name, { type: 'application/pdf' }));

    await userEvent.type(screen.getByLabelText('Name'), 'TV');
    await userEvent.upload(screen.getByLabelText('Choose files'), [a!, b!]);
    await userEvent.upload(screen.getByLabelText('Choose files'), c!);
    await userEvent.click(screen.getByRole('button', { name: 'Remove b.png' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(vi.mocked(createReceipt).mock.calls[0]![0].body.files).toEqual([a, c]);
  });

  it('rejects more files than a receipt can hold', async () => {
    renderForm();
    const files = Array.from({ length: 11 }, (_, i) => new File(['x'], `${i}.pdf`, { type: 'application/pdf' }));

    await userEvent.type(screen.getByLabelText('Name'), 'TV');
    await userEvent.upload(screen.getByLabelText('Choose files'), files.slice(0, 6));
    await userEvent.upload(screen.getByLabelText('Choose files'), files.slice(6));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('A receipt can have at most 10 files.')).toBeInTheDocument();
    expect(createReceipt).not.toHaveBeenCalled();
  });

  it('rejects unsupported file types', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText('Name'), 'Laptop');
    await userEvent.upload(
      screen.getByLabelText('Choose files'),
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
      {
        applyAccept: false,
      },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Only PDF, JPEG, PNG and HEIC files are allowed.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createReceipt).not.toHaveBeenCalled();
  });

  it('edits an existing receipt: prefilled, no file picker, sends only details', async () => {
    const receipt: ReceiptDto = {
      id: 'r1',
      name: 'TV',
      store: 'Power',
      description: null,
      purchasedOn: '2025-12-30',
      warrantyMonths: 60,
      expiresOn: '2030-12-30',
      files: [{ id: 'f1', fileName: 'r.pdf', contentType: 'application/pdf', sizeBytes: 1 }],
      createdAt: '2026-01-01T00:00:00Z',
      archivedAt: null,
      deletedAt: null,
    };
    vi.mocked(updateReceipt).mockResolvedValue({ data: receipt } as never);
    const onDone = renderForm(vi.fn(), receipt);

    expect(screen.getByRole('form', { name: 'Edit receipt' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('TV');
    expect(screen.getByLabelText('Warranty length')).toHaveValue(5);
    expect(screen.getByLabelText('Unit')).toHaveValue('years');
    expect(screen.queryByLabelText('Choose files')).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Store'));
    await userEvent.type(screen.getByLabelText('Description'), 'OLED');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(vi.mocked(updateReceipt).mock.calls[0]![0]).toMatchObject({
      path: { id: 'r1' },
      body: { name: 'TV', store: null, description: 'OLED', purchasedOn: '2025-12-30', warrantyMonths: 60 },
    });
  });

  it('hands the created receipt to onSaved instead of closing', async () => {
    const created = { id: 'new-id', name: 'Laptop' } as ReceiptDto;
    vi.mocked(createReceipt).mockResolvedValue({ data: created } as never);
    const onSaved = vi.fn();
    const onDone = renderForm(vi.fn(), undefined, onSaved);

    await userEvent.type(screen.getByLabelText('Name'), 'Laptop');
    await userEvent.upload(
      screen.getByLabelText('Choose files'),
      new File(['x'], 'r.pdf', { type: 'application/pdf' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));
    expect(onDone).not.toHaveBeenCalled();
  });
});
