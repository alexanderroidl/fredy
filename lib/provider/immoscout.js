/**
 * ImmoScout provider using the mobile API to retrieve listings.
 *
 * The mobile API provides the following endpoints:
 * - GET /search/total?{search parameters}: Returns the total number of listings for the given query
 *   Example: `curl -H "User-Agent: ImmoScout24_1410_30_._" https://api.mobile.immobilienscout24.de/search/total?searchType=region&realestatetype=apartmentrent&pricetype=calculatedtotalrent&geocodes=%2Fde%2Fberlin%2Fberlin `
 *
 * - POST /search/list?{search parameters}: Actually retrieves the listings. Body is json encoded and contains
 *   data specifying additional results (advertisements) to return. The format is as follows:
 *   ```
 *   {
 *   "supportedResultListTypes": [],
 *   "userData": {}
 *   }
 *   ```
 *   It is not necessary to provide data for the specified keys.
 *
 *   Example: `curl -X POST 'https://api.mobile.immobilienscout24.de/search/list?pricetype=calculatedtotalrent&realestatetype=apartmentrent&searchType=region&geocodes=%2Fde%2Fberlin%2Fberlin&pagenumber=1' -H "Connection: keep-alive" -H "User-Agent: ImmoScout24_1410_30_._" -H "Accept: application/json" -H "Content-Type: application/json" -d '{"supportedResultListType": [], "userData": {}}'`

 * - GET /expose/{id} - Returns the details of a listing. The response contains additional details not included in the
 *   listing response.
 *
 *   Example: `curl -H "User-Agent: ImmoScout24_1410_30_._" "https://api.mobile.immobilienscout24.de/expose/158382494"`
 *
 *
 * It is necessary to set the correct User Agent (see `getListings`) in the request header.
 *
 * Note that the mobile API is not publicly documented. I've reverse-engineered
 * it by intercepting traffic from an android emulator running the immoscout app.
 * Moreover, the search parameters differ slightly from the web API. I've mapped them
 * to the web API parameters by comparing a search request with all parameters set between
 * the web and mobile API. The mobile API actually seems to be a superset of the web API,
 * but I have decided not to include new parameters as I wanted to keep the existing UX (i.e.,
 * users only have to provide a link to an existing search).
 *
 */

import utils, { buildHash } from '../utils.js';
import { convertWebToMobile } from '../services/immoscout/immoscout-web-translator.js';
import { getSuburb } from '../services/geocoding/geocoding.js';

let appliedBlackList = [];

const defaultHeaders = {
  'User-Agent': 'ImmoScout24_1410_30_._',
  'Content-Type': 'application/json',
};

async function getListings(url) {
  const response = await fetch(url, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({
      supportedResultListTypes: [],
      userData: {},
    }),
  });
  if (!response.ok) {
    console.error('Error fetching listings from ImmoScout Mobile API:', response.statusText);
    return [];
  }

  const responseBody = await response.json();
  return responseBody.resultListItems
    .filter((item) => item.type === 'EXPOSE_RESULT')
    .map((expose) => {
      const item = expose.item;
      const [price, size] = item.attributes;
      return {
        id: item.id,
        price: price?.value,
        size: size?.value,
        title: item.title,
        link: `${metaInformation.baseUrl}expose/${item.id}`,
        address: item.address?.line,
      };
    });
}

const messageTemplate = `
`;

function parseSalutation(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }

  const trimmedName = name.trim();

  // Check for male salutations (Mr., Herr)
  const malePattern = /^(Mr\.|Herr)\s(\w+)(?:\s(\w+))?$/i;
  const maleMatch = trimmedName.match(malePattern);
  if (maleMatch) {
    return {
      gender: 'male',
      lastName: maleMatch[1] && maleMatch[2] ? maleMatch[2] : maleMatch[1],
    };
  }

  // Check for female salutations (Ms., Mrs., Frau)
  const femalePattern = /^(Ms\.|Mrs\.|Frau)\s(\w+)(?:\s(\w+))?$/i;
  const femaleMatch = trimmedName.match(femalePattern);
  if (femaleMatch) {
    return {
      gender: 'female',
      lastName: femaleMatch[1] && femaleMatch[2] ? femaleMatch[2] : femaleMatch[1],
    };
  }

  // If no recognized salutation pattern, return null (non-real person)
  return null;
}

