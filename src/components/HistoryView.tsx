import React, { useState } from 'react';
import { IncidentItem } from '../types';
import { CheckCircle2, ChevronRight, ShieldAlert } from 'lucide-react';

interface HistoryViewProps {
  incidents: IncidentItem[];
  onSelectIncident: (incident: IncidentItem) => void;
  userAvatar: string;
}

export default function HistoryView({ incidents, onSelectIncident, userAvatar }: HistoryViewProps) {
  const [filterActive, setFilterActive] = useState<'All' | 'Active' | 'Resolved'>('All');

  const filteredIncidents = incidents.filter((inc) => {
    if (filterActive === 'All') return true;
    return inc.status === filterActive;
  });

  return (
    <div className="pt-20 pb-32 px-6 font-sans select-none">
      
      {/* Visual Filter Options Headers */}
      <section className="flex gap-2 py-3 overflow-x-auto no-scrollbar scroll-smooth">
        {(['All', 'Active', 'Resolved'] as const).map((tag) => (
          <button
            key={tag}
            onClick={() => setFilterActive(tag)}
            className={`px-5 py-2 rounded-full font-semibold text-xs tracking-wider uppercase transition-all duration-200 cursor-pointer ${
              filterActive === tag
                ? 'bg-primary text-on-primary shadow-lg shadow-primary/20 scale-105'
                : 'bg-surface-container text-on-surface-variant border border-white/5 hover:border-white/10'
            }`}
          >
            {tag}
          </button>
        ))}
      </section>

      {/* List of incident logs */}
      <div className="space-y-4 mt-2">
        {filteredIncidents.map((incident) => (
          <div 
            key={incident.id} 
            onClick={() => onSelectIncident(incident)}
            className="glass-card p-4 rounded-2xl flex flex-col gap-4 transition-all duration-200 active:scale-[0.99] hover:border-primary/25 cursor-pointer shadow-lg"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">
                  {incident.date}
                </p>
                <h3 className="text-[17px] font-black text-on-surface">
                  {incident.title}
                </h3>
              </div>

              {/* Status capsule badge */}
              <div className="status-pill px-3 py-1 rounded-full flex items-center gap-1.5 bg-surface-container/60 border border-white/5">
                <span className={`w-2.5 h-2.5 rounded-full ${incident.status === 'Active' ? 'bg-primary animate-ping' : 'bg-secondary'}`} />
                <span className={`text-[10px] font-black uppercase tracking-wider ${incident.status === 'Active' ? 'text-primary' : 'text-secondary'}`}>
                  {incident.status}
                </span>
              </div>
            </div>

            {/* Middle preview detailing scores & thumbnail coords map mock */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black text-primary leading-none">
                    {incident.riskScore}
                  </span>
                  <span className="text-xs text-on-surface-variant font-bold pb-0.5">
                    /100
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant uppercase font-bold tracking-wider mt-1">Risk Score</p>
              </div>

              {/* Thumbnail Map image */}
              <div className="w-32 h-20 rounded-xl overflow-hidden border border-white/10 shrink-0 select-none">
                <img 
                  src={incident.mapImage} 
                  alt="Incident Map" 
                  className="w-full h-full object-cover opacity-60" 
                />
              </div>
            </div>
            
            {/* View Details link footer */}
            <div className="flex justify-between items-center text-xs border-t border-white/5 pt-3 mt-1">
              <span className="text-on-surface-variant">Coordinates: {incident.coordinates}</span>
              <span className="text-secondary font-black flex items-center gap-1">
                Inspect Feed
                <ChevronRight className="w-4.5 h-4.5" />
              </span>
            </div>
          </div>
        ))}

        {filteredIncidents.length === 0 && (
          <div className="text-center py-16 text-on-surface-variant h-48 flex flex-col justify-center gap-2">
            <ShieldAlert className="w-10 h-10 text-outline mx-auto animate-bounce" />
            <p className="font-semibold text-sm">No historical incidents match.</p>
          </div>
        )}
      </div>

    </div>
  );
}
