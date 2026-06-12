import { useToast } from '../hooks/useToast';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

const icons = {
  success: <CheckCircle size={18} className="text-emerald-500" />,
  error: <XCircle size={18} className="text-rose-500" />,
  info: <AlertCircle size={18} className="text-[#b86b7d]" />,
};

export default function Toast() {
  const { toast } = useToast();
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-[9999] flex items-center gap-3 bg-white border border-[#ead1d7] text-[#1b1718] px-5 py-4 shadow-[0_20px_60px_rgba(33,20,26,0.12)] animate-fade-up rounded-2xl"
      style={{ minWidth: 280 }}
    >
      {icons[toast.type] || icons.success}
      <span className="font-body text-sm">{toast.msg}</span>
    </div>
  );
}
