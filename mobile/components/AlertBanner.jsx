import React from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';

export default function AlertBanner({ riskScore, coords }) {
  return (
    <View style={styles.banner}>
      <View style={styles.row}>
        <Text style={styles.title}>EMERGENCY PROTOCOL ACTIVE</Text>
        <ActivityIndicator size="small" color="#ffffff" style={styles.loader} />
      </View>

      <Text style={styles.description}>
        Real-time GPS coordinates are streaming to police dispatch centers. Emergency contacts have been notified.
      </Text>

      <View style={styles.metricsContainer}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Risk Level</Text>
          <Text style={styles.metricValue}>{riskScore}%</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>GPS Status</Text>
          <Text style={styles.metricValue}>
            {coords ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : 'Resolving...'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#be123c', // deep rose-700
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1.5,
    borderColor: '#f43f5e', // rose-500
    shadowColor: '#be123c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    fontFamily: 'System',
  },
  loader: {
    marginLeft: 8,
  },
  description: {
    color: '#fda4af',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
    fontFamily: 'System',
  },
  metricsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 12,
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    color: '#f87171',
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
    fontFamily: 'System',
  },
  metricValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
});
