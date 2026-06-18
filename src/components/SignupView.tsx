import React, { useState } from 'react';
import { ShieldCheck, User, Phone, Mail, Lock, CheckCircle } from 'lucide-react';

interface SignupProps {
  onRegisterComplete: (email: string, name: string, emergencyPhone: string) => void;
  onGoToLogin: () => void;
}

export default function SignupView({ onRegisterComplete, onGoToLogin }: SignupProps) {
  const [fullName, setFullName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !emergencyPhone) {
      alert('Please fill out all mandatory fields.');
      return;
    }
    setIsSubmitting(true);

    setTimeout(() => {
      setRegisterSuccess(true);
      setTimeout(() => {
        onRegisterComplete(email, fullName, emergencyPhone);
        setIsSubmitting(false);
      }, 1000);
    }, 1500);
  };

  return (
    <div className="relative min-h-screen bg-[#1e0f0e] font-sans flex flex-col items-center justify-center p-6 overflow-y-auto no-scrollbar">
      {/* Background Decor */}
      <div className="absolute top-[10%] left-[-15%] w-[80%] h-[30%] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-15%] w-[70%] h-[40%] bg-secondary-container/5 rounded-full blur-[110px] pointer-events-none" />

      <main className="w-full max-w-md z-10 space-y-6">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full glass-card border-white/10 mb-3 shadow-xl">
            <ShieldCheck className="w-9 h-9 text-primary animate-pulse" />
          </div>
          <h1 className="text-display-lg font-black tracking-tighter text-primary">ARIA</h1>
          <p className="text-body-sm text-on-surface-variant font-medium opacity-80 mt-1">
            Join the global safety network
          </p>
        </div>

        {/* Signup Form Card */}
        <section className="glass-card rounded-2xl p-6 shadow-2xl relative">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-label-md text-on-surface-variant ml-1 font-bold tracking-wider uppercase">
                Full Name
              </label>
              <div className="relative group rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary transition-all">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-5 w-5 opacity-70" />
                <input 
                  className="w-full h-11 pl-10 pr-4 bg-transparent border-none focus:ring-0 focus:outline-none text-on-surface text-body-lg"
                  type="text" 
                  placeholder="John Doe" 
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            {/* Emergency Contact Phone */}
            <div className="space-y-1">
              <label className="text-label-md text-on-surface-variant ml-1 font-bold tracking-wider uppercase">
                Emergency Contact Phone
              </label>
              <div className="relative group rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary transition-all">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-5 w-5 opacity-70" />
                <input 
                  className="w-full h-11 pl-10 pr-4 bg-transparent border-none focus:ring-0 focus:outline-none text-on-surface text-body-lg"
                  type="tel" 
                  placeholder="+1 (555) 000-0000" 
                  required
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-1">
              <label className="text-label-md text-on-surface-variant ml-1 font-bold tracking-wider uppercase">
                Email Address
              </label>
              <div className="relative group rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary transition-all">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-5 w-5 opacity-70" />
                <input 
                  className="w-full h-11 pl-10 pr-4 bg-transparent border-none focus:ring-0 focus:outline-none text-on-surface text-body-lg"
                  type="email" 
                  placeholder="name@example.com" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-label-md text-on-surface-variant ml-1 font-bold tracking-wider uppercase">
                  Create Password
                </label>
                <div className="relative group rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary transition-all">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-5 w-5 opacity-70" />
                  <input 
                    className="w-full h-11 pl-10 pr-4 bg-transparent border-none focus:ring-0 focus:outline-none text-on-surface text-body-lg font-mono placeholder:font-sans"
                    type="password" 
                    placeholder="••••••••" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-label-md text-on-surface-variant ml-1 font-bold tracking-wider uppercase">
                  Confirm Password
                </label>
                <div className="relative group rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary transition-all">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-5 w-5 opacity-70" />
                  <input 
                    className="w-full h-11 pl-10 pr-4 bg-transparent border-none focus:ring-0 focus:outline-none text-on-surface text-body-lg font-mono placeholder:font-sans"
                    type="password" 
                    placeholder="••••••••" 
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Primary Submit */}
            <div className="pt-3">
              <button 
                type="submit"
                disabled={isSubmitting}
                className={`w-full h-14 bg-primary-container text-white rounded-xl font-bold text-title-md hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  registerSuccess ? 'bg-tertiary-container' : ''
                }`}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : registerSuccess ? (
                  <>
                    <CheckCircle className="w-5 h-5 animate-bounce" />
                    Account Secured!
                  </>
                ) : (
                  <>
                    Create Account
                    <span className="font-semibold text-lg">→</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Already have an account row */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <span className="w-8 h-px bg-outline-variant" />
            <p className="text-body-sm text-on-surface-variant">Already have an account?</p>
            <span className="w-8 h-px bg-outline-variant" />
          </div>

          {/* Secondary Link to Login */}
          <div className="mt-3">
            <button 
              onClick={onGoToLogin}
              className="w-full h-11 border border-outline-variant rounded-xl flex items-center justify-center font-bold text-[14px] text-primary hover:bg-white/5 transition-colors cursor-pointer"
            >
              Sign in
            </button>
          </div>
        </section>

        {/* Encrypted trust footer and visual tags */}
        <footer className="flex flex-col items-center gap-3 opacity-80 pt-2">
          <div className="flex items-center gap-1.5 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>End-to-end encrypted safety data</span>
          </div>
          <div className="flex gap-4 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
            <a href="#terms" className="hover:text-primary transition-colors">Terms of Service</a>
            <span className="text-outline/35">•</span>
            <a href="#privacy" className="hover:text-primary transition-colors">Privacy Policy</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
