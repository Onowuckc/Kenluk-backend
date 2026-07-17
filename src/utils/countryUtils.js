// Convert country name/abbreviation to alpha-2 code
export const countryCodeMap = {
  'china': 'CN',
  'hong kong': 'HK',
  'hongkong': 'HK',
  'hong kong sar': 'HK',
  'nigeria': 'NG',
  'united states': 'US',
  'united states of america': 'US',
  'united kingdom': 'GB',
  'great britain': 'GB',
  'england': 'GB',
  'germany': 'DE',
  'france': 'FR',
  'japan': 'JP',
  'canada': 'CA',
  'australia': 'AU',
  'switzerland': 'CH',
  'puerto rico': 'PR',
  'guam': 'GU',
  'american samoa': 'AS',
  'u.s. virgin islands': 'VI',
  'us virgin islands': 'VI',
  'virgin islands': 'VI',
  'northern mariana islands': 'MP'
};

// US territories that use US SWIFT/BIC codes
const US_TERRITORIES = ['AS', 'GU', 'PR', 'VI', 'MP'];

/**
 * Normalizes a country name or code to its standard 2-letter ISO code
 * @param {string} countryName - The raw country name or 2-letter code
 * @returns {string} The normalized 2-letter uppercase country code
 */
export const getCountryCode = (countryName) => {
  if (!countryName) return '';
  const trimmed = countryName.trim();
  const lower = trimmed.toLowerCase();
  
  if (countryCodeMap[lower]) {
    return countryCodeMap[lower];
  }
  
  if (trimmed.length === 2) {
    return trimmed.toUpperCase();
  }
  
  return trimmed;
};

/**
 * Validates that a SWIFT code's embedded country matches the provider/bank country
 * @param {string} swiftCode - The recipient bank's SWIFT/BIC code
 * @param {string} countryName - The recipient bank's country
 * @returns {boolean} True if matched (incorporating US territories rules)
 */
export const validateSwiftCountry = (swiftCode, countryName) => {
  if (!swiftCode || swiftCode.length < 6) return false;
  
  const swiftCountry = swiftCode.substring(4, 6).toUpperCase();
  const providerCountry = getCountryCode(countryName);

  if (swiftCountry === providerCountry) {
    return true;
  }

  // Handle US territories exception:
  // If the bank country is in US territories and SWIFT country code is US, or vice versa
  const isSwiftUs = swiftCountry === 'US' || US_TERRITORIES.includes(swiftCountry);
  const isProviderUs = providerCountry === 'US' || US_TERRITORIES.includes(providerCountry);
  
  if (isSwiftUs && isProviderUs) {
    return true;
  }

  return false;
};
