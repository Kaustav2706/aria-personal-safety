import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { session } from './index.jsx';

const BACKEND_URL = 'http://localhost:5000/api';

export default function Profile() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contacts, setContacts] = useState([]);
  
  // New Contact states
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (session.user) {
      setName(session.user.name || '');
      setPhone(session.user.phone || '');
      setContacts(session.user.emergencyContacts || []);
    }
  }, []);

  const handleAddContact = () => {
    if (!newContactName || !newContactPhone) {
      Alert.alert('Required Info', 'Emergency contact needs both Name and Phone details.');
      return;
    }

    setContacts(prev => [...prev, { name: newContactName, phone: newContactPhone }]);
    setNewContactName('');
    setNewContactPhone('');
  };

  const handleRemoveContact = (index) => {
    setContacts(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveProfile = async () => {
    if (!name || !phone) {
      Alert.alert('Required Info', 'Name and Phone inputs are required.');
      return;
    }

    setSaving(true);
    try {
      const token = session.token;
      const res = await axios.put(
        `${BACKEND_URL}/user/profile`,
        { name, phone, emergencyContacts: contacts },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Sync updated user to local session store
      session.user = res.data.user;
      Alert.alert('Settings Saved', 'Profile configuration updated successfully.');
      router.back();
    } catch (err) {
      console.error('[PROFILE] Error saving profile updates:', err.response?.data || err.message);
      Alert.alert('Error', 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personal Telemetry</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          placeholder="Name"
          placeholderTextColor="#6b7280"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />

        <Text style={styles.label}>Primary Phone</Text>
        <TextInput
          placeholder="Phone"
          placeholderTextColor="#6b7280"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          style={styles.input}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Emergency SOS Contacts</Text>
        <Text style={styles.simDescription}>
          Register contacts to receive automated SMS alerts with real-time GPS locations when you trigger an SOS signal.
        </Text>

        {/* Existing Contacts List */}
        <View style={styles.contactList}>
          {contacts.map((contact, index) => (
            <View key={index} style={styles.contactItem}>
              <View>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactPhone}>{contact.phone}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => handleRemoveContact(index)}
                style={styles.removeBtn}
              >
                <Text style={styles.removeBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
          {contacts.length === 0 && (
            <Text style={styles.emptyContactsText}>No emergency backup contacts listed.</Text>
          )}
        </View>

        {/* New Contact Inputs Form */}
        <Text style={styles.subTitle}>Register New Contact</Text>
        
        <Text style={styles.label}>Contact Name</Text>
        <TextInput
          placeholder="Name"
          placeholderTextColor="#6b7280"
          value={newContactName}
          onChangeText={setNewContactName}
          style={styles.input}
        />

        <Text style={styles.label}>Contact Phone</Text>
        <TextInput
          placeholder="Phone number"
          placeholderTextColor="#6b7280"
          keyboardType="phone-pad"
          value={newContactPhone}
          onChangeText={setNewContactPhone}
          style={styles.input}
        />

        <TouchableOpacity 
          onPress={handleAddContact}
          style={styles.addBtn}
        >
          <Text style={styles.addBtnText}>Add to Backup List</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        onPress={handleSaveProfile} 
        disabled={saving}
        style={styles.saveBtn}
      >
        <Text style={styles.saveBtnText}>
          {saving ? 'Processing Save...' : 'Save Complete Settings'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#0b0f19',
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#161d30',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2b395b',
    marginVertical: 10,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2b395b',
    paddingBottom: 6,
    fontFamily: 'System',
  },
  subTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 6,
    fontFamily: 'System',
  },
  label: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 12,
    fontFamily: 'System',
  },
  input: {
    backgroundColor: '#0b0f19',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2b395b',
    color: '#ffffff',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'System',
  },
  simDescription: {
    color: '#9ca3af',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 14,
    fontFamily: 'System',
  },
  contactList: {
    marginVertical: 10,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0b0f19',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#2b395b',
  },
  contactName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  contactPhone: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: 'System',
  },
  removeBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  removeBtnText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  emptyContactsText: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 10,
    fontStyle: 'italic',
    fontFamily: 'System',
  },
  addBtn: {
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  addBtnText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 13,
    fontFamily: 'System',
  },
  saveBtn: {
    backgroundColor: '#10b981', // green-500
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginVertical: 20,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
});
