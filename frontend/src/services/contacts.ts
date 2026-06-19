/**
 * ARIA Contacts Service — Local Persistence Layer
 * Stores emergency contacts in localStorage.
 * Architecture supports seamless migration to backend API when available.
 */

import { EmergencyContact } from '../types';

const CONTACTS_KEY = 'aria_emergency_contacts';

/** Retrieve all stored contacts */
export function getContacts(): EmergencyContact[] {
  const raw = localStorage.getItem(CONTACTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Overwrite all contacts */
export function saveContacts(contacts: EmergencyContact[]): void {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

/** Add a single contact */
export function addContact(contact: Omit<EmergencyContact, 'id'>): EmergencyContact {
  const contacts = getContacts();
  const created: EmergencyContact = {
    ...contact,
    id: `c-${Date.now()}`,
  };
  contacts.push(created);
  saveContacts(contacts);
  return created;
}

/** Remove a contact by ID */
export function removeContact(id: string): void {
  const contacts = getContacts().filter((c) => c.id !== id);
  saveContacts(contacts);
}

/** Seed default contacts only if none exist */
export function seedDefaultContacts(defaults: EmergencyContact[]): void {
  const existing = getContacts();
  if (existing.length === 0) {
    saveContacts(defaults);
  }
}
