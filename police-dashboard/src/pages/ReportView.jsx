import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, 
  Download, 
  ShieldAlert, 
  MapPin, 
  User, 
  Phone, 
  Volume2, 
  Play, 
  Pause, 
  Clock, 
  Crosshair, 
  FileText, 
  Radio, 
  Lock 
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const POLICE_API_KEY = import.meta.env.VITE_POLICE_API_KEY || '';
const policeHeaders = { 'X-Police-API-Key': POLICE_API_KEY };

export default function ReportView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [pdfLink, setPdfLink] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    fetchIncidentDetails();
  }, [id]);

  const fetchIncidentDetails = async () => {
    try {
      const res = await axios.get(`${API_BASE}/police/incidents/${id}`, { headers: policeHeaders });
      setData(res.data);
    } catch (err) {
      console.error('Error loading incident details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setDownloading(true);
    try {
      const res = await axios.post(`${API_BASE}/police/report/generate`, { incidentId: id }, { headers: policeHeaders });
      setPdfLink(res.data.reportUrl);
      window.open(res.data.reportUrl, '_blank');
      if (window.showToast) window.showToast('PDF report compiled successfully.', 'success');
    } catch (err) {
      console.error('Error generating PDF report:', err);
      if (window.showToast) window.showToast('Failed to compile PDF report.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.warn('Audio playback simulation note:', e.message));
      setIsPlaying(true);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '40px 0' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: i === 1 ? '48px' : '200px', width: '100%', borderRadius: '12px' }} />
        ))}
      </div>
    );
  }

  if (!data || !data.incident) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '80px' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldAlert size={28} style={{ color: 'var(--color-danger)' }} />
        </div>
        <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 800 }}>Incident Dossier Not Found</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>The requested security incident archive could not be located</p>
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ marginTop: '8px', borderRadius: '8px' }}>
          <ArrowLeft size={14} /> Return to Dashboard
        </button>
      </div>
    );
  }

  const { incident, user } = data;
  const isHighRisk = incident.riskScore >= 70;
  const riskColor = isHighRisk ? 'var(--color-danger)' : incident.riskScore >= 40 ? 'var(--color-warning)' : 'var(--color-success)';
  const mockAudioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

  return (
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Hidden audio player */}
      <audio ref={audioRef} src={mockAudioUrl} onEnded={() => setIsPlaying(false)} style={{ display: 'none' }} />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ fontSize: '0.78rem', borderRadius: '8px' }}>
          <ArrowLeft size={15} /> Back to Archive
        </button>
        <div style={{ display: 'flex', gap: '10px' }}>
          {pdfLink && (
            <a href={pdfLink} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: '0.78rem', textDecoration: 'none', borderRadius: '8px' }}>
              Open PDF Document
            </a>
          )}
          <button className="btn btn-danger" onClick={handleGenerateReport} disabled={downloading} style={{ fontSize: '0.78rem', borderRadius: '8px', fontWeight: 800 }}>
            <Download size={14} />
            {downloading ? 'Compiling Dossier...' : 'Download Security PDF'}
          </button>
        </div>
      </div>

      {/* ── Main Content Grid ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>

        {/* ── Left: Incident Dossier ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Title Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', overflow: 'hidden', padding: '28px' }}>
            
            {/* Classified Diagonal Watermark */}
            <div className="dossier-watermark">CONFIDENTIAL</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <FileText size={20} style={{ color: 'var(--text-accent)' }} />
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                    Incident Threat Dossier
                  </h3>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  REF: {incident.id?.toUpperCase()} • {new Date(incident.createdAt).toLocaleString()}
                </p>
              </div>
              <span className={`badge ${incident.status === 'active' ? 'badge-danger border-glow-red' : 'badge-success'}`} style={{ fontSize: '0.68rem', fontWeight: 800 }}>
                {incident.status === 'active' ? '● ACTIVE EMERGENCY' : '✓ FILE RESOLVED'}
              </span>
            </div>

            <div className="section-divider" style={{ zIndex: 1 }} />

            {/* Detail Fields Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', zIndex: 1 }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>
                  Trigger Mechanism
                </span>
                <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 800 }}>
                  {incident.triggerType} Channel
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>
                  Dispatch Status
                </span>
                <span className={`badge ${incident.status === 'active' ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.6rem', fontWeight: 800 }}>
                  {incident.status === 'active' ? 'DISPATCHED' : 'RESOLVED'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  <Crosshair size={10} style={{ color: 'var(--text-muted)' }} /> Triangulated Latitude
                </span>
                <strong style={{ color: '#fff', fontSize: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  {incident.latitude?.toFixed(6)}°
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  <Crosshair size={10} style={{ color: 'var(--text-muted)' }} /> Triangulated Longitude
                </span>
                <strong style={{ color: '#fff', fontSize: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  {incident.longitude?.toFixed(6)}°
                </strong>
              </div>
            </div>
          </div>

          {/* Audio Evidence Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Volume2 size={16} style={{ color: 'var(--color-cyan)' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>Acoustic Voice Evidence</span>
              </div>
              <button className="btn btn-ghost" onClick={togglePlayAudio} style={{ padding: '6px 14px', fontSize: '0.72rem', borderRadius: '6px', fontWeight: 800 }}>
                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                {isPlaying ? 'Pause evidence' : 'Play evidence'}
              </button>
            </div>

            {/* Custom animated CSS waveform visualizer */}
            <div className={`audio-waveform-container ${isPlaying ? 'playing' : ''}`}>
              {Array.from({ length: 32 }).map((_, i) => (
                <div key={i} className="waveform-bar" style={{ height: isPlaying ? undefined : `${Math.max(10, Math.sin(i * 0.4) * 40 + 50)}%` }} />
              ))}
            </div>

            <div style={{
              padding: '14px 18px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              borderLeft: '3.5px solid var(--color-cyan)',
              fontSize: '0.85rem',
              fontStyle: 'italic',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}>
              {incident.audioTranscript ? `"${incident.audioTranscript}"` : 'No voice distress text captured in this record session.'}
            </div>
          </div>

          {/* Timeline Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '24px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={15} style={{ color: 'var(--text-accent)' }} />
              Emergency Event Timeline
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '6px' }}>
              {[
                { color: 'var(--color-danger)', title: 'SOS Beacon Activated', desc: 'Real-time GPS coordinates and user alert profile streamed to local police server.', done: true },
                { color: 'var(--color-warning)', title: 'AI Model Risk Analysis', desc: `Whisper transcript evaluation finished. Threat assessment rating scored at ${incident.riskScore}%.`, done: true },
                {
                  color: incident.status === 'resolved' ? 'var(--color-success)' : 'var(--text-muted)',
                  title: incident.status === 'resolved' ? 'Signal Resolved & Closed' : 'Dispatch Investigation Active',
                  desc: incident.status === 'resolved'
                    ? 'Dispatch control officer cleared alert logs. Emergency channel secure.'
                    : 'Dispatch unit dispatched. Safety monitoring active.',
                  done: incident.status === 'resolved',
                  isLast: true,
                },
              ].map((step, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="timeline-dot" style={{ backgroundColor: step.color }} />
                    {!step.isLast && <div className="timeline-line" />}
                  </div>
                  <div style={{ paddingBottom: step.isLast ? 0 : '20px' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 800 }}>{step.title}</strong>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Sidebar Cards ────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Risk Gauge Card */}
          <div className="glass-card" style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            background: isHighRisk
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.06) 0%, var(--bg-card) 100%)'
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.04) 0%, var(--bg-card) 100%)',
            borderColor: isHighRisk ? 'var(--border-danger)' : 'var(--border-color)',
            padding: '24px'
          }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.08em' }}>
              Threat Risk Assessment
            </span>

            {/* Circular gauge */}
            <div style={{ position: 'relative', width: '120px', height: '120px' }}>
              <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r="52" fill="transparent" stroke="var(--bg-primary)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52"
                  fill="transparent"
                  stroke={riskColor}
                  strokeWidth="8"
                  strokeDasharray={`${(incident.riskScore / 100) * 327} 327`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 1s ease-out' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <span style={{ fontSize: '2.1rem', fontWeight: 900, color: riskColor, lineHeight: 1, letterSpacing: '-0.04em' }}>
                  {incident.riskScore}
                </span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: '2px' }}>PERCENT</span>
              </div>
            </div>

            <span className={`badge ${isHighRisk ? 'badge-danger border-glow-red' : 'badge-warning'}`} style={{ fontSize: '0.65rem', fontWeight: 800 }}>
              {isHighRisk ? '⚠ CRITICAL THREAT' : '◆ MODERATE ALERT'}
            </span>
          </div>

          {/* Secure Authorization Stamp */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', paddingBottom: '10px', borderBottom: '1px solid rgba(56, 78, 122, 0.2)' }}>
              <Lock size={14} style={{ color: 'var(--color-cyan)' }} />
              <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Security Clearance</h4>
            </div>
            
            {/* Laser scanning fingerprint scanner */}
            <div className="fingerprint-scanner-box">
              <div className="fingerprint-laser" />
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
                <path d="M12 10a2 2 0 0 0-2 2c0 .5.5 1 1 1s1-.5 1-1c0-.6-.4-1-1-1Z" />
                <path d="M14 13.1c.4-.2.7-.5.9-.9.4-.8.3-1.8-.4-2.4a4 4 0 0 0-5 0c-.7.6-.8 1.6-.4 2.4.2.4.5.7.9.9" />
                <path d="M16 15.5c.7-.6 1.1-1.5 1-2.5a6 6 0 0 0-10 0c-.1 1 .3 1.9 1 2.5" />
                <path d="M18 18c.8-1 1.2-2.2 1-3.5a8 8 0 0 0-14 0c-.2 1.3.2 2.5 1 3.5" />
                <path d="M20 20c1.2-1.3 1.6-3 1.4-4.8a10 10 0 0 0-18.8 0c-.2 1.8.2 3.5 1.4 4.8" />
              </svg>
            </div>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Digital Signature Active
            </span>
          </div>

          {/* User Profile Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', borderBottom: '1px solid rgba(56, 78, 122, 0.2)' }}>
              <User size={15} style={{ color: 'var(--text-accent)' }} />
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>Victim Profile</h4>
            </div>

            {user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Full Name', value: user.name },
                  { label: 'Primary Phone', value: user.phone },
                  { label: 'Email Address', value: user.email },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '3px' }}>
                      {label}
                    </span>
                    <strong style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{value || 'Not provided'}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '6px 0' }}>Anonymous / unregistered alert session</div>
            )}
          </div>

          {/* Emergency Contacts Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', borderBottom: '1px solid rgba(56, 78, 122, 0.2)' }}>
              <Radio size={15} style={{ color: 'var(--color-cyan)' }} />
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>Guardian Dispatch</h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {user && user.emergencyContacts && user.emergencyContacts.length > 0 ? (
                user.emergencyContacts.map((contact, index) => (
                  <div key={index} style={{
                    padding: '10px 12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                    border: '1px solid rgba(56, 78, 122, 0.2)',
                  }}>
                    <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.8rem' }}>{contact.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{contact.phone}</div>
                    <span className="badge badge-success" style={{ marginTop: '6px', fontSize: '0.58rem', border: 'none', background: 'rgba(16, 185, 129, 0.15)' }}>
                      ✓ SMS NOTIFIED
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '6px 0' }}>No active emergency contacts configured</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
