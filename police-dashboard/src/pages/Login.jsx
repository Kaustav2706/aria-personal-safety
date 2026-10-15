import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, AlertCircle, Eye, EyeOff, User, Phone, CheckCircle } from 'lucide-react';
import { loginDispatcher, registerDispatcher } from '../api.js';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode]         = useState('login'); // 'login' | 'register'
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!name.trim()) throw new Error('Dispatcher full name is required.');
        if (!phone.trim()) throw new Error('Contact phone number is required.');
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');

        await registerDispatcher({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password
        });
        setSuccess('Dispatcher account created successfully! Signing in…');
        setTimeout(() => navigate('/', { replace: true }), 400);
      } else {
        await loginDispatcher(email.trim(), password);
        navigate('/', { replace: true });
      }
    } catch (err) {
      const msg =
        err.message === 'This account does not have police dispatcher access.'
          ? err.message
          : err.response?.data?.message || err.message || 'Authentication failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0b0c10',
      padding: '24px',
    }}>
      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'linear-gradient(145deg, rgba(19,20,26,0.98) 0%, rgba(14,15,20,0.98) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '38px 36px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.08)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '26px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 24px rgba(59,130,246,0.35)',
            marginBottom: '14px',
          }}>
            <Shield size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', margin: 0 }}>
            ARIA Dispatch Portal
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
            Emergency Response & Police Command
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '22px',
          border: '1px solid rgba(255,255,255,0.06)'
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: '9px',
              border: 'none',
              background: mode === 'login' ? 'rgba(59,130,246,0.22)' : 'transparent',
              color: mode === 'login' ? '#60a5fa' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: mode === 'login' ? '0 0 12px rgba(59,130,246,0.15)' : 'none'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: '9px',
              border: 'none',
              background: mode === 'register' ? 'rgba(59,130,246,0.22)' : 'transparent',
              color: mode === 'register' ? '#60a5fa' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: mode === 'register' ? '0 0 12px rgba(59,130,246,0.15)' : 'none'
            }}
          >
            Create Account
          </button>
        </div>

        {/* Success Banner */}
        {success && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.35)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '18px',
            fontSize: '0.82rem',
            color: '#4ade80',
            fontWeight: 500,
          }}>
            <CheckCircle size={15} style={{ flexShrink: 0 }} />
            {success}
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.35)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '18px',
            fontSize: '0.82rem',
            color: '#f87171',
            fontWeight: 500,
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <div>
              {error}
              {error === 'This account does not have police dispatcher access.' && (
                <div style={{ marginTop: '4px', fontSize: '0.76rem', color: '#fca5a5' }}>
                  Tip: Switch to <b>Create Account</b> above to register your official dispatcher credentials.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Registration Extra Fields */}
          {mode === 'register' && (
            <>
              {/* Full Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Officer / Dispatcher Name
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    id="dispatcher-name"
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Officer J. Vance"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '11px 14px 11px 40px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Department Phone
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    id="dispatcher-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '11px 14px 11px 40px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="dispatcher-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="dispatcher@police.gov"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '11px 14px 11px 40px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '0.88rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
              Password {mode === 'register' && <span style={{ opacity: 0.6 }}>(min 8 characters)</span>}
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="dispatcher-password"
                type={showPw ? 'text' : 'password'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '11px 42px 11px 40px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '0.88rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                tabIndex={-1}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            id="dispatcher-login-btn"
            type="submit"
            disabled={loading}
            style={{
              marginTop: '6px',
              padding: '12px',
              background: loading
                ? 'rgba(59,130,246,0.4)'
                : 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.03em',
              transition: 'opacity 0.2s, transform 0.1s',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(59,130,246,0.3)',
            }}
            onMouseEnter={e => { if (!loading) e.target.style.opacity = '0.88'; }}
            onMouseLeave={e => { e.target.style.opacity = '1'; }}
          >
            {loading ? 'Authenticating…' : (mode === 'register' ? 'Register & Enter Dispatch' : 'Sign In to Dispatch')}
          </button>
        </form>

        <p style={{ marginTop: '20px', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
          Authorized police dispatch & incident coordination portal.<br />
          All actions are securely audited.
        </p>
      </div>
    </div>
  );
}
