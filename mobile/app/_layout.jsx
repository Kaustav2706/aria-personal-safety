import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#161d30',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontFamily: 'System',
          },
          contentStyle: {
            backgroundColor: '#0b0f19',
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ title: 'ARIA Safety Hub', headerShown: false }} />
        <Stack.Screen name="profile" options={{ title: 'Emergency Profile' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
