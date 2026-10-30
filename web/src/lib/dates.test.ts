import { addDays, addMonths, expiryStatus, today } from './dates';

describe('addMonths', () => {
  it.each([
    ['2026-01-10', 24, '2028-01-10'],
    ['2025-08-31', 6, '2026-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2026-12-15', 1, '2027-01-15'],
  ])('%s + %i months = %s', (date, months, expected) => {
    expect(addMonths(date, months)).toBe(expected);
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('expiryStatus', () => {
  it.each([
    ['2026-06-14', 'expired'],
    ['2026-06-15', 'expiringSoon'],
    ['2026-07-15', 'expiringSoon'],
    ['2026-07-16', 'valid'],
  ] as const)('%s is %s on 2026-06-15', (expiresOn, status) => {
    expect(expiryStatus(expiresOn, '2026-06-15')).toBe(status);
  });
});

describe('today', () => {
  it('uses the local calendar date', () => {
    expect(today(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
