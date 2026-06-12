import { CheckCircle2, Copy, X } from 'lucide-react';
import { useToast } from '../hooks/useToast';

export default function BridalSuccessModal({ bookingId, type = 'bridal', onClose }) {
  const { showToast } = useToast();
  function copy() { navigator.clipboard.writeText(bookingId); showToast('Copied!', 'success'); }

  const isSpecial = type === 'special';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-[28px] p-7 shadow-[0_24px_80px_rgba(180,80,110,0.2)] animate-fade-up">
        <button type="button" onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#fdf0f2] flex items-center justify-center text-[#9a6070]">
          <X size={14}/>
        </button>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[linear-gradient(135deg,#f0faf3,#d8f0e0)] border border-[#b8e0c8] flex items-center justify-center mb-5">
            <CheckCircle2 size={32} className="text-[#3d7a53]"/>
          </div>
          <h2 className="font-display text-2xl text-[#1c1214] mb-2">
            {isSpecial ? "We've got your request!" : "Bridal request received!"}
          </h2>
          <p className="text-[#7a5460] text-sm leading-relaxed mb-4">
            {isSpecial
              ? "Our team will review your request and reach out soon to discuss everything."
              : "Our team will review your details and reach out to discuss pricing, availability, and everything you need for your big day."}
          </p>
          {bookingId && (
            <div className="w-full rounded-2xl bg-[#fdf2f5] border border-[#eecdd4] p-4 mb-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#9a7080] mb-1">Your reference ID</p>
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono font-bold text-[#1c1214] text-lg">{bookingId}</p>
                <button type="button" onClick={copy} className="shrink-0 w-7 h-7 rounded-full bg-white border border-[#eecdd4] flex items-center justify-center text-[#9a7080]">
                  <Copy size={12}/>
                </button>
              </div>
              <p className="text-[10px] text-[#b08090] mt-1">Keep this — you'll use it to upload payment proof after your discussion with us.</p>
            </div>
          )}
          <div className="w-full rounded-2xl bg-[#fffbf0] border border-[#f0e4b8] p-4 text-left mb-5">
            <p className="text-xs text-[#8a7030] leading-relaxed">
              <strong>What happens next:</strong> After our team contacts you and you agree on details, return here and use your Booking ID to upload your payment receipt and complete the booking.
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-full btn-rose justify-center">Got it, thanks!</button>
        </div>
      </div>
    </div>
  );
}
