import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { authService } from '../services/api';
import { setToken, setUser } from '../services/auth';

interface LoginProps {
  onLogin: () => void;
  onGoToSignup: () => void;
}

export default function LoginView({ onLogin, onGoToSignup }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await authService.login(email, password);

      if (res.data.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        onLogin();
      } else {
        setError(res.data.message || 'Login failed. Please try again.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 401) {
        setError(msg || 'Invalid email or password.');
      } else if (err?.response?.status === 400) {
        setError(msg || 'Missing email or password.');
      } else if (err?.response?.status === 429) {
        setError('Too many login attempts. Please wait and try again.');
      } else {
        setError(msg || 'Server unavailable. Please check your connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-[#1e0f0e] font-sans flex flex-col items-center justify-center p-6 overflow-y-auto no-scrollbar">
      {/* Visual Backdrops */}
      <div className="absolute top-[20%] left-[-15%] w-[400px] h-[400px] bg-primary/[0.07] rounded-full blur-[110px] pointer-events-none animate-glow-pulse" />
      <div className="absolute bottom-[20%] right-[-15%] w-[400px] h-[400px] bg-secondary/[0.05] rounded-full blur-[120px] pointer-events-none animate-glow-pulse" style={{ animationDelay: '1s' }} />

      {/* Dot grid pattern */}
      <div className="absolute inset-0 dot-grid pointer-events-none" />

      <main className="w-full max-w-md z-10 space-y-7 animate-fade-in-scale">
        {/* Logo Shield Header */}
        <div className="flex flex-col items-center text-center">
          <div className="relative w-16 h-16 mb-5">
            {/* Glow ring */}
            <div className="absolute inset-[-4px] rounded-full bg-gradient-to-tr from-primary/40 to-secondary/20 blur-[8px] animate-glow-pulse" />
            <div className="relative w-full h-full bg-gradient-to-br from-primary-container to-[#c41a1f] rounded-full flex items-center justify-center overflow-hidden group cursor-pointer shadow-[0_0_24px_rgba(255,84,76,0.3)]">
              <div className="absolute inset-0 shimmer" />
              <ShieldCheck className="w-9 h-9 text-white relative z-10" />
            </div>
          </div>
          <h1 className="text-4xl font-black tracking-[-0.04em] text-gradient bg-gradient-to-r from-primary via-[#ffcec8] to-primary">ARIA</h1>
          <p className="text-[12px] text-on-surface-variant/50 font-medium mt-1.5 tracking-wide">
            Personal Safety Reimagined
          </p>
        </div>

        {/* Login Form Layout Card */}
        <div className="glass-card-elevated rounded-2xl p-7 space-y-6 relative overflow-hidden gradient-border">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Error Display */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-error-container/15 border border-error/20 animate-slide-up">
                <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
                <p className="text-xs text-error/90 font-medium leading-relaxed">{error}</p>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-[10px] text-on-surface-variant/60 ml-1 font-bold tracking-[0.12em] uppercase" htmlFor="email">
                Email Address
              </label>
              <div className="relative group rounded-xl border border-outline-variant/60 bg-surface-container-lowest/80 focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px_rgba(255,180,172,0.08)] transition-all duration-300">
                <Mail className="w-[18px] h-[18px] absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary/70 transition-colors" />
                <input
                  className="w-full h-12 bg-transparent text-on-surface pl-12 pr-4 rounded-xl focus:ring-0 focus:outline-none text-[14px]"
                  id="email"
                  type="email"
                  placeholder="demo@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] text-on-surface-variant/60 font-bold tracking-[0.12em] uppercase" htmlFor="password">
                  Password
                </label>
              </div>
              <div className="relative group rounded-xl border border-outline-variant/60 bg-surface-container-lowest/80 focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px_rgba(255,180,172,0.08)] transition-all duration-300">
                <Lock className="w-[18px] h-[18px] absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary/70 transition-colors" />
                <input
                  className="w-full h-12 bg-transparent text-on-surface pl-12 pr-12 rounded-xl focus:ring-0 focus:outline-none font-mono text-[14px]"
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface-variant/70 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-gradient-to-r from-secondary-container to-[#2578d1] text-white font-bold text-[15px] rounded-xl shadow-[0_4px_20px_rgba(51,148,241,0.25)] hover:shadow-[0_6px_28px_rgba(51,148,241,0.35)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 mt-2 cursor-pointer disabled:opacity-50 relative overflow-hidden"
            >
              <div className="absolute inset-0 shimmer" />
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="relative z-10">Sign In</span>
                  <ArrowRight className="w-5 h-5 relative z-10" />
                </>
              )}
            </button>
          </form>



          {/* Sign Up footer link */}
          <div className="text-center pt-3">
            <p className="text-[13px] text-on-surface-variant/50">
              Don't have an account?
              <button
                onClick={onGoToSignup}
                className="text-primary font-bold hover:text-primary/80 transition-colors ml-1.5 cursor-pointer"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>

        {/* System Health Tags */}
        <div className="flex justify-center gap-3">
          <div className="flex items-center gap-2 glass-card px-4 py-2.5 rounded-full">
            <span className="w-2 h-2 bg-[#34d399] rounded-full animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.4)]" />
            <span className="font-bold text-[9px] text-on-surface-variant/50 uppercase tracking-[0.12em]">
              System Live
            </span>
          </div>
          <div className="flex items-center gap-2 glass-card px-4 py-2.5 rounded-full">
            <span className="w-2 h-2 bg-tertiary rounded-full animate-pulse shadow-[0_0_6px_rgba(114,212,239,0.4)]" />
            <span className="font-bold text-[9px] text-on-surface-variant/50 uppercase tracking-[0.12em]">
              Encrypted
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
