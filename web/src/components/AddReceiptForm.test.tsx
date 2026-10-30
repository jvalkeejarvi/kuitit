import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { client } from '@/api/client/client.gen';
import i18n from '@/i18n';
import { createReceipt } from '@/api/client/sdk.gen';
import { AddReceiptForm } from './AddReceiptForm';

// jsdom's File can't pass through Node's Request/FormData, so assert on the generated SDK call instead.
vi.mock('@/api/client/sdk.gen', async importOriginal => ({
  ...(await importOriginal<typeof import('@/api/client/sdk.gen')>()),
  createReceipt: vi.fn(),
}));

function renderForm(onDone = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AddReceiptForm onDone={onDone} />
    </QueryClientProvider>,
  );
  return onDone;
}

describe('AddReceiptForm', () => {
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
    expect(screen.getByText('Add a photo or file of the receipt.')).toBeInTheDocument();
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
    await userEvent.upload(screen.getByLabelText('Receipt'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(vi.mocked(createReceipt).mock.calls[0]![0].body).toEqual({
      name: 'Laptop',
      purchasedOn: '2026-06-15',
      warrantyMonths: 24,
      file,
    });
  });

  it('sends trimmed store and description', async () => {
    vi.mocked(createReceipt).mockResolvedValue({ data: {} } as never);
    const onDone = renderForm();

    await userEvent.type(screen.getByLabelText('Name'), 'Laptop');
    await userEvent.type(screen.getByLabelText('Store'), ' Gigantti ');
    await userEvent.type(screen.getByLabelText('Description'), 'Serial ABC123{enter}Extra warranty ');
    await userEvent.upload(screen.getByLabelText('Receipt'), new File(['x'], 'r.pdf', { type: 'application/pdf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(vi.mocked(createReceipt).mock.calls[0]![0].body).toMatchObject({
      store: 'Gigantti',
      description: 'Serial ABC123\nExtra warranty',
    });
  });

  it('rejects unsupported file types', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText('Name'), 'Laptop');
    await userEvent.upload(screen.getByLabelText('Receipt'), new File(['x'], 'notes.txt', { type: 'text/plain' }), {
      applyAccept: false,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Only PDF, JPEG, PNG and HEIC files are allowed.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createReceipt).not.toHaveBeenCalled();
  });
});
