import { X, Mail, CheckCircle2, ArrowRight, Copy } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function ThankYouModal({ booking, onClose }) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  if (!booking) return null;
  function handleClose() { if (onClose) onClose(); navigate('/'); }
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[3px]" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] bg-white shadow-[0_-8px_60px_rgba(180,80,110,0.18)] overflow-hidden"
      >
        {/* gradient top strip */}
        <div className="h-2 w-full" style={{ background:'linear-gradient(90deg,#c8788a,#e4a0b0,#f2c4ac)' }} />

        <button type="button" onClick={handleClose} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#fdf0f2] border border-[#eecdd4] flex items-center justify-center text-[#9a6070]"><X size={14}/></button>

        <div className="px-6 pt-6 pb-8">
          {/* big thank you */}
          <div className="text-center mb-6">
            <p className="text-4xl mb-2">✨</p>
            <h2 className="font-display text-3xl text-[#3d1f6e] mb-1">Thank you!</h2>
            <p className="text-[#7a5460] text-sm">Your booking has been received.</p>
          </div>

          {/* booking ID + copy */}
          <div className="rose-card px-4 py-3 mb-5">
            <p className="label-text mb-1 text-center">Your Booking ID</p>
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-base font-bold text-[#3d1f6e] flex-1 text-center">{booking.bookingId}</p>
              <button type="button"
                onClick={() => { navigator.clipboard.writeText(booking.bookingId); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-[#eecdd4] bg-white text-xs font-semibold text-[#7a5460] hover:bg-[#fce4ea] transition-all">
                {copied ? '✓ Copied!' : <><Copy size={12}/> Copy</>}
              </button>
            </div>
          </div>

          {/* email box */}
          <div className="rounded-2xl bg-[#fdf4f7] border border-[#eecdd4] p-4 mb-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-xl bg-rose-gradient flex items-center justify-center shrink-0"><Mail size={14} className="text-white"/></div>
              <p className="font-semibold text-[#3d1f6e] text-sm">Check your inbox</p>
            </div>
            <p className="text-xs text-[#7a5460] leading-relaxed pl-11">You will receive an email about your booking submission within a few seconds.</p>
          </div>

          {/* what next */}
          <p className="label-text mb-3">What next?</p>
          <ul className="space-y-2.5 mb-6">
            {[
              'Use "Track Booking" below to follow your booking status as our team reviews your submission.',
              'You will receive a confirmation email once your booking has been verified.',
              'The confirmation email will contain a link to download your booking ticket using your Booking ID.',
            ].map((item, i) => (
              <li key={i} className="flex gap-2.5 text-xs text-[#6a4852]">
                <CheckCircle2 size={14} className="text-[#c8788a] shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>

          <Link to={`/track-booking?id=${booking.bookingId}`} onClick={onClose} className="btn-rose w-full justify-center">
            Track my booking <ArrowRight size={13}/>
          </Link>
        </div>
      </div>
    </div>
  );
}
