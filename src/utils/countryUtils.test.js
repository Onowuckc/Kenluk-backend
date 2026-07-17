import { getCountryCode, validateSwiftCountry } from './countryUtils.js';

describe('countryUtils', () => {
  describe('getCountryCode', () => {
    it('normalizes standard country names from countryCodeMap', () => {
      expect(getCountryCode('Hong Kong')).toBe('HK');
      expect(getCountryCode('hongkong')).toBe('HK');
      expect(getCountryCode('United States')).toBe('US');
      expect(getCountryCode('united kingdom')).toBe('GB');
      expect(getCountryCode('china')).toBe('CN');
    });

    it('returns uppercase for already 2-letter country codes', () => {
      expect(getCountryCode('hk')).toBe('HK');
      expect(getCountryCode('US')).toBe('US');
      expect(getCountryCode('ng')).toBe('NG');
    });

    it('returns raw trimmed input if no mapping exists', () => {
      expect(getCountryCode('Singapore')).toBe('Singapore');
      expect(getCountryCode('SG')).toBe('SG');
    });

    it('returns empty string for falsy input', () => {
      expect(getCountryCode(null)).toBe('');
      expect(getCountryCode(undefined)).toBe('');
    });
  });

  describe('validateSwiftCountry', () => {
    it('returns true when SWIFT country matches normalized bank country code', () => {
      expect(validateSwiftCountry('HSBCHKHH', 'Hong Kong')).toBe(true);
      expect(validateSwiftCountry('BOFAUS3N', 'United States')).toBe(true);
      expect(validateSwiftCountry('BOFAUS3N', 'US')).toBe(true);
    });

    it('returns false when SWIFT country does not match bank country code', () => {
      expect(validateSwiftCountry('HSBCHKHH', 'United States')).toBe(false);
      expect(validateSwiftCountry('BOFAUS3N', 'Hong Kong')).toBe(false);
    });

    it('returns true for US territories matching US SWIFT codes', () => {
      // US SWIFT code (US) with territory bank country (PR, GU, etc)
      expect(validateSwiftCountry('BOFAUS3N', 'PR')).toBe(true);
      expect(validateSwiftCountry('BOFAUS3N', 'Puerto Rico')).toBe(true);
      expect(validateSwiftCountry('BOFAUS3N', 'GU')).toBe(true);
      expect(validateSwiftCountry('BOFAUS3N', 'Guam')).toBe(true);
      expect(validateSwiftCountry('BOFAUS3N', 'AS')).toBe(true);
      expect(validateSwiftCountry('BOFAUS3N', 'VI')).toBe(true);
      expect(validateSwiftCountry('BOFAUS3N', 'MP')).toBe(true);
    });

    it('returns false for invalid or short SWIFT codes', () => {
      expect(validateSwiftCountry('ABCD', 'US')).toBe(false);
      expect(validateSwiftCountry('', 'US')).toBe(false);
      expect(validateSwiftCountry(null, 'US')).toBe(false);
    });
  });
});
