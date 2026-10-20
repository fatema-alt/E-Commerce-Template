import {
  combination,
  money,
  prices,
  validateOptions,
} from './catalog.rules.js';
describe('Catalog domain validation', () => {
  it('keeps authoritative calculations decimal safe', () => {
    expect(money('0.10').plus(money('0.20')).toFixed(2)).toBe('0.30');
    expect(() => money('1.001')).toThrow();
    expect(() => prices('10.00', '10.01')).toThrow();
    expect(() => prices('10.00', '0')).not.toThrow();
  });
  it('canonicalizes option ordering and casing', () => {
    expect(combination({ Size: 'M', Color: 'Black' })).toBe(
      combination({ color: 'black', size: 'm' }),
    );
    expect(() => combination({ size: '' })).toThrow();
    expect(() => combination({ size: 'M', Size: 'L' })).toThrow();
  });
  it('rejects duplicate values and excessive combination counts', () => {
    expect(() =>
      validateOptions([{ name: 'Size', values: ['M', 'm'] }]),
    ).toThrow();
    expect(() =>
      validateOptions([
        { name: 'A', values: Array.from({ length: 20 }, (_, i) => String(i)) },
        { name: 'B', values: Array.from({ length: 20 }, (_, i) => String(i)) },
      ]),
    ).toThrow('200');
  });
});
