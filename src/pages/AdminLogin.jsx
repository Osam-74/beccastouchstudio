import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from '../hooks/useToast';

const ADMIN_EMAIL = 'beccastouchstudio@gmail.com';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ login_hint: ADMIN_EMAIL });

export default function AdminLogin({ onLogin }) {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [gLoading, setGLoading]   = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { showToast } = useToast();

  async function finishLogin(user) {
    if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      await firebaseAuth.signOut().catch(() => {});
      showToast('Access denied — this panel is restricted to the studio admin.', 'error');
      return;
    }
    const idToken = await user.getIdToken();
    onLogin(idToken, user.email);
  }

  async function login(e) {
    e.preventDefault();
    if (!email.trim() || !password) return showToast('Enter your email and password.', 'error');
    try {
      setLoading(true);
      const cred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await finishLogin(cred.user);
    } catch (err) {
      const c = err.code || '';
      if (c.includes('user-not-found') || c.includes('wrong-password') || c.includes('invalid-credential')) {
        showToast('Incorrect email or password.', 'error');
      } else if (c.includes('too-many-requests')) {
        showToast('Too many attempts — please wait a moment.', 'error');
      } else {
        showToast(err.message || 'Login failed.', 'error');
      }
    } finally { setLoading(false); }
  }

  async function loginWithGoogle() {
    try {
      setGLoading(true);
      const cred = await signInWithPopup(firebaseAuth, googleProvider);
      await finishLogin(cred.user);
    } catch (err) {
      if (!err.code?.includes('popup-closed') && !err.code?.includes('cancelled-popup')) {
        showToast(err.message || 'Google sign-in failed.', 'error');
      }
    } finally { setGLoading(false); }
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
    } finally { setLoading(false); }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-5 py-10"
      style={{ background: '#fdf6f8' }}
    >
      {/* Soft ambient petals — very subtle, purely decorative */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        {/* top-left warm blush */}
        <div style={{
          position: 'absolute', top: '-8%', left: '-12%',
          width: '52%', height: '52%', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,210,220,0.38) 0%, transparent 68%)',
          filter: 'blur(48px)',
        }}/>
        {/* bottom-right warm rose */}
        <div style={{
          position: 'absolute', bottom: '-10%', right: '-10%',
          width: '50%', height: '50%', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(240,190,205,0.32) 0%, transparent 68%)',
          filter: 'blur(52px)',
        }}/>
        {/* centre whisper */}
        <div style={{
          position: 'absolute', top: '38%', left: '30%',
          width: '40%', height: '38%', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,230,238,0.22) 0%, transparent 70%)',
          filter: 'blur(36px)',
        }}/>
      </div>

      {/* Card */}
      <div
        className="relative w-full max-w-[370px]"
        style={{
          background: '#ffffff',
          border: '1px solid rgba(220,170,185,0.22)',
          borderRadius: '28px',
          boxShadow: '0 4px 40px rgba(200,120,138,0.10), 0 1px 4px rgba(180,100,120,0.06)',
          padding: '40px 32px 36px',
        }}
      >
        {/* ── Logo / header ── */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {/* petal icon */}
          <div style={{
            width: 52, height: 52, borderRadius: '50%', margin: '0 auto 14px',
            background: 'linear-gradient(135deg, #fce8ee 0%, #f5ccd8 100%)',
            border: '1px solid rgba(200,120,138,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(200,120,138,0.15)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C9.5 2 7 4 7 7c0 2.5 2 4.5 5 5 3-0.5 5-2.5 5-5 0-3-2.5-5-5-5z" fill="#c8788a" opacity="0.9"/>
              <path d="M12 12c-2.5 0.5-5 2.5-5 5 0 2.5 2 4 5 4s5-1.5 5-4c0-2.5-2.5-4.5-5-5z" fill="#c8788a" opacity="0.55"/>
              <path d="M5 9C3 9 2 11 2 12.5S3.5 16 5.5 16c1.5 0 3.5-1 4.5-3C8.5 10 6.5 9 5 9z" fill="#c8788a" opacity="0.4"/>
              <path d="M19 9c-1.5 0-3.5 1-4.5 4 1 2 3 3 4.5 3C21 16 22 14.5 22 12.5S21 9 19 9z" fill="#c8788a" opacity="0.4"/>
            </svg>
          </div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#3d1f6e', letterSpacing: '-0.3px' }}>
            Beccastouch <span style={{ color: '#c8788a', fontStyle: 'italic' }}>Studio</span>
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#b89aaa', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
            Admin Portal
          </p>
        </div>

        {resetSent ? (
          /* ── Reset sent ── */
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', margin: '0 auto 12px',
              background: '#fce8ee', border: '1px solid rgba(200,120,138,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" fill="none" stroke="#c8788a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <p style={{ color: '#3d1f6e', fontWeight: 700, fontSize: 16, margin: '0 0 8px' }}>Check your inbox</p>
            <p style={{ color: '#9a7090', fontSize: 13, lineHeight: 1.6, margin: '0 0 16px' }}>
              A reset link was sent to{' '}
              <span style={{ color: '#c8788a', fontWeight: 600 }}>{email}</span>.
            </p>
            <button
              onClick={() => { setResetMode(false); setResetSent(false); }}
              style={{ color: '#c8788a', fontSize: 12, fontWeight: 600, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Back to login
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Email ── */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9a7090', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 12, fontSize: 14,
                  background: '#fdf6f8', border: '1.5px solid #f0dce4',
                  color: '#3d1f6e', outline: 'none', boxSizing: 'border-box',
                  caretColor: '#c8788a', transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#c8788a'}
                onBlur={e => e.target.style.borderColor = '#f0dce4'}
              />
            </div>

            {/* ── Password ── */}
            {!resetMode && (
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9a7090', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    style={{
                      width: '100%', padding: '11px 42px 11px 14px', borderRadius: 12, fontSize: 14,
                      background: '#fdf6f8', border: '1.5px solid #f0dce4',
                      color: '#3d1f6e', outline: 'none', boxSizing: 'border-box',
                      caretColor: '#c8788a', transition: 'border-color 0.15s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#c8788a'}
                    onBlur={e => e.target.style.borderColor = '#f0dce4'}
                    onKeyDown={e => e.key === 'Enter' && login(e)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#c8a0b0', padding: 0, display: 'flex' }}
                  >
                    {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>
            )}

            {/* ── Forgot link ── */}
            {!resetMode && (
              <div style={{ textAlign: 'right', marginTop: -8 }}>
                <button
                  type="button"
                  onClick={() => setResetMode(true)}
                  style={{ fontSize: 11, color: '#c8788a', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* ── Primary button ── */}
            <button
              onClick={resetMode ? sendReset : login}
              disabled={loading}
              style={{
                width: '100%', padding: '13px', borderRadius: 14, fontSize: 14, fontWeight: 700,
                background: loading
                  ? '#f0d0da'
                  : 'linear-gradient(135deg, #c8788a 0%, #a05578 100%)',
                color: loading ? '#b08090' : '#fff',
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 18px rgba(200,120,138,0.30)',
                transition: 'all 0.2s', letterSpacing: '0.02em',
              }}
            >
              {loading
                ? (resetMode ? 'Sending…' : 'Signing in…')
                : (resetMode ? 'Send reset email' : 'Sign in')}
            </button>

            {/* ── Divider + Google ── */}
            {!resetMode && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
                  <div style={{ flex: 1, height: 1, background: '#f0dce4' }}/>
                  <span style={{ fontSize: 10, color: '#c8a8b8', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>or</span>
                  <div style={{ flex: 1, height: 1, background: '#f0dce4' }}/>
                </div>

                <button
                  type="button"
                  onClick={loginWithGoogle}
                  disabled={gLoading}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 14, fontSize: 13, fontWeight: 600,
                    background: '#fff', border: '1.5px solid #f0dce4',
                    color: '#3d1f6e', cursor: gLoading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    boxShadow: '0 1px 6px rgba(200,120,138,0.08)',
                    transition: 'all 0.15s', opacity: gLoading ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { if (!gLoading) e.currentTarget.style.borderColor = '#c8788a'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#f0dce4'; }}
                >
                  {gLoading ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8788a" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                        <animateTransform attributeName="transform" type="rotate" values="0 12 12;360 12 12" dur="0.8s" repeatCount="indefinite"/>
                      </path>
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.96 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                  )}
                  {gLoading ? 'Connecting…' : 'Continue with Google'}
                </button>

                {/* ── Reset link (bottom) ── */}
                <p style={{ textAlign: 'center', margin: '4px 0 0', fontSize: 12, color: '#b89aaa' }}>
                  <button
                    type="button"
                    onClick={() => setResetMode(true)}
                    style={{ color: '#c8788a', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                  >
                    Reset password
                  </button>
                </p>
              </>
            )}

            {/* ── Cancel reset ── */}
            {resetMode && (
              <p style={{ textAlign: 'center', margin: '4px 0 0', fontSize: 12 }}>
                <button
                  type="button"
                  onClick={() => setResetMode(false)}
                  style={{ color: '#c8788a', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                >
                  ← Back to login
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
