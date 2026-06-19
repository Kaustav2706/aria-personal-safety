import React, { useState } from 'react';
import { IncidentItem } from '../types';
import { CheckCircle2, ChevronRight, ShieldAlert, RefreshCw } from 'lucide-react';

interface HistoryViewProps {
  incidents: IncidentItem[];
  onSelectIncident: (incident: IncidentItem) => void;
  userAvatar: string;
  onRefresh?: () => Promise<void>;
}

export default function HistoryView({ incidents, onSelectIncident, userAvatar, onRefresh }: HistoryViewProps) {
  const [filterActive, setFilterActive] = useState<'All' | 'Active' | 'Resolved'>('All');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredIncidents = incidents.filter((inc) => {
    if (filterActive === 'All') return true;
    return inc.status === filterActive;
  });

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="pt-20 pb-32 px-6 font-sans select-none">
      
      {/* Visual Filter Options Headers */}
      <section className="flex gap-2 py-3 overflow-x-auto no-scrollbar scroll-smooth items-center">
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

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="ml-auto px-3 py-2 rounded-full bg-surface-container text-on-surface-variant border border-white/5 hover:border-white/10 cursor-pointer active:scale-95 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </section>

      {/* Loading skeleton */}
      {incidents.length === 0 && !isRefreshing && (
        <div className="space-y-4 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-4 rounded-2xl animate-pulse">
              <div className="h-3 w-24 bg-surface-container-highest rounded mb-2" />
              <div className="h-5 w-48 bg-surface-container-highest rounded mb-4" />
              <div className="flex justify-between">
                <div className="h-8 w-16 bg-surface-container-highest rounded" />
                <div className="h-16 w-28 bg-surface-container-highest rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

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

            {/* Middle preview detailing scores */}
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

              {/* Coordinates display */}
              <div className="px-3 py-2 rounded-xl bg-surface-container/60 border border-white/5 shrink-0">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">Location</p>
                <p className="text-[10px] font-mono text-on-surface">{incident.coordinates}</p>
              </div>
            </div>
            
            {/* View Details link footer */}
            <div className="flex justify-between items-center text-xs border-t border-white/5 pt-3 mt-1">
              <span className="text-on-surface-variant">{incident.time}</span>
              <span className="text-secondary font-black flex items-center gap-1">
                Inspect Feed
                <ChevronRight className="w-4.5 h-4.5" />
              </span>
            </div>
          </div>
        ))}

        {filteredIncidents.length === 0 && incidents.length > 0 && (
          <div className="text-center py-16 text-on-surface-variant h-48 flex flex-col justify-center gap-2">
            <ShieldAlert className="w-10 h-10 text-outline mx-auto animate-bounce" />
            <p className="font-semibold text-sm">No historical incidents match.</p>
          </div>
        )}
      </div>

    </div>
  );
}
