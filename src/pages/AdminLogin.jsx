import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import { Eye, EyeOff, Shield, Mail } from 'lucide-react';
import { useToast } from '../hooks/useToast';

// ── The one email that is allowed to access the admin panel ──────────────────
// Change this to your admin email. Anyone else is rejected even if Firebase
// lets them sign in (e.g. if they somehow have a Google account).
const ADMIN_EMAIL = 'beccastouchstudio@gmail.com';

const googleProvider = new GoogleAuthProvider();
// Hint: pre-fill the admin email in the Google account picker
googleProvider.setCustomParameters({ login_hint: ADMIN_EMAIL });

export default function AdminLogin({ onLogin }) {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { showToast } = useToast();

  // ── Shared: check the signed-in email matches ADMIN_EMAIL ─────────────────
  async function finishLogin(user) {
    if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      await firebaseAuth.signOut().catch(() => {});
      showToast('Access denied. This panel is restricted to the studio admin.', 'error');
      return;
    }
    const idToken = await user.getIdToken();
    onLogin(idToken, user.email);
  }

  // ── Email / password ───────────────────────────────────────────────────────
  async function login(e) {
    e.preventDefault();
    if (!email.trim() || !password) return showToast('Enter your email and password.', 'error');
    try {
      setLoading(true);
      const cred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await finishLogin(cred.user);
    } catch (err) {
      const code = err.code || '';
      if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
        showToast('Incorrect email or password.', 'error');
      } else if (code.includes('too-many-requests')) {
        showToast('Too many attempts — please wait a moment and try again.', 'error');
      } else {
        showToast(err.message || 'Login failed.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Google sign-in ─────────────────────────────────────────────────────────
  async function loginWithGoogle() {
    try {
      setGoogleLoading(true);
      const cred = await signInWithPopup(firebaseAuth, googleProvider);
      await finishLogin(cred.user);
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // User closed the popup — silent
      } else {
        showToast(err.message || 'Google sign-in failed.', 'error');
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  // ── Forgot password ────────────────────────────────────────────────────────
  async function sendReset(e) {
    e.preventDefault();
    if (!email.trim()) return showToast('Enter your email address first.', 'error');
    try {
      setLoading(true);
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      setResetSent(true);
    } catch (err) {
      showToast(err.message || 'Could not send reset email.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-16">
      <div className="relative">
        {/* glow rings */}
        <div className="absolute -inset-6 rounded-[52px] opacity-60 blur-2xl pointer-events-none"
          style={{ background: 'conic-gradient(from 0deg, #c8788a, #9b72d0, #6b3fa0, #e4a0b0, #c8788a)' }}/>
        <div className="absolute -inset-3 rounded-[48px] opacity-35 blur-xl pointer-events-none"
          style={{ background: 'linear-gradient(135deg,#c8788a 0%,#9b72d0 50%,#3d1f6e 100%)' }}/>

        {/* card */}
        <div className="relative w-full max-w-sm rounded-[40px] p-8 shadow-[0_32px_80px_rgba(107,63,160,0.18)]"
          style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1.5px solid rgba(155,114,208,0.3)' }}>

          {/* icon */}
          <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#c8788a,#9b72d0)' }}>
            <Shield size={22} className="text-white"/>
          </div>

          <p className="text-[10px] uppercase tracking-[0.3em] font-semibold text-center text-[#9b72d0] mb-2">
            Admin Access
          </p>
          <h1 className="font-display text-3xl text-[#3d1f6e] text-center mb-2">
            {resetMode ? 'Reset password' : 'Private access'}
          </h1>
          <p className="text-center text-[#7a5aa8] text-sm mb-7 leading-relaxed">
            {resetMode
              ? "Enter your email and we'll send you a password reset link."
              : 'Sign in with your admin email and password.'}
          </p>

          {resetSent ? (
            /* ── Reset sent confirmation ── */
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-[#f0faf3] border border-[#b8e0c8]">
                <Mail size={20} className="text-[#3d7a53]"/>
              </div>
              <p className="text-sm text-[#3d7a53] font-semibold">Reset email sent!</p>
              <p className="text-xs text-[#7a5aa8]">
                Check your inbox for <b>{email}</b> and follow the link to set a new password.
              </p>
              <button type="button" onClick={() => { setResetMode(false); setResetSent(false); }}
                className="text-xs text-[#9b72d0] underline underline-offset-2 mt-2">
                Back to login
              </button>
            </div>
          ) : (
            /* ── Login / reset form ── */
            <div className="space-y-4">
              <form onSubmit={resetMode ? sendReset : login} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="label-text block mb-1">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    className="input-field w-full"
                    placeholder="admin@example.com"
                    required
                  />
                </div>

                {/* Password — hidden in reset mode */}
                {!resetMode && (
                  <div>
                    <label className="label-text block mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete="current-password"
                        className="input-field w-full pr-12"
                        placeholder="••••••••"
                        required
                      />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9b72d0]">
                        {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                      </button>
                    </div>
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="btn-ink w-full justify-center">
                  {loading
                    ? (resetMode ? 'Sending…' : 'Signing in…')
                    : (resetMode ? 'Send reset email' : 'Sign in')}
                </button>
              </form>

              {/* Divider — only on login mode */}
              {!resetMode && (
                <>
                  <div className="flex items-center gap-3 my-1">
                    <div className="flex-1 h-px bg-[#eecdd4]"/>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#c8a0b0]">or</span>
                    <div className="flex-1 h-px bg-[#eecdd4]"/>
                  </div>

                  {/* Google sign-in */}
                  <button
                    type="button"
                    onClick={loginWithGoogle}
                    disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl border border-[#e0d8ee] bg-white hover:bg-[#fdf6ff] transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {/* Google G logo */}
                    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                      <path d="M47.5 24.5c0-1.6-.1-3.2-.4-4.7H24.3v9h13.1c-.6 3-2.4 5.5-5 7.2v6h8.1c4.7-4.4 7-10.8 7-17.5z" fill="#4285F4"/>
                      <path d="M24.3 48c6.5 0 12-2.1 16-5.8l-8.1-6c-2.2 1.5-5 2.4-7.9 2.4-6.1 0-11.2-4.1-13-9.6H3v6.2C7 42.7 15.1 48 24.3 48z" fill="#34A853"/>
                      <path d="M11.3 29c-.5-1.5-.7-3-.7-4.5s.3-3.1.7-4.5v-6.2H3A23.8 23.8 0 0 0 .5 24c0 3.8.9 7.5 2.5 10.7l8.3-5.7z" fill="#FBBC05"/>
                      <path d="M24.3 9.5c3.4 0 6.5 1.2 8.9 3.5l6.7-6.7C35.8 2.5 30.4 0 24.3 0 15.1 0 7 5.3 3 13.3l8.3 6.2c1.8-5.5 6.9-10 13-10z" fill="#EA4335"/>
                    </svg>
                    <span className="text-sm font-semibold text-[#3d1f6e]">
                      {googleLoading ? 'Opening Google…' : 'Continue with Google'}
                    </span>
                  </button>
                </>
              )}

              {/* Forgot password / back */}
              <div className="text-center pt-1">
                {resetMode ? (
                  <button type="button" onClick={() => setResetMode(false)}
                    className="text-xs text-[#9b72d0] underline underline-offset-2">
                    Back to login
                  </button>
                ) : (
                  <button type="button" onClick={() => setResetMode(true)}
                    className="text-xs text-[#9b72d0] underline underline-offset-2">
                    Forgot password?
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
