import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Download, ShieldAlert, AlertTriangle, MapPin, User, Phone, Volume2, Play, Pause, Clock, Crosshair, Shield, FileText, Radio } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function ReportView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [pdfLink, setPdfLink] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = React.useRef(null);

  useEffect(() => {
    fetchIncidentDetails();
  }, [id]);

  const fetchIncidentDetails = async () => {
    try {
      const res = await axios.get(`${API_BASE}/incidents/${id}`);
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
      const res = await axios.post(`${API_BASE}/report/generate`, { incidentId: id });
      setPdfLink(res.data.reportUrl);
      window.open(res.data.reportUrl, '_blank');
    } catch (err) {
      console.error('Error generating PDF report:', err);
      alert('Could not generate PDF report. Check backend server console.');
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
          <div key={i} className="skeleton" style={{ height: i === 1 ? '48px' : '200px', width: '100%' }} />
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
        <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>Incident Dossier Not Found</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>The requested incident record could not be located</p>
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ marginTop: '8px' }}>
          <ArrowLeft size={14} /> Return to Dispatcher
        </button>
      </div>
    );
  }

  const { incident, user } = data;
  const isHighRisk = incident.riskScore >= 70;
  const riskColor = isHighRisk ? 'var(--color-danger)' : incident.riskScore >= 40 ? 'var(--color-warning)' : 'var(--color-success)';
  const mockAudioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in-up">

      {/* Hidden audio player */}
      <audio ref={audioRef} src={mockAudioUrl} onEnded={() => setIsPlaying(false)} style={{ display: 'none' }} />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ fontSize: '0.8rem' }}>
          <ArrowLeft size={15} /> Back to Dispatch
        </button>
        <div style={{ display: 'flex', gap: '10px' }}>
          {pdfLink && (
            <a href={pdfLink} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: '0.75rem', textDecoration: 'none' }}>
              Open PDF
            </a>
          )}
          <button className="btn btn-danger" onClick={handleGenerateReport} disabled={downloading} style={{ fontSize: '0.78rem' }}>
            <Download size={14} />
            {downloading ? 'Compiling...' : 'Download PDF Dossier'}
          </button>
        </div>
      </div>

      {/* ── Main Content Grid ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>

        {/* ── Left: Incident Dossier ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Title Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <FileText size={18} style={{ color: 'var(--text-accent)' }} />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                    Incident Threat Dossier
                  </h3>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                  ID: {incident.id} • {new Date(incident.createdAt).toLocaleString()}
                </p>
              </div>
              <span className={`badge ${incident.status === 'active' ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.7rem' }}>
                {incident.status === 'active' ? '● ACTIVE' : '✓ RESOLVED'}
              </span>
            </div>

            <div className="section-divider" />

            {/* Detail Fields Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>
                  Trigger Mechanism
                </span>
                <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{incident.triggerType} Sensor</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>
                  Emergency Status
                </span>
                <span className={`badge ${incident.status === 'active' ? 'badge-danger' : 'badge-success'}`}>
                  {incident.status.toUpperCase()}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  <Crosshair size={10} /> GPS Latitude
                </span>
                <strong style={{ color: '#fff', fontSize: '0.95rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{incident.latitude?.toFixed(6)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  <Crosshair size={10} /> GPS Longitude
                </span>
                <strong style={{ color: '#fff', fontSize: '0.95rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{incident.longitude?.toFixed(6)}</strong>
              </div>
            </div>
          </div>

          {/* Audio Evidence Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Volume2 size={16} style={{ color: 'var(--text-accent)' }} />
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>Audio Speech Evidence</span>
              </div>
              <button className="btn btn-ghost" onClick={togglePlayAudio} style={{ padding: '6px 12px', fontSize: '0.72rem' }}>
                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                {isPlaying ? 'Pause' : 'Play Recording'}
              </button>
            </div>

            <div style={{
              padding: '16px 18px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              borderLeft: '3px solid var(--text-accent)',
              fontSize: '0.88rem',
              fontStyle: 'italic',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}>
              {incident.audioTranscript ? `"${incident.audioTranscript}"` : 'No voice distress transcript captured during this session.'}
            </div>
          </div>

          {/* Timeline Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={15} style={{ color: 'var(--text-accent)' }} />
              Emergency Response Timeline
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0', paddingLeft: '6px' }}>
              {[
                { color: 'var(--color-danger)', title: 'SOS Signal Dispatched', desc: 'GPS location payload received. Alert triggers Twilio notification channels.', done: true },
                { color: 'var(--color-warning)', title: 'AI Safety Model Evaluation', desc: `Acoustic tone scoring and contextual factors evaluated. Risk set to ${incident.riskScore}%.`, done: true },
                {
                  color: incident.status === 'resolved' ? 'var(--color-success)' : 'var(--text-muted)',
                  title: incident.status === 'resolved' ? 'Incident Resolved' : 'Incident Under Investigation',
                  desc: incident.status === 'resolved'
                    ? 'Dispatch officer marked the issue resolved. Signal closed.'
                    : 'Responders alerted. Awaiting physical confirmation from unit.',
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
                    <strong style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 700 }}>{step.title}</strong>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.5 }}>{step.desc}</p>
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
          }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>
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
                <span style={{ fontSize: '2rem', fontWeight: 900, color: riskColor, lineHeight: 1, letterSpacing: '-0.04em' }}>
                  {incident.riskScore}
                </span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>/ 100</span>
              </div>
            </div>

            <span className={`badge ${isHighRisk ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
              {isHighRisk ? '⚠ CRITICAL RISK' : '◆ MODERATE THREAT'}
            </span>
          </div>

          {/* User Profile Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', borderBottom: '1px solid rgba(56, 78, 122, 0.2)' }}>
              <User size={15} style={{ color: 'var(--text-accent)' }} />
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>Victim Profile</h4>
            </div>

            {user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Full Name', value: user.name, icon: User },
                  { label: 'Phone', value: user.phone, icon: Phone },
                  { label: 'Email', value: user.email, icon: null },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '3px' }}>
                      {label}
                    </span>
                    <strong style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{value || '—'}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>Anonymous or unregistered user</div>
            )}
          </div>

          {/* Emergency Contacts Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', borderBottom: '1px solid rgba(56, 78, 122, 0.2)' }}>
              <Radio size={15} style={{ color: 'var(--color-cyan)' }} />
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>Notified Contacts</h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {user && user.emergencyContacts && user.emergencyContacts.length > 0 ? (
                user.emergencyContacts.map((contact, index) => (
                  <div key={index} style={{
                    padding: '10px 12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(56, 78, 122, 0.2)',
                  }}>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.82rem' }}>{contact.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{contact.phone}</div>
                    <span className="badge badge-success" style={{ marginTop: '6px', fontSize: '0.6rem' }}>
                      ✓ SMS Dispatched
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>No backup emergency contacts listed</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
