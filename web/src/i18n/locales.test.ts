import i18n from '@/i18n';
import en from './locales/en.json';
import fi from './locales/fi.json';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

it('Finnish has exactly the same keys as English', () => {
  expect(keys(fi).sort()).toEqual(keys(en).sort());
});

describe('document title', () => {
  // The app name is "Kuitit" in every language for now; the title still comes from the translations.
  it('is the app name from the UI language', async () => {
    await i18n.changeLanguage('en');
    expect(document.title).toBe('Kuitit');
    await i18n.changeLanguage('fi');
    expect(document.title).toBe('Kuitit');
  });
});
