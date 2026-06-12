import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { bookingApi } from '../utils/bookingApi';
import { useToast } from '../hooks/useToast';

export default function AdminUnlock() {
  const [pin, setPin] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  async function unlock() {
    try {
      setLoading(true);
      await bookingApi.adminOverview(pin);
      sessionStorage.setItem('beccastouch_admin_pin', pin);
      showToast('Admin session unlocked.', 'success');
      navigate('/sg-bec');
    } catch {
      showToast('Access denied.', 'error');
      navigate('/not-found', { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    /* plain white page */
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-16">

      {/* glassmorphism halo — rose + purple gradient ring around the card */}
      <div className="relative">
        {/* outer glow ring */}
        <div
          className="absolute -inset-6 rounded-[52px] opacity-60 blur-2xl pointer-events-none"
          style={{
            background:
              'conic-gradient(from 0deg, #c8788a, #9b72d0, #6b3fa0, #e4a0b0, #c8788a)',
          }}
        />
        {/* second softer ring */}
        <div
          className="absolute -inset-3 rounded-[48px] opacity-35 blur-xl pointer-events-none"
          style={{
            background: 'linear-gradient(135deg,#c8788a 0%,#9b72d0 50%,#3d1f6e 100%)',
          }}
        />

        {/* card */}
        <div
          className="relative w-full max-w-sm rounded-[40px] p-8 shadow-[0_32px_80px_rgba(107,63,160,0.18)]"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1.5px solid rgba(155,114,208,0.3)',
          }}
        >
          {/* icon */}
          <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#c8788a,#9b72d0)' }}>
            <Shield size={22} className="text-white"/>
          </div>

          <p className="text-[10px] uppercase tracking-[0.3em] font-semibold text-center text-[#9b72d0] mb-2">
            Admin Access
          </p>
          <h1 className="font-display text-3xl text-[#3d1f6e] text-center mb-2">
            Private access
          </h1>
          <p className="text-center text-[#7a5aa8] text-sm mb-7 leading-relaxed">
            Enter the admin PIN to unlock the dashboard for this browser session.
          </p>

          {/* PIN input — blush pink inner */}
          <div className="relative mb-5">
            <input
              type={show ? 'text' : 'password'}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g,''))}
              onKeyDown={e => e.key === 'Enter' && unlock()}
              inputMode="numeric"
              pattern="[0-9]*"
              className="w-full rounded-2xl px-4 py-4 text-center tracking-[0.45em] text-[#3d1f6e] font-semibold text-lg outline-none transition pr-12"
              style={{
                background: 'transparent',
                border: '1.5px solid rgba(155,114,208,0.3)',
              }}
              onFocus={e => { e.target.style.border = '1.5px solid #9b72d0'; e.target.style.boxShadow = '0 0 0 3px rgba(155,114,208,0.15)'; }}
              onBlur={e  => { e.target.style.border = '1.5px solid rgba(155,114,208,0.3)'; e.target.style.boxShadow = 'none'; }}
              placeholder=""
            />
            <button
              type="button"
              onClick={() => setShow(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9b72d0]"
            >
              {show ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>

          <button
            type="button"
            onClick={unlock}
            disabled={loading || !pin}
            className="btn-ink w-full justify-center"
          >
            {loading ? 'Checking…' : 'Unlock Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
