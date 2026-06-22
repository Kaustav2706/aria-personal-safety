import React, { useState } from 'react';
import { IncidentItem } from '../types';
import { CheckCircle2, ChevronRight, ShieldAlert, RefreshCw, Trash, Calendar, Clock, MapPin } from 'lucide-react';

interface HistoryViewProps {
  incidents: IncidentItem[];
  onSelectIncident: (incident: IncidentItem) => void;
  userAvatar: string;
  onRefresh?: () => Promise<void>;
  onDeleteIncident?: (id: string) => void;
  onResolveIncident?: (id: string) => void;
  isLoading?: boolean;
}

export default function HistoryView({ 
  incidents, 
  onSelectIncident, 
  userAvatar, 
  onRefresh, 
  onDeleteIncident, 
  onResolveIncident,
  isLoading = false
}: HistoryViewProps) {
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
    <div className="pt-20 pb-36 px-6 font-sans select-none animate-fade-in-scale">
      
      {/* Visual Filter Options Headers */}
      <section className="flex gap-2.5 py-3 overflow-x-auto no-scrollbar scroll-smooth items-center relative z-10">
        {(['All', 'Active', 'Resolved'] as const).map((tag) => (
          <button
            key={tag}
            onClick={() => setFilterActive(tag)}
            className={`px-5 py-2 rounded-full font-black text-[10px] tracking-wider uppercase transition-all duration-200 cursor-pointer ${
              filterActive === tag
                ? 'bg-primary text-on-primary shadow-lg shadow-primary/20 scale-102'
                : 'bg-surface-container-high/60 text-on-surface-variant/80 border border-white/5 hover:border-white/10 hover:bg-surface-container-highest/60'
            }`}
          >
            {tag}
          </button>
        ))}

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="ml-auto p-2 rounded-full bg-surface-container-high/60 text-on-surface-variant/80 hover:text-primary border border-white/5 hover:border-white/10 cursor-pointer active:scale-90 transition-all"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </section>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4 mt-4 relative z-10">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-5 rounded-3xl animate-pulse border border-white/5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="h-3 w-16 bg-surface-container-highest rounded" />
                  <div className="h-5.5 w-32 bg-surface-container-highest rounded" />
                </div>
                <div className="h-6 w-16 bg-surface-container-highest rounded-full" />
              </div>
              <div className="flex items-center gap-4 pt-1">
                <div className="flex-1 space-y-2">
                  <div className="h-8 w-14 bg-surface-container-highest rounded" />
                  <div className="h-3 w-20 bg-surface-container-highest rounded" />
                </div>
                <div className="h-10 w-28 bg-surface-container-highest rounded-xl" />
              </div>
              <div className="flex justify-between items-center pt-3.5 border-t border-white/5">
                <div className="h-3.5 w-12 bg-surface-container-highest rounded" />
                <div className="h-3.5 w-20 bg-surface-container-highest rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State placeholder */}
      {!isLoading && filteredIncidents.length === 0 && (
        <div className="text-center py-20 px-6 glass-card-elevated rounded-3xl border border-white/5 space-y-6 mt-4 hover-lift relative overflow-hidden animate-in fade-in duration-300">
          {/* Subtle background glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-secondary/5 rounded-full blur-[40px] pointer-events-none" />
          <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none" />

          <div className="relative z-10 w-16 h-16 bg-secondary/10 border border-secondary/20 rounded-full flex items-center justify-center mx-auto shadow-md">
            <CheckCircle2 className="w-8 h-8 text-secondary" />
          </div>

          <div className="relative z-10 space-y-2 max-w-xs mx-auto">
            <h4 className="text-sm font-black text-white uppercase tracking-widest text-gradient bg-gradient-to-r from-secondary to-[#c0dcff]">No records found</h4>
            <p className="text-xs text-on-surface-variant/80 leading-relaxed font-medium">
              You haven't recorded any incidents or safety distress logs yet. All safety parameters are nominal.
            </p>
          </div>
        </div>
      )}

      {/* List of incident logs */}
      {!isLoading && filteredIncidents.length > 0 && (
        <div className="space-y-4 mt-2 relative z-10">
          {filteredIncidents.map((incident) => (
            <div 
              key={incident.id} 
              onClick={() => onSelectIncident(incident)}
              className="glass-card p-5 rounded-3xl flex flex-col gap-4 transition-all duration-200 active:scale-[0.99] hover:border-primary/20 hover-lift cursor-pointer shadow-lg gradient-border"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[9px] font-black text-on-surface-variant/60 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-secondary" />
                    {incident.date}
                  </p>
                  <h3 className="text-base font-black text-white tracking-wide">
                    {incident.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status capsule badge */}
                  <div className="status-pill px-3 py-1 rounded-full flex items-center gap-1.5 bg-surface-container/60 border border-white/5">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${incident.status === 'Active' ? 'bg-primary opacity-75' : 'bg-secondary opacity-75'}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${incident.status === 'Active' ? 'bg-primary' : 'bg-secondary'}`}></span>
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-wider ${incident.status === 'Active' ? 'text-primary' : 'text-secondary'}`}>
                      {incident.status}
                    </span>
                  </div>

                  {onDeleteIncident && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteIncident(incident.id);
                      }}
                      className="p-1.5 rounded-lg bg-surface-container/60 hover:bg-primary/10 text-on-surface-variant/70 hover:text-primary border border-white/5 hover:border-primary/20 transition-all cursor-pointer active:scale-90"
                      title="Delete incident"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Middle preview detailing scores */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-end gap-1 leading-none">
                    <span className="text-3.5xl font-black text-gradient bg-gradient-to-r from-primary to-[#ffcec8]">
                      {incident.riskScore}
                    </span>
                    <span className="text-[10px] text-on-surface-variant/50 font-bold pb-1">
                      /100
                    </span>
                  </div>
                  <p className="text-[9px] text-on-surface-variant/50 uppercase font-black tracking-widest mt-1">Risk Score</p>
                </div>

                {/* Coordinates display */}
                <div className="px-3.5 py-2 rounded-xl bg-surface-container/60 border border-white/5 shrink-0 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-secondary" />
                  <div>
                    <p className="text-[8px] font-black text-on-surface-variant/50 uppercase tracking-widest">Location</p>
                    <p className="text-[9px] font-mono font-bold text-white mt-0.5">{incident.coordinates}</p>
                  </div>
                </div>
              </div>
              
              {/* View Details link footer */}
              <div className="flex justify-between items-center text-xs border-t border-white/5 pt-3.5 mt-1">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-on-surface-variant/70 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-on-surface-variant/50" />
                    {incident.time}
                  </span>
                  {incident.status === 'Active' && onResolveIncident && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onResolveIncident(incident.id);
                      }}
                      className="px-2.5 py-1 rounded bg-secondary/10 hover:bg-secondary/20 text-secondary text-[9px] font-black uppercase tracking-wider border border-secondary/20 transition-all cursor-pointer active:scale-95"
                    >
                      Resolve
                    </button>
                  )}
                </div>
                <span className="text-secondary hover:text-[#c0dcff] font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-colors">
                  Inspect Feed
                  <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
