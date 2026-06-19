import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { authService } from '../services/api';
import { setToken, setUser } from '../services/auth';

interface LoginProps {
  onLogin: () => void;
  onGoToSignup: () => void;
}

export default function LoginView({ onLogin, onGoToSignup }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      <div className="absolute top-1/4 left-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-[-10%] w-96 h-96 bg-secondary-container/5 rounded-full blur-[110px] pointer-events-none" />

      <main className="w-full max-w-md z-10 space-y-6">
        {/* Logo Shield Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center sos-glow mb-4 overflow-hidden relative group cursor-pointer">
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-display-lg font-black tracking-tighter text-primary">ARIA</h1>
          <p className="text-body-sm text-on-surface-variant font-medium opacity-80 mt-1">
            Personal Safety Reimagined
          </p>
        </div>

        {/* Login Form Layout Card */}
        <div className="glass-card rounded-2xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Error Display */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-error-container/20 border border-error/30 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
                <p className="text-xs text-error font-medium leading-relaxed">{error}</p>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-label-md text-on-surface-variant ml-1 font-bold tracking-wider uppercase" htmlFor="email">
                Email Address
              </label>
              <div className="relative group rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary transition-all">
                <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-70" />
                <input
                  className="w-full h-12 bg-transparent text-on-surface pl-12 pr-4 rounded-xl focus:ring-0 focus:outline-none"
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-label-md text-on-surface-variant font-bold tracking-wider uppercase" htmlFor="password">
                  Password
                </label>
                <a className="text-label-md text-secondary hover:underline tracking-tight" href="#forgot">
                  Forgot Password?
                </a>
              </div>
              <div className="relative group rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary transition-all">
                <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-70" />
                <input
                  className="w-full h-12 bg-transparent text-on-surface pl-12 pr-4 rounded-xl focus:ring-0 focus:outline-none font-mono"
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-secondary-container text-white font-bold text-title-md rounded-xl shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-6 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Divider tag */}
          <div className="flex items-center my-6">
            <div className="flex-grow border-t border-outline-variant opacity-30" />
            <span className="px-4 font-bold text-[10px] text-on-surface-variant uppercase tracking-widest whitespace-nowrap">
              OR CONTINUE WITH
            </span>
            <div className="flex-grow border-t border-outline-variant opacity-30" />
          </div>

          {/* Social Logins — Coming Soon */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setError('Apple Sign-In coming soon.')}
              className="h-12 glass-card rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 active:scale-95 transition-all text-on-surface text-label-md font-bold cursor-pointer"
            >
              <span className="font-semibold text-lg"></span> Apple
            </button>
            <button
              onClick={() => setError('Google Sign-In coming soon.')}
              className="h-12 glass-card rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 active:scale-95 transition-all text-on-surface text-label-md font-bold cursor-pointer"
            >
              <span className="text-secondary font-black">G</span> Google
            </button>
          </div>

          {/* Sign Up footer link */}
          <div className="text-center pt-4">
            <p className="text-body-sm text-on-surface-variant">
              Don't have an account?
              <button
                onClick={onGoToSignup}
                className="text-primary font-black hover:underline transition-all ml-1 cursor-pointer"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>

        {/* System Health Tags */}
        <div className="flex justify-center gap-4">
          <div className="flex items-center gap-2 glass-card px-4 py-2 rounded-full border-white/5">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="font-bold text-[9px] text-on-surface-variant uppercase tracking-widest">
              System Live
            </span>
          </div>
          <div className="flex items-center gap-2 glass-card px-4 py-2 rounded-full border-white/5">
            <span className="w-2 h-2 bg-tertiary rounded-full animate-pulse" />
            <span className="font-bold text-[9px] text-on-surface-variant uppercase tracking-widest">
              Encrypted
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
