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

  it('opens from the menu button and closes with Escape or a click outside', async () => {
    render(
      <>
        <Header user="juuso" />
        <p>outside</p>
      </>,
    );
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
    render(<Header user="juuso" />);
    await userEvent.click(screen.getByRole('button', { name: 'Valikko' }));

    await userEvent.click(screen.getByRole('button', { name: 'Teema: Järjestelmä' }));

    expect(menu()).not.toHaveClass('hidden');
  });
});
