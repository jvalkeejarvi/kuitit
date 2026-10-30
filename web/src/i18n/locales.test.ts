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
  it('follows the UI language', async () => {
    await i18n.changeLanguage('en');
    expect(document.title).toBe('Warranty receipts');
    await i18n.changeLanguage('fi');
    expect(document.title).toBe('Takuukuitit');
  });
});
