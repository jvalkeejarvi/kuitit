import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fi');
    localStorage.clear();
    window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
  });

  it('shows the current theme and cycles light, dark, system', async () => {
    render(<ThemeToggle />);
    const button = () => screen.getByRole('button');

    expect(button()).toHaveAccessibleName('Teema: Järjestelmä');
    await userEvent.click(button());
    expect(button()).toHaveAccessibleName('Teema: Vaalea');
    await userEvent.click(button());
    expect(button()).toHaveAccessibleName('Teema: Tumma');
    expect(document.documentElement).toHaveClass('dark');
    await userEvent.click(button());
    expect(button()).toHaveAccessibleName('Teema: Järjestelmä');
  });
});
