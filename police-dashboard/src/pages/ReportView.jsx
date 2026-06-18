import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Download, ShieldAlert, AlertTriangle, Calendar, MapPin, User, FileText, Phone, Volume2, Play, Pause } from 'lucide-react';

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
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
        Loading incident dossier and safety metrics...
      </div>
    );
  }

  if (!data || !data.incident) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '60px' }}>
        <ShieldAlert size={48} style={{ color: '#ef4444' }} />
        <h3 style={{ color: '#fff', fontSize: '1.25rem' }}>Incident Dossier Not Found</h3>
        <button 
          onClick={() => navigate('/')} 
          style={{ padding: '8px 16px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
        >
          Return to Dispatcher
        </button>
      </div>
    );
  }

  const { incident, user } = data;
  const isHighRisk = incident.riskScore >= 70;
  const mockAudioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'; // Standard test audio

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Hidden audio player */}
      <audio 
        ref={audioRef} 
        src={mockAudioUrl} 
        onEnded={() => setIsPlaying(false)}
        style={{ display: 'none' }}
      />

      {/* Header Back navigation and download actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 600 }}
        >
          <ArrowLeft size={16} /> Back to Dispatch
        </button>

        <button 
          onClick={handleGenerateReport}
          disabled={downloading}
          style={{
            padding: '10px 18px',
            backgroundColor: '#e11d48',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Download size={16} />
          {downloading ? 'Compiling PDF...' : 'Download PDF Dossier'}
        </button>
      </div>

      {pdfLink && (
        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', fontSize: '0.85rem', color: '#10b981' }}>
          PDF Generated: <a href={pdfLink} target="_blank" rel="noreferrer" style={{ color: '#10b981', textDecoration: 'underline', fontWeight: 'bold' }}>Click here to open if popups were blocked</a>
        </div>
      )}

      {/* Main content columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Left Dossier Form */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', color: '#fff' }}>Incident Threat Dossier ({incident.id})</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registered Log Date: {new Date(incident.createdAt).toLocaleString()}</span>
          </div>

          {/* Grid fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>Trigger Mechanism</span>
              <strong style={{ color: '#fff', fontSize: '1rem', textTransform: 'capitalize' }}>{incident.triggerType} Sensor</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>Emergency Status</span>
              <span 
                style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 'bold', 
                  padding: '2px 8px', 
                  borderRadius: '4px',
                  backgroundColor: incident.status === 'active' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: incident.status === 'active' ? '#ef4444' : '#10b981',
                  border: `1px solid ${incident.status === 'active' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                }}
              >
                {incident.status.toUpperCase()}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>GPS Latitude</span>
              <strong style={{ color: '#fff', fontSize: '1rem', fontFamily: 'monospace' }}>{incident.latitude.toFixed(6)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>GPS Longitude</span>
              <strong style={{ color: '#fff', fontSize: '1rem', fontFamily: 'monospace' }}>{incident.longitude.toFixed(6)}</strong>
            </div>
          </div>

          {/* Audio Transcript Evidence & Playback */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Volume2 size={16} /> Audio Speech Evidence
              </span>
              <button 
                onClick={togglePlayAudio}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px',
                  color: '#3b82f6',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 'bold'
                }}
              >
                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                {isPlaying ? 'Pause Audio' : 'Play Recording'}
              </button>
            </div>
            
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.95rem', fontStyle: 'italic', color: '#fff' }}>
              {incident.audioTranscript ? `"${incident.audioTranscript}"` : 'No voice distress transcript captured during this session.'}
            </div>
          </div>

          {/* Audit Timeline */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <h4 style={{ fontSize: '1rem', color: '#fff', marginBottom: '12px' }}>Emergency Response Timeline</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444', zIndex: 2 }}></div>
                  <div style={{ width: '2px', flex: 1, backgroundColor: 'var(--border-color)', zIndex: 1 }}></div>
                </div>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: '#fff' }}>SOS Signal Dispatched</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>GPS location payload received. Alert triggers Twilio notification channels.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f59e0b', zIndex: 2 }}></div>
                  <div style={{ width: '2px', flex: 1, backgroundColor: 'var(--border-color)', zIndex: 1 }}></div>
                </div>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: '#fff' }}>AI Safety Model Evaluation</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Acoustic tone scoring and contextual factors evaluated. Risk set to {incident.riskScore}%.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: incident.status === 'resolved' ? '#10b981' : '#6b7280', zIndex: 2 }}></div>
                </div>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: '#fff' }}>
                    {incident.status === 'resolved' ? 'Incident Resolved' : 'Incident Under Investigation'}
                  </strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {incident.status === 'resolved' 
                      ? 'Dispatch officer marked the issue resolved. Signal closed.' 
                      : 'Responders alerted. Awaiting physical confirmation from unit.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right User metadata card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Risk Level gauge */}
          <div className="glass-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Threat Risk Assessment</span>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: isHighRisk ? '#ef4444' : '#f59e0b', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
              {incident.riskScore}%
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isHighRisk ? '#ef4444' : '#f59e0b' }}>
              {isHighRisk ? 'CRITICAL RISK LEVEL' : 'EVALUATED THREAT'}
            </span>
          </div>

          {/* User metadata */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '1rem', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Victim Profile</h4>
            
            {user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Full Name</span>
                  <strong style={{ color: '#fff' }}>{user.name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Primary Phone</span>
                  <strong style={{ color: '#fff' }}>{user.phone}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Email Address</span>
                  <strong style={{ color: '#fff' }}>{user.email}</strong>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Anonymous or Unregistered guest user.</div>
            )}
          </div>

          {/* Emergency contacts notified */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '1rem', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Informed Contacts</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {user && user.emergencyContacts && user.emergencyContacts.length > 0 ? (
                user.emergencyContacts.map((contact, index) => (
                  <div key={index} style={{ fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 'bold', color: '#fff' }}>{contact.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{contact.phone}</div>
                    <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 'bold' }}>SMS dispatched</span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No backup emergency contacts listed.</div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
