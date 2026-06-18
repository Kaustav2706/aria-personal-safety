import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { session } from './index.jsx';

const BACKEND_URL = 'http://localhost:5000/api';

export default function Onboarding() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password || (!isLogin && (!name || !phone))) {
      Alert.alert('Required Fields Missing', 'Please fill in all necessary fields.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        // Authenticate
        const res = await axios.post(`${BACKEND_URL}/auth/login`, { email, password });
        session.token = res.data.token;
        session.user = res.data.user;
        router.replace('/dashboard');
      } else {
        // Register user
        const res = await axios.post(`${BACKEND_URL}/auth/register`, {
          name,
          email,
          phone,
          password,
          emergencyContacts: [
            { name: 'Police Helpline', phone: '100' },
            { name: 'Women Helpline', phone: '1091' }
          ]
        });
        session.token = res.data.token;
        session.user = res.data.user;
        Alert.alert('Account Created', 'Registration successful. Added baseline emergency helpers.');
        router.replace('/dashboard');
      }
    } catch (err) {
      console.error('Authentication error:', err.response?.data || err.message);
      Alert.alert('Auth Failed', err.response?.data?.error || 'Server connection refused.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.logo}>ARIA</Text>
          <Text style={styles.tagline}>AI-Powered Safety & Rescue Assistant</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
          
          {!isLogin && (
            <>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                placeholder="Name"
                placeholderTextColor="#6b7280"
                value={name}
                onChangeText={setName}
                style={styles.input}
              />
            </>
          )}

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            placeholder="name@email.com"
            placeholderTextColor="#6b7280"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />

          {!isLogin && (
            <>
              <Text style={styles.label}>Primary Phone</Text>
              <TextInput
                placeholder="Phone number"
                placeholderTextColor="#6b7280"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                style={styles.input}
              />
            </>
          )}

          <Text style={styles.label}>Password</Text>
          <TextInput
            placeholder="Password"
            placeholderTextColor="#6b7280"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />

          <TouchableOpacity 
            onPress={handleSubmit} 
            disabled={loading}
            style={styles.btn}
          >
            <Text style={styles.btnText}>
              {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setIsLogin(!isLogin)} 
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>
              {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    color: '#e11d48',
    fontSize: 42,
    fontWeight: '950',
    letterSpacing: 4,
    fontFamily: 'System',
  },
  tagline: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    fontFamily: 'System',
  },
  card: {
    backgroundColor: '#161d30',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2b395b',
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
    fontFamily: 'System',
  },
  label: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 14,
    fontFamily: 'System',
  },
  input: {
    backgroundColor: '#0b0f19',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2b395b',
    color: '#ffffff',
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: 'System',
  },
  btn: {
    backgroundColor: '#e11d48',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  toggle: {
    alignItems: 'center',
    marginTop: 20,
  },
  toggleText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'System',
  },
});
