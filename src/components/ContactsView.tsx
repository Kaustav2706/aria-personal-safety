import React, { useState } from 'react';
import { EmergencyContact } from '../types';
import { Phone, Edit2, Plus, UserPlus, Trash, Check, X, ShieldAlert } from 'lucide-react';

interface ContactsViewProps {
  contacts: EmergencyContact[];
  onAddContact: (contact: Omit<EmergencyContact, 'id'>) => void;
  onDeleteContact: (id: string) => void;
  userAvatar: string;
}

export default function ContactsView({ 
  contacts, 
  onAddContact, 
  onDeleteContact,
  userAvatar 
}: ContactsViewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('High');
  const [avatar, setAvatar] = useState('');

  // Call simulation alert state
  const [simulatedCall, setSimulatedCall] = useState<string | null>(null);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;

    onAddContact({
      name,
      phone,
      priority,
      avatar: avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    });

    setName('');
    setPhone('');
    setPriority('High');
    setAvatar('');
    setShowAddModal(false);
  };

  const handleImportMock = () => {
    onAddContact({
      name: 'Dr. Arthur Vance',
      phone: '+1 (555) 444-1212',
      priority: 'High',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200',
    });
    alert('Imported mock contact Dr. Arthur Vance!');
  };

  return (
    <div className="pt-20 pb-36 px-6 font-sans">
      
      {/* Visual Header */}
      <header className="mb-6">
        <div className="flex items-center gap-1.5 text-xs font-bold tracking-widest text-[#72d4ef] uppercase mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#72d4ef] animate-pulse" />
          <span>Priority dispatch network</span>
        </div>
        <h2 className="text-3xl font-black text-on-surface">Emergency Contacts</h2>
        <p className="text-body-sm text-on-surface-variant mt-2 leading-relaxed">
          These individuals will be notified instantly if an emergency is detected or SOS is triggered.
        </p>
      </header>

      {/* Grid of Dynamic Contacts */}
      <div className="space-y-4">
        {contacts.map((contact) => (
          <div 
            key={contact.id} 
            className="glass-card rounded-2xl p-4 flex items-center justify-between transition-all hover:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              {/* Picture with priority tag & glow */}
              <div className="relative shrink-0">
                <div 
                  className={`w-14 h-14 rounded-full border-2 p-0.5 ${
                    contact.priority === 'High' 
                      ? 'border-primary-container priority-glow' 
                      : 'border-secondary'
                  }`}
                >
                  <img 
                    src={contact.avatar} 
                    alt={contact.name} 
                    className="w-full h-full rounded-full object-cover bg-surface-container-highest" 
                  />
                </div>
                <div 
                  className={`absolute -bottom-1 -right-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    contact.priority === 'High' 
                      ? 'bg-primary-container text-white' 
                      : 'bg-secondary text-on-secondary'
                  }`}
                >
                  {contact.priority}
                </div>
              </div>

              {/* Text metadata */}
              <div>
                <h3 className="font-semibold text-on-surface text-[16px]">{contact.name}</h3>
                <p className="text-body-sm text-on-surface-variant">{contact.phone}</p>
              </div>
            </div>

            {/* Actions for contact */}
            <div className="flex gap-2">
              <button 
                onClick={() => setSimulatedCall(contact.name)}
                className="w-10 h-10 rounded-full bg-secondary-container/20 text-secondary flex items-center justify-center hover:bg-secondary-container/40 transition-colors cursor-pointer"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button 
                onClick={() => onDeleteContact(contact.id)}
                className="w-10 h-10 rounded-full bg-surface-variant text-on-surface-variant hover:text-red-400 flex items-center justify-center hover:bg-surface-variant/80 transition-colors cursor-pointer"
                title="Remove emergency contact"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {contacts.length === 0 && (
          <div className="text-center py-12 glass-card rounded-2xl border-dashed border-2 border-outline-variant/35 text-on-surface-variant">
            No contacts added. Import or write custom contacts below.
          </div>
        )}
      </div>

      {/* Import from contacts dashed block */}
      <div className="mt-6">
        <button 
          onClick={handleImportMock}
          className="w-full h-16 glass-card rounded-2xl border-dashed border-2 border-outline-variant/30 flex items-center justify-center gap-3 text-on-surface-variant hover:text-primary hover:border-primary/50 transition-all active:scale-95 group cursor-pointer"
        >
          <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="font-bold text-title-md">Import from Contacts</span>
        </button>
      </div>

      {/* Floating Add Emergency Contact Button */}
      <div className="fixed bottom-24 left-0 right-0 max-w-md mx-auto px-6 z-40">
        <button 
          onClick={() => setShowAddModal(true)}
          className="w-full h-14 bg-primary-container text-white rounded-full font-bold text-title-md flex items-center justify-center gap-3 shadow-lg shadow-primary-container/20 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Add Emergency Contact
        </button>
      </div>

      {/* Slide up Modal to Add Contact */}
      {showAddModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-end justify-center p-6">
          <div className="glass-card w-full max-w-sm rounded-[24px] p-6 space-y-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-lg font-bold text-primary">New Contact</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-on-surface-variant hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-widest font-bold text-on-surface-variant">Full Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. John Doe"
                  className="w-full h-11 bg-surface-container-lowest text-on-surface rounded-xl border border-white/10 px-4 focus:outline-none focus:border-primary"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-widest font-bold text-on-surface-variant">Phone Number</label>
                <input 
                  type="tel" 
                  required
                  placeholder="e.g. +1 (555) 000-0000"
                  className="w-full h-11 bg-surface-container-lowest text-on-surface rounded-xl border border-white/10 px-4 focus:outline-none focus:border-primary"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-widest font-bold text-on-surface-variant">Profile Photo URL</label>
                <input 
                  type="text" 
                  placeholder="Leave blank for generic placeholder"
                  className="w-full h-11 bg-surface-container-lowest text-on-surface rounded-xl border border-white/10 px-4 focus:outline-none focus:border-primary text-xs"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-widest font-bold text-on-surface-variant">Alert priority</label>
                <div className="flex gap-2 pt-1">
                  {(['High', 'Medium', 'Low'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setPriority(lvl)}
                      className={`flex-1 h-10 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                        priority === lvl 
                          ? lvl === 'High' ? 'bg-primary-container text-white' : 'bg-secondary text-on-secondary' 
                          : 'bg-surface-container-highest/50 text-on-surface-variant'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                type="submit"
                className="w-full h-12 bg-primary-container text-white font-bold rounded-xl mt-4 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-5 h-5" />
                Save Emergency Contact
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Dial Simulation Dialog */}
      {simulatedCall && (
        <div className="fixed inset-0 bg-background/95 z-50 flex flex-col justify-between p-12">
          {/* Top Info */}
          <div className="flex flex-col items-center justify-center text-center pt-16 space-y-2">
            <div className="w-24 h-24 rounded-full border-4 border-primary priority-glow p-1">
              <div className="w-full h-full bg-surface-container-highest rounded-full flex items-center justify-center">
                <Phone className="w-10 h-10 text-primary animate-pulse" />
              </div>
            </div>
            <h2 className="text-3xl font-black text-white">{simulatedCall}</h2>
            <p className="text-title-md text-primary font-semibold animate-pulse uppercase tracking-widest text-xs">
              Simulating Priority Line Call...
            </p>
          </div>

          {/* Central message */}
          <div className="glass-card p-6 rounded-2xl max-w-xs mx-auto text-center border-primary/20 space-y-2">
            <ShieldAlert className="w-8 h-8 text-primary mx-auto animate-bounce" />
            <h4 className="font-bold text-sm">Priority ARIA Line Active</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              In a real emergency, ARIA instantly feeds direct audio + vitals + coordinates to emergency dispatch.
            </p>
          </div>

          {/* End Call Button */}
          <div className="pb-12 text-center">
            <button 
              onClick={() => setSimulatedCall(null)}
              className="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center mx-auto hover:bg-red-700 active:scale-90 transition-transform cursor-pointer"
            >
              <X className="w-8 h-8" />
            </button>
            <p className="text-xs text-on-surface-variant mt-2 font-bold uppercase tracking-widest">
              End Priority Call
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
