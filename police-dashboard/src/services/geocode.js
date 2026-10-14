// In-memory cache to avoid repeated network calls
const geocodeCache = new Map();

/**
 * Reverse geocodes latitude & longitude into a human-readable location address.
 * Uses OpenStreetMap's Nominatim with client-side caching.
 */
export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return 'Unknown Location';

  // Round coordinates to ~10m accuracy for caching
  const cacheKey = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ARIA-Police-Emergency-Dispatch/1.0'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const addr = data.address || {};
    const poi = data.name || addr.amenity || addr.building || addr.shop || '';
    const road = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || '';
    const city = addr.city || addr.town || addr.village || addr.county || '';
    const state = addr.state || '';

    let formatted = '';
    if (poi && road) {
      formatted = `${poi}, ${road}${city ? ', ' + city : ''}`;
    } else if (poi) {
      formatted = `${poi}${city ? ', ' + city : ''}`;
    } else if (road && city) {
      formatted = `${road}, ${city}`;
    } else if (data.display_name) {
      formatted = data.display_name.split(',').slice(0, 3).join(', ').trim();
    } else {
      formatted = `${Number(lat).toFixed(5)}°, ${Number(lng).toFixed(5)}°`;
    }

    geocodeCache.set(cacheKey, formatted);
    return formatted;
  } catch (err) {
    console.warn('[Geocode] Reverse geocoding failed:', err);
    const fallback = `${Number(lat).toFixed(5)}°, ${Number(lng).toFixed(5)}°`;
    return fallback;
  }
}
