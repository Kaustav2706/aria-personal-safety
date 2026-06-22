import React, { useState } from 'react';
import { ShieldCheck, User, Phone, Mail, Lock, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { authService } from '../services/api';
import { setToken, setUser } from '../services/auth';

interface SignupProps {
  onRegisterComplete: () => void;
  onGoToLogin: () => void;
}

export default function SignupView({ onRegisterComplete, onGoToLogin }: SignupProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName || !email || !phone || !password) {
      setError('Please fill out all mandatory fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await authService.register(fullName, email, phone, password);

      if (res.data.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        setRegisterSuccess(true);

        // Brief delay to show success state, then navigate
        setTimeout(() => {
          onRegisterComplete();
          setIsSubmitting(false);
        }, 800);
      } else {
        setError(res.data.message || 'Registration failed.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400) {
        setError(msg || 'Invalid registration details. Email may already be in use.');
      } else if (err?.response?.status === 429) {
        setError('Too many attempts. Please wait and try again.');
      } else {
        setError(msg || 'Server unavailable. Please check your connection.');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#1e0f0e] font-sans flex flex-col items-center justify-center p-6 overflow-y-auto no-scrollbar">
      {/* Background Decor Ambient Blobs */}
      <div className="absolute top-[10%] left-[-15%] w-[400px] h-[400px] bg-primary/[0.07] rounded-full blur-[110px] pointer-events-none animate-glow-pulse" />
      <div className="absolute bottom-[10%] right-[-15%] w-[400px] h-[400px] bg-[#3394f1]/[0.05] rounded-full blur-[120px] pointer-events-none animate-glow-pulse" style={{ animationDelay: '1s' }} />

      {/* Dot grid pattern background */}
      <div className="absolute inset-0 dot-grid pointer-events-none" />

      <main className="w-full max-w-md z-10 space-y-6 my-8 animate-fade-in-scale">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center">
          <div className="relative w-16 h-16 mb-4">
            {/* Glow ring */}
            <div className="absolute inset-[-4px] rounded-full bg-gradient-to-tr from-primary/40 to-[#3394f1]/20 blur-[8px] animate-glow-pulse" />
            <div className="relative w-full h-full bg-gradient-to-br from-primary-container to-[#c41a1f] rounded-full flex items-center justify-center overflow-hidden shadow-[0_0_24px_rgba(255,84,76,0.3)]">
              <div className="absolute inset-0 shimmer" />
              <ShieldCheck className="w-9 h-9 text-white relative z-10" />
            </div>
          </div>
          <h1 className="text-4xl font-black tracking-[-0.04em] text-gradient bg-gradient-to-r from-primary via-[#ffcec8] to-primary">ARIA</h1>
          <p className="text-[12px] text-on-surface-variant/50 font-medium mt-1 tracking-wide">
            Personal Safety Reimagined
          </p>
        </div>

        {/* Signup Form Card */}
        <div className="glass-card-elevated rounded-2xl p-7 space-y-5 relative overflow-hidden gradient-border">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Error Display */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-error-container/15 border border-error/20 animate-slide-up">
                <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
                <p className="text-xs text-error/90 font-medium leading-relaxed">{error}</p>
              </div>
            )}

            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-on-surface-variant/60 ml-1 font-bold tracking-[0.12em] uppercase">
                Full Name
              </label>
              <div className="relative group rounded-xl border border-outline-variant/60 bg-surface-container-lowest/80 focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px_rgba(255,180,172,0.08)] transition-all duration-300">
                <User className="w-[18px] h-[18px] absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary/70 transition-colors" />
                <input
                  className="w-full h-11 bg-transparent text-on-surface pl-11 pr-4 rounded-xl focus:ring-0 focus:outline-none text-[13.5px]"
                  type="text"
                  placeholder="Priya Patel"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-on-surface-variant/60 ml-1 font-bold tracking-[0.12em] uppercase">
                Phone Number
              </label>
              <div className="relative group rounded-xl border border-outline-variant/60 bg-surface-container-lowest/80 focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px_rgba(255,180,172,0.08)] transition-all duration-300">
                <Phone className="w-[18px] h-[18px] absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary/70 transition-colors" />
                <input
                  className="w-full h-11 bg-transparent text-on-surface pl-11 pr-4 rounded-xl focus:ring-0 focus:outline-none text-[13.5px]"
                  type="tel"
                  placeholder="+91 98765 43210"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-on-surface-variant/60 ml-1 font-bold tracking-[0.12em] uppercase">
                Email Address
              </label>
              <div className="relative group rounded-xl border border-outline-variant/60 bg-surface-container-lowest/80 focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px_rgba(255,180,172,0.08)] transition-all duration-300">
                <Mail className="w-[18px] h-[18px] absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary/70 transition-colors" />
                <input
                  className="w-full h-11 bg-transparent text-on-surface pl-11 pr-4 rounded-xl focus:ring-0 focus:outline-none text-[13.5px]"
                  type="email"
                  placeholder="demo@gmail.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Passwords fields split grid */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] text-on-surface-variant/60 ml-1 font-bold tracking-[0.12em] uppercase">
                  Password
                </label>
                <div className="relative group rounded-xl border border-outline-variant/60 bg-surface-container-lowest/80 focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px_rgba(255,180,172,0.08)] transition-all duration-300">
                  <Lock className="w-[16px] h-[16px] absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary/70 transition-colors" />
                  <input
                    className="w-full h-11 bg-transparent text-on-surface pl-9 pr-3 rounded-xl focus:ring-0 focus:outline-none font-mono text-[13.5px] placeholder:font-sans"
                    type="password"
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-on-surface-variant/60 ml-1 font-bold tracking-[0.12em] uppercase">
                  Confirm
                </label>
                <div className="relative group rounded-xl border border-outline-variant/60 bg-surface-container-lowest/80 focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px_rgba(255,180,172,0.08)] transition-all duration-300">
                  <Lock className="w-[16px] h-[16px] absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary/70 transition-colors" />
                  <input
                    className="w-full h-11 bg-transparent text-on-surface pl-9 pr-3 rounded-xl focus:ring-0 focus:outline-none font-mono text-[13.5px] placeholder:font-sans"
                    type="password"
                    placeholder="••••••••"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Primary Submit button */}
            <div className="pt-3.5">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full h-14 bg-gradient-to-r from-primary-container via-primary-container/90 to-[#b51419] text-white font-bold text-[15px] rounded-xl shadow-[0_4px_20px_rgba(255,84,76,0.2)] hover:shadow-[0_6px_28px_rgba(255,84,76,0.3)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 relative overflow-hidden ${
                  registerSuccess ? 'from-[#34d399] to-[#059669] shadow-[0_4px_20px_rgba(52,211,153,0.2)]' : ''
                }`}
              >
                <div className="absolute inset-0 shimmer" />
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : registerSuccess ? (
                  <>
                    <CheckCircle className="w-5 h-5 animate-bounce relative z-10" />
                    <span className="relative z-10">Account Secured</span>
                  </>
                ) : (
                  <>
                    <span className="relative z-10">Create Account</span>
                    <ArrowRight className="w-5 h-5 relative z-10" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Already have an account row */}
          <div className="text-center pt-3 border-t border-white/[0.04] mt-2">
            <p className="text-[13px] text-on-surface-variant/50">
              Already have an account?
              <button
                onClick={onGoToLogin}
                className="text-primary font-bold hover:text-primary/80 transition-colors ml-1.5 cursor-pointer"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>

        {/* Encrypted trust footer tags */}
        <div className="flex justify-center gap-3">
          <div className="flex items-center gap-2 glass-card px-4 py-2.5 rounded-full">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="font-bold text-[9px] text-on-surface-variant/50 uppercase tracking-[0.12em]">
              Encrypted Safety
            </span>
          </div>
          <div className="flex items-center gap-2 glass-card px-4 py-2.5 rounded-full">
            <span className="w-2 h-2 bg-[#34d399] rounded-full animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.4)]" />
            <span className="font-bold text-[9px] text-on-surface-variant/50 uppercase tracking-[0.12em]">
              Server Nominal
            </span>
          </div>
        </div>

      </main>
    </div>
  );
}
