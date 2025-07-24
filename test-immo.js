import { getSuburb } from './lib/services/geocoding/geocoding.js';

const defaultHeaders = {
  'User-Agent': 'ImmoScout24_1410_30_._',
  'Content-Type': 'application/json',
  'Accept-Language': 'de-DE',
};

function parseSalutation(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }

  const trimmedName = name.trim();

  // Check for male salutations (Mr., Herr)
  const maleSalutations = ['Mr.', 'Herr'];
  const maleSluationsRegExpGroup = maleSalutations.map((salutation) => salutation.replace('.', '\\.')).join('|');
  const malePattern = new RegExp(`^(${maleSluationsRegExpGroup})\\s(\\w+)(?:\\s(\\w+))?$`, 'i');
  const maleMatch = trimmedName.match(malePattern);
  if (maleMatch) {
    console.log(maleMatch);
    return {
      gender: 'male',
      lastName: maleMatch[2] && maleMatch[3] ? maleMatch[3] : maleMatch[2],
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

async function main() {
  const listingId = '160521994'; // Replace with a valid listing ID
  const listingInfo = await getListingInfo(listingId);
  // eslint-disable-next-line no-console
  console.log('Listing Information:', listingInfo);
}

void main();
