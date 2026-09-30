import { Accelerometer } from 'expo-sensors';

let subscription = null;
let lastX = 0, lastY = 0, lastZ = 0;

export const MotionDetection = {
  startFallDetection(onFallDetected) {
    console.log('[MOTION DETECTOR] Fall monitoring started. Reading accelerometer telemetry...');

    // Set update speed (100ms interval)
    Accelerometer.setUpdateInterval(100);

    subscription = Accelerometer.addListener(accelerometerData => {
      const { x, y, z } = accelerometerData;

      // Calculate net magnitude of G-force acceleration
      const gForce = Math.sqrt(x * x + y * y + z * z);

      // G-force threshold of 2.8G represents a heavy abrupt change / fall
      if (gForce > 2.8) {
        console.log(`[MOTION DETECTOR] Abrupt deceleration spike! Net G: ${gForce.toFixed(2)}`);

        if (onFallDetected) {
          onFallDetected({
            fallDetected: true,
            gForce: parseFloat(gForce.toFixed(2)),
            // Confidence is fixed at 88% for a threshold-crossing event.
            // A production system would use a trained classifier here.
            confidence: 88,
          });
        }
      }

      lastX = x;
      lastY = y;
      lastZ = z;
    });
  },

  stopFallDetection() {
    if (subscription) {
      subscription.remove();
      subscription = null;
      console.log('[MOTION DETECTOR] Fall monitoring stopped.');
    }
  },
};

export default MotionDetection;
