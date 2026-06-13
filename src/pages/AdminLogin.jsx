import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import { Eye, EyeOff, Shield, Mail } from 'lucide-react';
import { useToast } from '../hooks/useToast';

/**
 * AdminLogin — Firebase Email/Password auth for the admin panel.
 * No register button. Forgot password sends a reset email via Firebase.
 */
export default function AdminLogin({ onLogin }) {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { showToast } = useToast();

  async function login(e) {
    e.preventDefault();
    if (!email.trim() || !password) return showToast('Enter your email and password.', 'error');
    try {
      setLoading(true);
      const cred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      const idToken = await cred.user.getIdToken();
      onLogin(idToken, cred.user.email);
    } catch (err) {
      const code = err.code || '';
      if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
        showToast('Incorrect email or password.', 'error');
      } else if (code.includes('too-many-requests')) {
        showToast('Too many attempts. Please wait a moment and try again.', 'error');
      } else {
        showToast(err.message || 'Login failed.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

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
        {/* outer glow ring */}
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
              ? 'Enter your email and we\'ll send you a password reset link.'
              : 'Sign in with your admin email and password.'}
          </p>

          {resetSent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-[#f0faf3] border border-[#b8e0c8]">
                <Mail size={20} className="text-[#3d7a53]"/>
              </div>
              <p className="text-sm text-[#3d7a53] font-semibold">Reset email sent!</p>
              <p className="text-xs text-[#7a5aa8]">Check your inbox for <b>{email}</b> and follow the link to set a new password.</p>
              <button type="button" onClick={() => { setResetMode(false); setResetSent(false); }}
                className="text-xs text-[#9b72d0] underline underline-offset-2 mt-2">
                Back to login
              </button>
            </div>
          ) : (
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
                {loading ? (resetMode ? 'Sending…' : 'Signing in…') : (resetMode ? 'Send reset email' : 'Sign in')}
              </button>

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
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
