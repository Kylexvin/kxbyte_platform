// src/modules/platform/organizations/utils/country.utils.js

const COUNTRY_DEFAULTS = {
  KE: { currency: 'KES', timezone: 'Africa/Nairobi' },
  UG: { currency: 'UGX', timezone: 'Africa/Kampala' },
  TZ: { currency: 'TZS', timezone: 'Africa/Dar_es_Salaam' },
  NG: { currency: 'NGN', timezone: 'Africa/Lagos' },
  ZA: { currency: 'ZAR', timezone: 'Africa/Johannesburg' },
  GH: { currency: 'GHS', timezone: 'Africa/Accra' },
  US: { currency: 'USD', timezone: 'America/New_York' },
  GB: { currency: 'GBP', timezone: 'Europe/London' },
  // Add more as needed
};

const getCountryDefaults = (countryCode) => {
  const defaults = COUNTRY_DEFAULTS[countryCode.toUpperCase()];
  if (!defaults) {
    return { currency: 'USD', timezone: 'UTC' };
  }
  return defaults;
};

export { getCountryDefaults };