async function getListingInfo(listingId) {
  const response = await fetch(`https://api.mobile.immobilienscout24.de/expose/${listingId}`, {
    method: 'GET',
    headers: defaultHeaders,
  });
  if (!response.ok) {
    console.error('Error fetching listing from ImmoScout Mobile API:', response.statusText);
    return null;
  }

  const responseBody = await response.json();

  // Extract number of rooms from TOP_ATTRIBUTES section
  let roomCount = null;
  const topAttributesSection = responseBody.sections?.find((section) => section.type === 'TOP_ATTRIBUTES');
  if (topAttributesSection) {
    const roomsAttribute = topAttributesSection.attributes?.find((attr) => attr.label === 'Zimmer');
    if (roomsAttribute) {
      roomCount = parseInt(roomsAttribute.text, 10);
    }
  }

  // Extract location (lat, lng) from MAP section
  let suburb = null;
  const mapSection = responseBody.sections?.find((section) => section.type === 'MAP')?.location;
  if (mapSection) {
    suburb = await getSuburb(mapSection.lat, mapSection.lng);
  }

  // Extract contact name from contact data
  let salutation = null;
  if (responseBody.contact?.contactData?.agent?.name) {
    salutation = parseSalutation(responseBody.contact.contactData.agent.name);
  }

  return {
    id: listingId,
    roomCount,
    suburb,
    salutation,
  };
}

async function contactListing(listingId, authToken, ssoId) {
  const response = await fetch(`https://api.mobile.immobilienscout24.de/expose/${listingId}`, {
    method: 'POST',
    headers: {
      ...defaultHeaders,
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      'expose.contactForm': {
        address: {
          street: '',
          houseNumber: '',
          postcode: '',
          city: '',
        },
        emailAddress: '',
        firstname: '',
        lastname: '',
        message: '',
        phoneNumber: '',
        privacyPolicyAccepted: false,
        profileImageUrl: '',
        profileType: '',
        salutation: '',
        sendProfile: true,
      },
      ssoId,
      realEstateType: 'ApartmentRent',
      supportedScreens: [],
      requestCount: 2,
      doNotSend: false,
      entitlements: [],
    }),
  });
}

function nullOrEmpty(val) {
  return val == null || val.length === 0;
}
function normalize(o) {
  const title = nullOrEmpty(o.title) ? 'NO TITLE FOUND' : o.title.replace('NEU', '');
  const address = nullOrEmpty(o.address) ? 'NO ADDRESS FOUND' : (o.address || '').replace(/\(.*\),.*$/, '').trim();
  const id = buildHash(o.id, o.price);
  return Object.assign(o, { id, title, address });
}
function applyBlacklist(o) {
  return !utils.isOneOf(o.title, appliedBlackList);
}
const config = {
  url: null,
  crawlFields: {
    id: 'id',
    title: 'title',
    price: 'price',
    size: 'size',
    link: 'link',
    address: 'address',
  },
  // Not required - used by filter to remove and listings that failed to parse
  sortByDateParam: 'sorting=-firstactivation',
  normalize: normalize,
  filter: applyBlacklist,
  getListings: getListings,
};
export const init = (sourceConfig, blacklist) => {
  config.enabled = sourceConfig.enabled;
  config.url = convertWebToMobile(sourceConfig.url);
  appliedBlackList = blacklist || [];
};
export const metaInformation = {
  name: 'Immoscout',
  baseUrl: 'https://www.immobilienscout24.de/',
  id: 'immoscout',
};

export { config };
