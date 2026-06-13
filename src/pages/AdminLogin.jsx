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
      style={{
        background: 'linear-gradient(135deg, #1a0933 0%, #3d1f6e 40%, #7b3fa0 70%, #c8788a 100%)',
      }}
    >
      {/* Soft ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div style={{ position:'absolute', top:'-10%', left:'-10%', width:'55%', height:'55%',
          borderRadius:'50%', background:'radial-gradient(circle, rgba(200,120,138,0.25) 0%, transparent 70%)', filter:'blur(40px)' }}/>
        <div style={{ position:'absolute', bottom:'-10%', right:'-10%', width:'55%', height:'55%',
          borderRadius:'50%', background:'radial-gradient(circle, rgba(155,114,208,0.3) 0%, transparent 70%)', filter:'blur(40px)' }}/>
        <div style={{ position:'absolute', top:'40%', left:'35%', width:'35%', height:'35%',
          borderRadius:'50%', background:'radial-gradient(circle, rgba(255,220,230,0.12) 0%, transparent 70%)', filter:'blur(30px)' }}/>
      </div>

      {/* Glass card */}
      <div
        className="relative w-full max-w-[360px]"
        style={{
          background: 'rgba(255,248,252,0.10)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,220,235,0.25)',
          borderRadius: '28px',
          boxShadow: '0 8px 48px rgba(61,31,110,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
          padding: '36px 32px 32px',
        }}
      >

        {resetSent ? (
          /* ── Reset sent ── */
          <div className="text-center space-y-4 py-4">
            <div style={{
              width:52, height:52, borderRadius:'50%', margin:'0 auto 8px',
              background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,220,235,0.3)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg width="22" height="22" fill="none" stroke="#ffd6e4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <p style={{ color:'#ffeef5', fontWeight:700, fontSize:16 }}>Check your email</p>
            <p style={{ color:'rgba(255,220,235,0.75)', fontSize:13, lineHeight:1.6 }}>
              A password reset link was sent to <span style={{ color:'#ffd6e4', fontWeight:600 }}>{email}</span>.
            </p>
            <button
              onClick={() => { setResetMode(false); setResetSent(false); }}
              style={{ color:'rgba(255,210,230,0.8)', fontSize:12, textDecoration:'underline', background:'none', border:'none', cursor:'pointer', marginTop:8 }}
            >
              Back to login
            </button>
          </div>
        ) : (
          <div className="space-y-4">

            {/* ── Email field ── */}
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'rgba(255,220,235,0.7)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="admin@example.com"
                style={{
                  width:'100%', padding:'12px 16px', borderRadius:14, fontSize:14,
                  background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,220,235,0.2)',
                  color:'#fff5f9', outline:'none', boxSizing:'border-box',
                  caretColor:'#ffb3cc',
                }}
                onFocus={e => e.target.style.borderColor='rgba(255,180,210,0.5)'}
                onBlur={e => e.target.style.borderColor='rgba(255,220,235,0.2)'}
              />
            </div>

            {/* ── Password field (hidden in reset mode) ── */}
            {!resetMode && (
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:'rgba(255,220,235,0.7)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>
                  Password
                </label>
                <div style={{ position:'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    style={{
                      width:'100%', padding:'12px 44px 12px 16px', borderRadius:14, fontSize:14,
                      background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,220,235,0.2)',
                      color:'#fff5f9', outline:'none', boxSizing:'border-box',
                      caretColor:'#ffb3cc',
                    }}
                    onFocus={e => e.target.style.borderColor='rgba(255,180,210,0.5)'}
                    onBlur={e => e.target.style.borderColor='rgba(255,220,235,0.2)'}
                    onKeyDown={e => e.key==='Enter' && login(e)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(255,200,220,0.6)', padding:0, display:'flex' }}
                  >
                    {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>
            )}

            {/* ── Submit button ── */}
            <button
              onClick={resetMode ? sendReset : login}
              disabled={loading}
              style={{
                width:'100%', padding:'13px', borderRadius:16, fontSize:14, fontWeight:700,
                background: loading
                  ? 'rgba(200,120,138,0.4)'
                  : 'linear-gradient(135deg, #c8788a 0%, #9b72d0 100%)',
                color:'#fff', border:'none', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(200,120,138,0.35)',
                transition:'all 0.2s', letterSpacing:'0.02em',
              }}
            >
              {loading
                ? (resetMode ? 'Sending…' : 'Signing in…')
                : (resetMode ? 'Send reset email' : 'Sign in')}
            </button>

            {/* ── Divider + Google (login mode only) ── */}
            {!resetMode && (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:12, margin:'4px 0' }}>
                  <div style={{ flex:1, height:1, background:'rgba(255,200,220,0.18)' }}/>
                  <span style={{ fontSize:10, color:'rgba(255,200,220,0.45)', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase' }}>or</span>
                  <div style={{ flex:1, height:1, background:'rgba(255,200,220,0.18)' }}/>
                </div>

                <button
                  type="button"
                  onClick={loginWithGoogle}
                  disabled={gLoading}
                  style={{
                    width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                    padding:'12px', borderRadius:16, fontSize:13, fontWeight:600,
                    background:'rgba(255,255,255,0.10)', border:'1px solid rgba(255,220,235,0.22)',
                    color:'#fff5f9', cursor: gLoading ? 'not-allowed' : 'pointer',
                    backdropFilter:'blur(8px)', transition:'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.16)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.10)'}
                >
                  {/* Google G */}
                  <svg width="17" height="17" viewBox="0 0 48 48" fill="none">
                    <path d="M47.5 24.5c0-1.6-.1-3.2-.4-4.7H24.3v9h13.1c-.6 3-2.4 5.5-5 7.2v6h8.1c4.7-4.4 7-10.8 7-17.5z" fill="#4285F4"/>
                    <path d="M24.3 48c6.5 0 12-2.1 16-5.8l-8.1-6c-2.2 1.5-5 2.4-7.9 2.4-6.1 0-11.2-4.1-13-9.6H3v6.2C7 42.7 15.1 48 24.3 48z" fill="#34A853"/>
                    <path d="M11.3 29c-.5-1.5-.7-3-.7-4.5s.3-3.1.7-4.5v-6.2H3A23.8 23.8 0 0 0 .5 24c0 3.8.9 7.5 2.5 10.7l8.3-5.7z" fill="#FBBC05"/>
                    <path d="M24.3 9.5c3.4 0 6.5 1.2 8.9 3.5l6.7-6.7C35.8 2.5 30.4 0 24.3 0 15.1 0 7 5.3 3 13.3l8.3 6.2c1.8-5.5 6.9-10 13-10z" fill="#EA4335"/>
                  </svg>
                  {gLoading ? 'Opening Google…' : 'Continue with Google'}
                </button>
              </>
            )}

            {/* ── Forgot password / back ── */}
            <div style={{ textAlign:'center', paddingTop:4 }}>
              {resetMode ? (
                <button type="button" onClick={() => setResetMode(false)}
                  style={{ fontSize:12, color:'rgba(255,200,220,0.7)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3 }}>
                  Back to login
                </button>
              ) : (
                <button type="button" onClick={() => setResetMode(true)}
                  style={{ fontSize:12, color:'rgba(255,200,220,0.7)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3 }}>
                  Forgot password?
                </button>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
