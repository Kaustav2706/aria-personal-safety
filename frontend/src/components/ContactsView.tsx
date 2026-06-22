import React, { useState } from 'react';
import { EmergencyContact } from '../types';
import { UserPlus, Trash2, Phone, Shield, AlertCircle } from 'lucide-react';

interface ContactsViewProps {
  contacts: EmergencyContact[];
  onAddContact: (contact: Omit<EmergencyContact, 'id'>) => void;
  onDeleteContact: (id: string) => void;
  userAvatar: string;
}

export default function ContactsView({ contacts, onAddContact, onDeleteContact, userAvatar }: ContactsViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    setError('');
    if (!newName.trim() || !newPhone.trim()) {
      setError('Name and phone number are required.');
      return;
    }

    onAddContact({
      name: newName.trim(),
      phone: newPhone.trim(),
      priority: 'High',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newName.trim())}&background=2c1b1a&color=fadcd8&size=200`,
    });

    setNewName('');
    setNewPhone('');
    setShowAddForm(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Remove ${name} from your emergency contacts?`)) {
      onDeleteContact(id);
    }
  };

  return (
    <div className="pt-20 pb-36 px-6 font-sans select-none animate-fade-in-scale">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-2.5 border-b border-white/10">
        <div>
          <h2 className="text-2xl font-black text-gradient bg-gradient-to-r from-primary via-white to-primary">Emergency Contacts</h2>
          <p className="text-[10px] text-on-surface-variant/60 font-black uppercase tracking-widest mt-0.5">
            {contacts.length} contacts configured
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-primary-container text-on-primary flex items-center justify-center hover:shadow-[0_0_15px_rgba(255,180,172,0.4)] shadow-[0_4px_12px_rgba(255,180,172,0.2)] active:scale-95 transition-all cursor-pointer relative overflow-hidden shimmer"
        >
          <UserPlus className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Add Contact Form */}
      {showAddForm && (
        <div className="glass-card-elevated rounded-3xl p-6 mb-6 border border-primary/15 animate-in fade-in duration-200 space-y-4 relative overflow-hidden gradient-border hover-lift">
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-primary/10 rounded-full blur-[40px] pointer-events-none" />
          <div className="absolute inset-0 dot-grid opacity-15 pointer-events-none" />

          <h3 className="text-xs font-black text-primary uppercase tracking-widest relative z-10">Add Emergency Contact</h3>
          
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-error-container/20 border border-error/30 relative z-10">
              <AlertCircle className="w-4 h-4 text-error shrink-0" />
              <p className="text-xs text-error font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-3 relative z-10">
            <div className="relative rounded-xl border border-white/10 bg-surface-container-lowest focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200">
              <input
                type="text"
                placeholder="Contact Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full h-11 bg-transparent text-on-surface px-4 text-sm focus:outline-none placeholder:text-on-surface-variant/40"
              />
            </div>
            <div className="relative rounded-xl border border-white/10 bg-surface-container-lowest focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200">
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full h-11 bg-transparent text-on-surface px-4 text-sm focus:outline-none placeholder:text-on-surface-variant/40"
              />
            </div>
          </div>

          <div className="flex gap-3.5 pt-1.5 relative z-10">
            <button
              onClick={() => { setShowAddForm(false); setError(''); }}
              className="flex-1 h-11 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-white/5 text-on-surface-variant font-bold text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-secondary-container via-secondary to-secondary-container text-white font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-[0_0_12px_rgba(51,148,241,0.25)] active:scale-[0.98] transition-all cursor-pointer shimmer animate-gradient-shift"
            >
              Add Contact
            </button>
          </div>
        </div>
      )}

      {/* Contacts List */}
      <div className="space-y-3">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="glass-card p-4 rounded-3xl flex items-center gap-4 border border-white/5 transition-all hover:border-primary/20 hover-lift gradient-border"
          >
            {/* Avatar container with gradient ring */}
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-primary/20 bg-surface-container-highest shadow-md relative z-10">
                <img
                  src={contact.avatar}
                  alt={contact.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary to-secondary opacity-15 blur-sm -m-0.5 animate-pulse" />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-white text-[15px] truncate">{contact.name}</h4>
              <p className="text-xs text-on-surface-variant/60 font-semibold truncate mt-0.5">{contact.phone}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => alert(`Calling ${contact.name}...`)}
                className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center text-secondary hover:bg-secondary/20 active:scale-90 border border-secondary/20 hover:shadow-[0_0_10px_rgba(162,201,255,0.2)] transition-all cursor-pointer"
                title={`Call ${contact.name}`}
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(contact.id, contact.name)}
                className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 active:scale-90 border border-primary/20 hover:shadow-[0_0_10px_rgba(255,180,172,0.2)] transition-all cursor-pointer"
                title={`Remove ${contact.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state placeholder */}
      {contacts.length === 0 && (
        <div className="text-center py-20 px-6 glass-card-elevated rounded-3xl border border-white/5 space-y-6 mt-4 hover-lift relative overflow-hidden animate-in fade-in duration-300">
          {/* Ambient background glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none" />
          <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none" />

          <div className="relative z-10 w-16 h-16 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto shadow-md">
            <Shield className="w-8 h-8 text-primary animate-pulse" />
          </div>

          <div className="relative z-10 space-y-2 max-w-xs mx-auto">
            <h4 className="text-sm font-black text-white uppercase tracking-widest text-gradient bg-gradient-to-r from-primary to-[#ffcec8]">No contacts configured</h4>
            <p className="text-xs text-on-surface-variant/80 leading-relaxed font-medium">
              You haven't configured any emergency contacts yet. Distresses will fallback to generic alerts.
            </p>
            <p className="text-[10px] text-primary/70 font-semibold tracking-wide uppercase pt-2">
              Tap the + button above to add one
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
