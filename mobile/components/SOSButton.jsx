import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, Animated, View } from 'react-native';

export default function SOSButton({ onPress }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Loop animation to represent a pulsing heart/safety trigger
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      {/* Pulse Rings */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            transform: [{ scale: pulseAnim }],
            opacity: pulseAnim.interpolate({
              inputRange: [1, 1.25],
              outputRange: [0.6, 0.1],
            }),
          },
        ]}
      />
      
      <TouchableOpacity 
        activeOpacity={0.85} 
        onPress={onPress} 
        style={styles.button}
      >
        <Text style={styles.buttonText}>SOS</Text>
        <Text style={styles.subText}>PRESS & HOLD</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
    position: 'relative',
    height: 180,
    width: 180,
    alignSelf: 'center',
  },
  button: {
    backgroundColor: '#e11d48', // rose-600
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#fda4af', // rose-300
    zIndex: 3,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: 'System',
  },
  subText: {
    color: '#fda4af',
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 4,
    letterSpacing: 1,
    fontFamily: 'System',
  },
  pulseRing: {
    position: 'absolute',
    backgroundColor: '#f43f5e',
    width: 160,
    height: 160,
    borderRadius: 80,
    zIndex: 1,
  },
});
