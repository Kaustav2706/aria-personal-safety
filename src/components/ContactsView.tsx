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
  const [newPriority, setNewPriority] = useState<'High' | 'Medium' | 'Low'>('High');
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
      priority: newPriority,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newName.trim())}&background=2c1b1a&color=fadcd8&size=200`,
    });

    setNewName('');
    setNewPhone('');
    setNewPriority('High');
    setShowAddForm(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Remove ${name} from your emergency contacts?`)) {
      onDeleteContact(id);
    }
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case 'High': return 'text-primary bg-primary/10 border-primary/20';
      case 'Medium': return 'text-secondary bg-secondary/10 border-secondary/20';
      case 'Low': return 'text-tertiary bg-tertiary/10 border-tertiary/20';
      default: return 'text-on-surface-variant bg-surface-container border-white/10';
    }
  };

  return (
    <div className="pt-20 pb-32 px-6 font-sans select-none">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-on-surface">Emergency Contacts</h2>
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">
            {contacts.length} contacts configured
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-lg shadow-primary/20"
        >
          <UserPlus className="w-5 h-5" />
        </button>
      </div>

      {/* Add Contact Form */}
      {showAddForm && (
        <div className="glass-card rounded-2xl p-5 mb-6 border border-primary/15 animate-in fade-in duration-200 space-y-3">
          <h3 className="text-sm font-black text-primary uppercase tracking-wider">Add New Contact</h3>
          
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-error-container/20 border border-error/30">
              <AlertCircle className="w-4 h-4 text-error shrink-0" />
              <p className="text-xs text-error font-medium">{error}</p>
            </div>
          )}

          <input
            type="text"
            placeholder="Contact Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full h-11 bg-surface-container-lowest text-on-surface rounded-xl border border-white/10 px-4 text-sm focus:outline-none focus:border-primary"
          />
          <input
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            className="w-full h-11 bg-surface-container-lowest text-on-surface rounded-xl border border-white/10 px-4 text-sm focus:outline-none focus:border-primary"
          />

          <div className="flex gap-2">
            {(['High', 'Medium', 'Low'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setNewPriority(p)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                  newPriority === p 
                    ? priorityColor(p)
                    : 'bg-surface-container text-on-surface-variant border-white/5'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setShowAddForm(false); setError(''); }}
              className="flex-1 h-11 rounded-xl bg-surface-container text-on-surface-variant font-bold text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="flex-1 h-11 rounded-xl bg-primary text-on-primary font-bold text-sm cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all"
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
            className="glass-card p-4 rounded-2xl flex items-center gap-4 border border-white/5 transition-all hover:border-primary/15"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden border border-primary/10 shrink-0">
              <img
                src={contact.avatar}
                alt={contact.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-on-surface text-[15px] truncate">{contact.name}</h4>
              <p className="text-xs text-on-surface-variant font-medium truncate">{contact.phone}</p>
            </div>

            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border shrink-0 ${priorityColor(contact.priority)}`}>
              {contact.priority}
            </span>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => alert(`Calling ${contact.name}...`)}
                className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center text-secondary hover:bg-secondary/20 active:scale-90 transition-all cursor-pointer"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(contact.id, contact.name)}
                className="w-9 h-9 rounded-full bg-error/10 flex items-center justify-center text-error hover:bg-error/20 active:scale-90 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {contacts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 text-on-surface-variant">
          <Shield className="w-12 h-12 opacity-30" />
          <p className="text-sm font-semibold">No emergency contacts yet.</p>
          <p className="text-xs opacity-60">Tap the + button to add your first contact.</p>
        </div>
      )}
    </div>
  );
}
