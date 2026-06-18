let listenInterval = null;

export const AudioDetection = {
  startListening(onTriggerDetected) {
    console.log('[AUDIO DETECTOR] Acoustic monitoring started. Scanning ambient audio...');
    
    // Simulate periodic background audio scans
    listenInterval = setInterval(() => {
      // 5% chance of random distress detection trigger for hackathon demonstration
      const randomTrigger = Math.random() < 0.05;
      if (randomTrigger && onTriggerDetected) {
        console.log('[AUDIO DETECTOR] Voice distress trigger matched in background stream!');
        const detection = this.mockDistressDetection();
        onTriggerDetected(detection);
      }
    }, 4000);
  },

  stopListening() {
    if (listenInterval) {
      clearInterval(listenInterval);
      listenInterval = null;
      console.log('[AUDIO DETECTOR] Acoustic monitoring stopped.');
    }
  },

  /**
   * Simulates immediate AI distress word classification from speech stream
   */
  mockDistressDetection() {
    return {
      distress: true,
      confidence: 91,
      transcript: "Help me please, someone help!"
    };
  }
};

export default AudioDetection;
