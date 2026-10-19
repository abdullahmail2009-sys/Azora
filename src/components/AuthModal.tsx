import React, { useState } from 'react';
import { X, LogIn, UserPlus, KeyRound, ShieldCheck, AlertCircle, CheckCircle2, Cloud } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { getFirebaseAuthDiagnostics } from '../services/firebase.ts';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    currentUser,
    authError,
    clearAuthError,
    authLoading,
    loginGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    logoutUser,
  } = useApp();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const diagnostics = getFirebaseAuthDiagnostics();

  const closeModal = () => {
    clearAuthError();
    setStatusNotice(null);
    setIsAuthModalOpen(false);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setStatusNotice(null);

    if (mode === 'login') {
      const ok = await loginWithEmail(email, password);
      if (ok) {
        setPassword('');
        setIsAuthModalOpen(false);
      }
    } else if (mode === 'register') {
      const ok = await registerWithEmail(displayName, email, password);
      if (ok) {
        setPassword('');
        setIsAuthModalOpen(false);
      }
    } else if (mode === 'reset') {
      const ok = await resetPassword(email);
      if (ok) {
        setStatusNotice(`Password reset instructions sent to ${email.trim()}. Check your inbox.`);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    clearAuthError();
    setStatusNotice(null);
    await loginGoogle();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1B4D48]/45 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="azora-auth-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#FBF7EF] border border-[#E2DAC7] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#F5EFE2] border-b border-[#E2DAC7] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#75D9B4]/30 border border-[#42BDAE] flex items-center justify-center text-[#1B4D48]">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 id="azora-auth-modal-title" className="text-base font-bold text-[#1B4D48]">
                AZORA Cloud Sync & Account
              </h2>
              <p className="text-xs text-[#4A6B66]">
                Sync your RBSE Class 12 progress across devices
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close sign in dialog"
            className="p-1.5 rounded-lg text-[#4A6B66] hover:text-[#1B4D48] hover:bg-[#EDE5D4] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {currentUser ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#75D9B4]/20 border border-[#42BDAE] flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#1B4D48] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#1B4D48]">Signed In & Synced</div>
                  <div className="text-xs text-[#3F635E] truncate mt-0.5">
                    {currentUser.displayName || currentUser.email || currentUser.uid}
                  </div>
                  {currentUser.email && currentUser.displayName && (
                    <div className="text-[11px] text-[#5B7A75] truncate">{currentUser.email}</div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl bg-[#F5EFE2] border border-[#E2DAC7] text-[#1B4D48] text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await logoutUser();
                    closeModal();
                  }}
                  className="px-4 py-2 rounded-xl bg-[#1B4D48] text-[#FBF7EF] text-xs font-semibold cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Error Banner */}
              {authError && (
                <div
                  role="alert"
                  data-testid="auth-modal-error"
                  className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="font-bold text-amber-900">Sign-In Notice</div>
                    <p className="text-amber-800 leading-relaxed">{authError}</p>
                  </div>
                </div>
              )}

              {statusNotice && (
                <div
                  role="status"
                  className="p-3 rounded-xl bg-[#75D9B4]/25 border border-[#42BDAE] text-[#1B4D48] text-xs font-medium flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{statusNotice}</span>
                </div>
              )}

              {/* Primary Google OAuth Button */}
              <button
                type="button"
                disabled={authLoading}
                onClick={handleGoogleSignIn}
                data-testid="google-signin-btn"
                className="w-full py-2.5 px-4 rounded-xl bg-[#1B4D48] hover:bg-[#143B37] disabled:opacity-60 text-[#FBF7EF] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-[#75D9B4]" />
                <span>{authLoading ? 'Connecting...' : 'Continue with Google'}</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-[#E2DAC7] w-full" />
                <span className="bg-[#FBF7EF] px-2.5 text-[11px] text-[#5B7A75] font-medium shrink-0">
                  or use Email & Password
                </span>
                <div className="border-t border-[#E2DAC7] w-full" />
              </div>

              {/* Mode Selector Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#F5EFE2] border border-[#E2DAC7]">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    clearAuthError();
                    setStatusNotice(null);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                    mode === 'login'
                      ? 'bg-[#1B4D48] text-[#FBF7EF]'
                      : 'text-[#4A6B66] hover:text-[#1B4D48]'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    clearAuthError();
                    setStatusNotice(null);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                    mode === 'register'
                      ? 'bg-[#1B4D48] text-[#FBF7EF]'
                      : 'text-[#4A6B66] hover:text-[#1B4D48]'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('reset');
                    clearAuthError();
                    setStatusNotice(null);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                    mode === 'reset'
                      ? 'bg-[#1B4D48] text-[#FBF7EF]'
                      : 'text-[#4A6B66] hover:text-[#1B4D48]'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#1B4D48] mb-1">
                      Student Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g., Aarav Sharma"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2DAC7] text-xs text-[#1B4D48] focus:outline-hidden focus:border-[#42BDAE]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#1B4D48] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2DAC7] text-xs text-[#1B4D48] focus:outline-hidden focus:border-[#42BDAE]"
                  />
                </div>

                {mode !== 'reset' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#1B4D48] mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2DAC7] text-xs text-[#1B4D48] focus:outline-hidden focus:border-[#42BDAE]"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#42BDAE] hover:bg-[#35A597] disabled:opacity-60 text-[#FBF7EF] text-xs font-bold transition cursor-pointer"
                >
                  {authLoading
                    ? 'Please wait...'
                    : mode === 'login'
                    ? 'Sign In with Email'
                    : mode === 'register'
                    ? 'Create Account & Sync'
                    : 'Send Password Reset Email'}
                </button>
              </form>

              {/* Auth Domain & Offline Storage Reassurance */}
              <div className="p-3 rounded-xl bg-[#F5EFE2] border border-[#E2DAC7] space-y-1 text-[11px] text-[#4A6B66]">
                <div className="flex items-center gap-1.5 font-semibold text-[#1B4D48]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#42BDAE] shrink-0" />
                  <span>Local Study Storage Always Active</span>
                </div>
                <p className="leading-relaxed">
                  Your syllabus, streaks, planner, and PYQ progress are automatically saved on your device and merged when you sign in.
                </p>
                <div className="pt-1 text-[10px] font-mono text-[#5B7A75] truncate">
                  authDomain: {diagnostics.authDomain || 'unconfigured'} · origin: {diagnostics.currentOrigin}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
