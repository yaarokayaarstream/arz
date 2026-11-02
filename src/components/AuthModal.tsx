import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  MailCheck,
  RefreshCw,
} from 'lucide-react';
import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  requestPasswordReset,
  resendVerificationEmail,
  EmailNotVerifiedError,
} from '../services/firebaseAuth';
import { User as FirebaseUser } from 'firebase/auth';

export type AuthMode = 'login' | 'signup' | 'forgot' | 'google';

interface DetailedAuthError {
  code: string;
  title: string;
  message: string;
  type: 'unauthorized-domain' | 'operation-not-allowed' | 'popup-blocked' | 'popup-closed' | 'general';
  domain?: string;
  actionUrl?: string;
  actionText?: string;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
  onSuccess?: (user: FirebaseUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onSuccess,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode === 'google' ? 'login' : initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<DetailedAuthError | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const resetForm = () => {
    setError(null);
    setDetailedError(null);
    setSuccessMessage(null);
    setResendStatus(null);
  };

  const switchMode = (newMode: AuthMode) => {
    resetForm();
    setUnverifiedEmail(null);
    setMode(newMode);
  };

  const handleCopyDomain = (domainToCopy: string) => {
    try {
      navigator.clipboard.writeText(domainToCopy);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setDetailedError(null);
    try {
      const user = await loginWithGoogle();
      if (onSuccess) onSuccess(user);
      onClose();
    } catch (err: any) {
      const code = err.code || '';
      const rawMsg = err.message || '';
      const currentDomain = window.location.hostname;

      if (code === 'auth/unauthorized-domain' || rawMsg.includes('unauthorized-domain')) {
        setDetailedError({
          code: 'auth/unauthorized-domain',
          title: 'Firebase Domain Authorization Required',
          message: `Google Sign-In काम करने के लिए इस Domain (${currentDomain}) को आपके Firebase Console के "Authorized Domains" में जोड़ना होगा।`,
          type: 'unauthorized-domain',
          domain: currentDomain,
          actionUrl: 'https://console.firebase.google.com/project/yaarokayaarstream/authentication/settings',
          actionText: 'Open Firebase Settings: Authorized Domains',
        });
      } else if (code === 'auth/operation-not-allowed' || rawMsg.includes('operation-not-allowed')) {
        setDetailedError({
          code: 'auth/operation-not-allowed',
          title: 'Google Sign-In Provider Disabled',
          message: 'Firebase Console में Google Sign-In Provider को Enable (चालू) करना होगा।',
          type: 'operation-not-allowed',
          actionUrl: 'https://console.firebase.google.com/project/yaarokayaarstream/authentication/providers',
          actionText: 'Open Firebase: Enable Google Provider',
        });
      } else if (code === 'auth/popup-blocked' || rawMsg.includes('popup-blocked')) {
        setDetailedError({
          code: 'auth/popup-blocked',
          title: 'Browser Popup Blocked',
          message: 'ब्राउज़र ने Google Sign-In पॉपअप विंडो रोक दी है। कृपया Address Bar से Pop-ups को Allow करें।',
          type: 'popup-blocked',
        });
      } else if (code === 'auth/popup-closed-by-user' || rawMsg.includes('popup-closed')) {
        setDetailedError({
          code: 'auth/popup-closed-by-user',
          title: 'Sign-in Cancelled',
          message: 'गूगल लॉगिन विंडो पूरी होने से पहले बंद कर दी गई थी। कृपया पुनः प्रयास करें।',
          type: 'popup-closed',
        });
      } else {
        const cleanMsg = rawMsg.replace(/^Firebase:\s*/i, '').replace(/\(auth\/[^)]+\)\.?/i, '').trim();
        setError(cleanMsg || 'Google sign in failed. Please try again or use Email Login below.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-trigger Google sign-in if opened with 'google' mode
  useEffect(() => {
    if (isOpen) {
      if (initialMode === 'google') {
        setMode('login');
        handleGoogleSignIn();
      } else {
        setMode(initialMode);
      }
    } else {
      resetForm();
    }
  }, [isOpen, initialMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDetailedError(null);
    setSuccessMessage(null);

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if ((mode === 'login' || mode === 'signup') && password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const user = await loginWithEmail(email, password);
        setUnverifiedEmail(null);
        if (onSuccess) onSuccess(user);
        onClose();
      } else if (mode === 'signup') {
        await registerWithEmail(email, password, displayName);
        const sentEmail = email.trim();
        setUnverifiedEmail(sentEmail);
        setSuccessMessage(
          `सत्यापन लिंक आपके ईमेल (${sentEmail}) पर भेज दिया गया है! कृपया इनबॉक्स या स्पैम फ़ोल्डर जाँचें और लिंक पर क्लिक करने के बाद लॉगिन करें।`
        );
        setMode('login');
      } else if (mode === 'forgot') {
        await requestPasswordReset(email);
        setSuccessMessage('Password reset instructions have been sent to your email.');
      }
    } catch (err: any) {
      if (err instanceof EmailNotVerifiedError || err.name === 'EmailNotVerifiedError') {
        setUnverifiedEmail(err.email || email.trim());
        setError(null);
        return;
      }
      let msg = err.message || 'Authentication failed.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Invalid email address or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please login instead.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    setIsResendingVerification(true);
    setResendStatus(null);
    try {
      await resendVerificationEmail(unverifiedEmail, password);
      setResendStatus(`सत्यापन ईमेल (${unverifiedEmail}) पर फिर से भेज दिया गया है! कृपया इनबॉक्स या स्पैम फ़ोल्डर देखें।`);
    } catch (err: any) {
      setResendStatus(
        'सत्यापन लिंक भेजने के लिए कृपया नीचे पासवर्ड सही दर्ज करें और फिर Resend दबाएँ।'
      );
    } finally {
      setIsResendingVerification(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[400px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="px-5 py-4 bg-gradient-to-r from-rose-600 via-indigo-600 to-indigo-700 text-white flex items-center justify-between shadow-2xs">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
              {mode === 'login' && 'Welcome Back'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'forgot' && 'Reset Password'}
            </h2>
            <p className="text-[11px] text-white/80 font-medium">
              Yaaro Ka Yaar Stream Portal
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Detailed Diagnostic Error Box for Google Sign-In issues */}
          {detailedError && (
            <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-slate-800 text-xs space-y-2.5 animate-in fade-in shadow-xs">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <div className="font-extrabold text-amber-950 text-xs flex items-center justify-between">
                    <span>{detailedError.title}</span>
                    <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded font-mono">
                      {detailedError.code}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900 mt-1 leading-relaxed">
                    {detailedError.message}
                  </p>
                </div>
              </div>

              {detailedError.domain && (
                <div className="p-2 bg-white rounded-lg border border-amber-200 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    <span>Domain to Authorize:</span>
                    {copiedDomain && (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Copied!
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <code className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-800 select-all truncate">
                      {detailedError.domain}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopyDomain(detailedError.domain!)}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 active:scale-95"
                    >
                      {copiedDomain ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedDomain ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              )}

              {detailedError.actionUrl && (
                <div className="space-y-1 pt-1">
                  <a
                    href={detailedError.actionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-2xs transition-colors"
                  >
                    <span>{detailedError.actionText || 'Open Firebase Settings'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <p className="text-[10px] text-amber-900/90 text-center">
                    Firebase Console → <strong>Authorized domains</strong> में डोमेन Add करें।
                  </p>
                </div>
              )}

              <div className="text-[10px] text-slate-600 pt-1.5 border-t border-amber-200/80 flex items-center gap-1">
                <span className="font-bold text-amber-900">💡 Alternately:</span>
                <span>नीचे दिए <strong>Email & Password</strong> से अभी तुरंत Sign Up या Login करें!</span>
              </div>
            </div>
          )}

          {/* Standard Error Message */}
          {error && !detailedError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Dedicated Email Verification Alert */}
          {unverifiedEmail && (
            <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-300 text-slate-800 text-xs space-y-2 animate-in fade-in shadow-xs">
              <div className="flex items-start gap-2">
                <MailCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-amber-950 text-xs flex items-center justify-between">
                    <span>ईमेल सत्यापन आवश्यक है (Verification Required)</span>
                    <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded font-mono font-bold">
                      Unverified
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900 mt-0.5 leading-relaxed">
                    लॉगिन करने के लिए आपके ईमेल (<strong className="font-mono text-slate-900">{unverifiedEmail}</strong>) पर भेजे गए सत्यापन लिंक पर क्लिक करें।
                  </p>
                </div>
              </div>

              <div className="pt-0.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isResendingVerification}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-60"
                >
                  <RefreshCw className={`w-3 h-3 ${isResendingVerification ? 'animate-spin' : ''}`} />
                  <span>{isResendingVerification ? 'भेजा जा रहा है...' : 'सत्यापन लिंक फिर से भेजें (Resend)'}</span>
                </button>
                <span className="text-[10px] text-slate-500">
                  (स्पैम फ़ोल्डर भी देखें)
                </span>
              </div>

              {resendStatus && (
                <p className="text-[11px] font-bold text-emerald-800 bg-white p-1.5 rounded-lg border border-emerald-200">
                  ✓ {resendStatus}
                </p>
              )}
            </div>
          )}

          {/* Google Sign-in Button (Shown in login and signup) */}
          {mode !== 'forgot' && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-700 flex items-center justify-center gap-3 shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-[0.98] disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  or with email
                </span>
                <div className="border-t border-slate-200 w-full" />
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Display Name (Only in Signup) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Yaaro Ka Yaar"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4 text-indigo-600" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Password Field (Login and Signup) */}
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4 text-indigo-600" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Confirm Password Field (Only Signup) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4 text-indigo-600" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98] mt-2"
            >
              <span>
                {isLoading
                  ? 'Processing...'
                  : mode === 'login'
                  ? 'Login to Account'
                  : mode === 'signup'
                  ? 'Complete Sign Up'
                  : 'Send Reset Link'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Footer Navigation Switcher */}
          <div className="pt-2 border-t border-slate-100 text-center text-xs text-slate-500">
            {mode === 'login' && (
              <p>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                >
                  Sign Up
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                >
                  Login
                </button>
              </p>
            )}
            {mode === 'forgot' && (
              <p>
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                >
                  Back to Login
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
