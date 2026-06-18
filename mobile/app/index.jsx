import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

// Simple global memory session for hackathon demo
export const session = {
  token: null,
  user: null
};

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Check if user session exists. If not, route to onboarding.
    const checkSession = async () => {
      // Simulate delay for splash check
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (session.token) {
        router.replace('/dashboard');
      } else {
        router.replace('/onboarding');
      }
    };
    checkSession();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#e11d48" />
      <Text style={styles.text}>A R I A</Text>
      <Text style={styles.subtext}>AI Real-time Incident Assistant</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 8,
    marginTop: 24,
    fontFamily: 'System',
  },
  subtext: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 8,
    fontWeight: 'bold',
    letterSpacing: 1,
    fontFamily: 'System',
  },
});
