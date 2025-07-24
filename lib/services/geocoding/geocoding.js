/**
 * Geocoding service using Nominatim OpenStreetMap API for reverse geocoding.
 *
 * This service provides functionality to convert latitude and longitude coordinates
 * into human-readable address information using the Nominatim reverse geocoding API.
 */

import pThrottle from 'p-throttle';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

// Create throttle to limit requests to 1 per second for Nominatim API
const throttle = pThrottle({
  limit: 1,
  interval: 1000,
});

const throttledFetch = throttle(async (url) => {
  return fetch(url, {
    headers: {
      'User-Agent': 'Fredy-Real-Estate-Bot/1.0', // Nominatim requires a User-Agent
    },
  });
});

/**
 * Performs reverse geocoding using Nominatim API to get address information from coordinates.
 *
 * @param {number} lat - Latitude coordinate
 * @param {number} lon - Longitude coordinate
 * @returns {Promise<Object|null>} Address information object or null if request fails
 */
export async function reverseGeocode(lat, lon) {
  if (lat == null || lon == null) {
    console.error('Geocoding service: Latitude and longitude are required.');
    return null;
  }

  if (typeof lat !== 'number' || typeof lon !== 'number') {
    console.error('Geocoding service: Latitude and longitude must be numbers.');
    return null;
  }

  const url = `${NOMINATIM_BASE_URL}/reverse?lat=${lat}&lon=${lon}&format=json`;

  try {
    const response = await throttledFetch(url);

    if (!response.ok) {
      console.error(`Geocoding service: HTTP error ${response.status}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    if (data.error) {
      console.error('Geocoding service: API returned error:', data.error);
      return null;
    }

    return extractAddressComponents(data);
  } catch (error) {
    console.error('Geocoding service: Request failed:', error.message);
    return null;
  }
}

/**
 * Extracts address components from Nominatim response.
 *
 * @param {Object} geocodeResponse - Response from reverseGeocode function
 * @returns {Object|null} Simplified address object or null if invalid response
 */
export function extractAddressComponents(geocodeResponse) {
  if (!geocodeResponse?.address) {
    console.error('Geocoding service: Address missing.');
    return null;
  }

  console.log(geocodeResponse);

  const { address } = geocodeResponse;
  return {
    houseNumber: address.house_number || null,
    street: address.road || null,
    neighbourhood: address.neighbourhood || null,
    suburb: address.suburb || null,
    borough: address.borough || null,
    city: address.city || address.town || address.village || null,
    postcode: address.postcode || null,
    country: address.country || null,
    countryCode: address.country_code || null,
    displayName: geocodeResponse.display_name || null,
  };
}

/**
 * Gets neighborhood information from coordinates.
 *
 * @param {number} lat - Latitude coordinate
 * @param {number} lon - Longitude coordinate
 * @returns {Promise<Object|null>} Object containing neighborhood info or null if request fails
 */
export async function getSuburb(lat, lon) {
  const geocodeResult = await reverseGeocode(lat, lon);
  return geocodeResult?.suburb || null;
}

export default {
  reverseGeocode,
  getSuburb,
};
