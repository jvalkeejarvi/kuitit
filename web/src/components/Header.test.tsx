import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { Header } from './Header';

describe('Header menu (phones)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fi');
    window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
  });

  const menu = () => document.getElementById('header-menu')!;

  // The header's + is a router link, so it needs a router around it.
  async function renderHeader(extra?: React.ReactNode) {
    const Root = () => (
      <>
        <Header user="juuso" />
        {extra}
      </>
    );
    const router = createRouter({ routeTree: createRootRoute({ component: Root }), history: createMemoryHistory() });
    render(<RouterProvider router={router} />);
    await screen.findByRole('button', { name: 'Valikko' });
  }

  it('opens from the menu button and closes with Escape or a click outside', async () => {
    await renderHeader(<p>outside</p>);
    const button = screen.getByRole('button', { name: 'Valikko' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(menu()).toHaveClass('hidden');

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(menu()).not.toHaveClass('hidden');
    expect(screen.getByLabelText('Kieli')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kirjaudu ulos' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(menu()).toHaveClass('hidden');

    await userEvent.click(button);
    await userEvent.click(screen.getByText('outside'));
    expect(menu()).toHaveClass('hidden');
  });

  it('stays open while using the controls inside it', async () => {
    await renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'Valikko' }));

    await userEvent.click(screen.getByRole('button', { name: 'Teema: Järjestelmä' }));

    expect(menu()).not.toHaveClass('hidden');
  });

  it('links + to the new receipt page', async () => {
    await renderHeader();

    expect(screen.getByRole('link', { name: 'Lisää kuitti' })).toHaveAttribute('href', '/receipts/new');
  });
});
