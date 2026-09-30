import * as Location from 'expo-location';

export const LocationService = {
  async requestPermissions() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[LOCATION SERVICE] Foreground location permission denied.');
        return false;
      }
      return true;
    } catch (err) {
      console.error('[LOCATION SERVICE] Error request permissions:', err.message);
      return false;
    }
  },

  async getCurrentLocation() {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        // Permission denied — do NOT invent coordinates.
        // Callers must handle null and show "location unknown" to the dispatcher.
        // A missing pin tells a dispatcher to phone the person;
        // a wrong pin sends them to the wrong city.
        console.warn('[LOCATION SERVICE] Permission denied. Returning unavailable — no fallback coordinates.');
        return { latitude: null, longitude: null, unavailable: true };
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        unavailable: false
      };
    } catch (err) {
      // GPS fetch failed — do NOT invent coordinates.
      console.warn('[LOCATION SERVICE] Failed to fetch current location. Returning unavailable.', err.message);
      return { latitude: null, longitude: null, unavailable: true };
    }
  }
};
export default LocationService;
