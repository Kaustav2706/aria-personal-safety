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
        // Fallback coordinates (Delhi center) if running inside an emulator without permissions
        return {
          latitude: 28.6139,
          longitude: 77.2090,
          mocked: true
        };
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        mocked: false
      };
    } catch (err) {
      console.warn('[LOCATION SERVICE] Failed to fetch current location, falling back to mock.', err.message);
      return {
        latitude: 28.6139 + (Math.random() - 0.5) * 0.01,
        longitude: 77.2090 + (Math.random() - 0.5) * 0.01,
        mocked: true
      };
    }
  }
};
export default LocationService;
