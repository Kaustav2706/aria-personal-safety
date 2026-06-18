import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function StatusIndicator({ status }) {
  // Config styles and labels dynamically based on status state
  const config = {
    safe: {
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      label: 'SHIELD ACTIVE: SAFE',
    },
    monitoring: {
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.12)',
      label: 'AI SENSORS LIVE',
    },
    threat: {
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.15)',
      label: 'SOS ALARM DISPATCHED',
    },
  }[status || 'safe'];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.color + '40' }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'center',
    marginVertical: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.2,
    fontFamily: 'System',
  },
});
