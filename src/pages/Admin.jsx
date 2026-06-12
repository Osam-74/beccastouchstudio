import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';
import {
  RefreshCw, Search, X, Archive, ArchiveRestore,
  LayoutDashboard, Ticket, CalendarDays, Users,
  Lock, Banknote, Clock3, BadgeCheck, Settings2,
  ChevronRight, ChevronLeft, CheckCircle2,
  ShoppingBag, Tag, Trash2, Mail, CheckCircle, AlertCircle, PackageSearch,
} from 'lucide-react';
import { bookingApi } from '../utils/bookingApi';
import AdminShopTab from '../components/AdminShopTab';
import AdminOrdersTab from '../components/AdminOrdersTab';
import AdminPricingTab from '../components/AdminPricingTab';
import { useToast } from '../hooks/useToast';
import { SITE } from '../utils/siteConfig';

/* ─── tabs ─── */
const TABS = [
  { key:'home',     label:'Home',    icon:LayoutDashboard },
  { key:'tickets',  label:'Tickets', icon:Ticket },
  { key:'calendar', label:'Calendar',icon:CalendarDays },
  { key:'users',    label:'Users',   icon:Users },
  { key:'shop',     label:'Shop',    icon:ShoppingBag },
  { key:'orders',   label:'Orders',  icon:PackageSearch },
  { key:'pricing',  label:'Pricing', icon:Tag },
];

/* ─── helpers ─── */
const S_STYLE = {
  draft:     'bg-[#f4f1ef] text-[#7b736e] border-[#ddd6d1]',
  pending:   'bg-[#fff4e0] text-[#a07428] border-[#f0d898]',
  confirmed: 'bg-[#f0faf3] text-[#3d7a53] border-[#b8e0c8]',
  rejected:  'bg-[#fff0f0] text-[#a84040] border-[#f0c8c8]',
};
function Badge({ status }) {
  return <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-[0.18em] font-semibold border ${S_STYLE[status]||S_STYLE.pending}`}>{status}</span>;
}
function fmtDate(v) {
  if (!v) return '—';
  try { return format(parseISO(v), 'dd MMM yyyy'); } catch { return v; }
}
function groupByDate(list) {
  const m = new Map();
  list.forEach(b => { const k=b.preferredDate||'No date'; if(!m.has(k))m.set(k,[]); m.get(k).push(b); });
  return [...m.entries()].sort(([a],[b])=>a.localeCompare(b));
}

/* ─── pin screen ─── */
function PinScreen({ onUnlock }) {
  const [digits, setDigits] = useState('');
  const [shake, setShake]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [cachedName, setCachedName] = useState(() => localStorage.getItem('beccastouch_admin_name') || '');
  const { showToast } = useToast();

  useEffect(() => {
    // Pre-fetch admin name from backend so it shows on the lock screen
    bookingApi.getAdminProfile().then(d => {
      const n = d?.adminProfile?.name || '';
      if (n && n !== 'Admin') { setCachedName(n); localStorage.setItem('beccastouch_admin_name', n); }
    }).catch(() => {});
  }, []);

  // Immediately add digit — no glow delay
  function press(d) {
    if (digits.length >= 8 || loading) return;
    const next = digits + d;
    setDigits(next);
    if (next.length === 8) verify(next);
  }
  function del() { if (!loading) setDigits(p => p.slice(0,-1)); }

  async function verify(pin) {
    try {
      setLoading(true);
      await bookingApi.adminOverview(pin);
      sessionStorage.setItem('beccastouch_admin_pin', pin);
      onUnlock(pin);
    } catch {
      setShake(true);
      setDigits('');
      showToast('Wrong PIN','error');
      setTimeout(() => setShake(false), 500);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 overflow-hidden"
      style={{ background:'linear-gradient(135deg,#fdf2f5 0%,#f8e0e8 40%,#fdf0ec 100%)' }}>

      <div className="relative w-full max-w-[320px] rounded-[32px] p-6"
        style={{
          background:'rgba(255,255,255,0.72)',
          backdropFilter:'blur(24px)',
          WebkitBackdropFilter:'blur(24px)',
          border:'1.5px solid rgba(220,160,175,0.45)',
          boxShadow:'0 8px 60px rgba(180,80,110,0.14)',
        }}>

        <div className="text-center mb-6">
          <h1 className="font-display text-2xl text-[#3d1f6e] mb-1">Welcome{cachedName ? `, ${cachedName}` : ''} 👋</h1>
          <p className="text-sm text-[#9a6070]">Enter your PIN to continue</p>
        </div>

        {/* Asterisk display — shows only entered chars, no hint of total length */}
        <div className={`flex items-center justify-center gap-1.5 mb-7 min-h-[28px] ${shake ? 'animate-[pinShake_0.4s_ease]' : ''}`}>
          {digits.length === 0 ? (
            <span className="text-[#e0c4cc] text-xs tracking-widest select-none">● ● ●</span>
          ) : (
            Array.from({ length: digits.length }, (_, i) => (
              <span key={i} className="text-[#c8788a] text-2xl leading-none font-black select-none" style={{lineHeight:1}}>✱</span>
            ))
          )}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[1,2,3,4,5,6,7,8,9].map(d => (
            <button key={d} type="button"
              onPointerDown={e => { e.preventDefault(); press(String(d)); }}
              disabled={loading}
              className="h-14 rounded-full bg-white/70 border border-[#eecdd4] shadow-sm text-[#3d1f6e] text-lg font-bold active:scale-90 active:bg-[linear-gradient(135deg,#c8788a,#e4a0b0)] active:text-white active:border-transparent transition-transform disabled:opacity-50">
              {d}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <button type="button" onPointerDown={e => { e.preventDefault(); del(); }} disabled={loading}
            className="h-14 rounded-full bg-white/70 border border-[#eecdd4] shadow-sm text-[#9a6070] text-sm font-semibold active:scale-90 transition-transform disabled:opacity-50">
            ⌫
          </button>
          <button type="button" onPointerDown={e => { e.preventDefault(); press('0'); }} disabled={loading}
            className="h-14 rounded-full bg-white/70 border border-[#eecdd4] shadow-sm text-[#3d1f6e] text-lg font-bold active:scale-90 active:bg-[linear-gradient(135deg,#c8788a,#e4a0b0)] active:text-white active:border-transparent transition-transform disabled:opacity-50">
            0
          </button>
          <div/>
        </div>

        {loading && <p className="text-center text-xs text-[#9a6070] mt-4 animate-pulse">Verifying…</p>}
      </div>
      <style>{`@keyframes pinShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>
    </div>
  );
}

/* ─── admin FAB ─── */
function AdminFab({ activeTab, setActiveTab }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ side: 'right', y: null }); // side: 'left'|'right', y: px from bottom
  const dragging = useRef(false);
  const startY = useRef(0);
  const startClientY = useRef(0);
  const fabRef = useRef(null);

  const ActiveIcon = TABS.find(t => t.key === activeTab)?.icon || LayoutDashboard;
  const activeLabel = TABS.find(t => t.key === activeTab)?.label || '';

  function choose(key) { setActiveTab(key); setOpen(false); }

  // Drag to reposition vertically + snap to left/right
  function onPointerDown(e) {
    if (open) return;
    dragging.current = false;
    startY.current = pos.y ?? 80;
    startClientY.current = e.clientY;
    const onMove = (me) => {
      const dy = startClientY.current - me.clientY;
      const newY = Math.max(16, Math.min(window.innerHeight - 120, startY.current + dy));
      setPos(p => ({ ...p, y: newY }));
      if (Math.abs(me.clientX - startClientY.current) > 10 || Math.abs(dy) > 4) dragging.current = true;
      // Snap side based on cursor X
      const side = me.clientX < window.innerWidth / 2 ? 'left' : 'right';
      setPos(p => ({ ...p, side }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function onFabClick() {
    if (dragging.current) { dragging.current = false; return; }
    setOpen(v => !v);
  }

  const bottomVal = pos.y ?? 80;
  const sideStyle = pos.side === 'right' ? { right: 12, left: 'auto' } : { left: 12, right: 'auto' };

  return (
    <>
      {/* ── CLOSED: draggable pill on side ── */}
      {!open && (
        <button
          ref={fabRef}
          type="button"
          onPointerDown={onPointerDown}
          onClick={onFabClick}
          className="lg:hidden fixed z-50 touch-none select-none"
          style={{ bottom: bottomVal, ...sideStyle }}
        >
          <div className="rounded-[30px] border border-[#eecdd4] bg-[#fdf8f5]/95 backdrop-blur-2xl shadow-[0_8px_40px_rgba(28,18,20,0.14)] px-3 py-2">
            <div className="flex flex-col items-center justify-center w-14 min-h-[54px] rounded-[22px] bg-[linear-gradient(135deg,#c8788a,#e4a0b0)] text-white shadow-[0_4px_14px_rgba(200,120,138,0.35)]">
              <ActiveIcon size={17} strokeWidth={2.2} />
              <span className="text-[9px] uppercase tracking-[0.14em] mt-0.5 font-semibold leading-none">{activeLabel}</span>
            </div>
            <div className="w-6 h-1 rounded-full bg-[#e2c0c8]/60 mx-auto mt-1.5" />
          </div>
        </button>
      )}

      {/* ── OPEN: overlay + expanded dock at bottom ── */}
      {open && (
        <>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)}
            className="lg:hidden fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px]" />
          <div className="lg:hidden fixed z-50 left-1/2 -translate-x-1/2" style={{ bottom: 16 }}>
            <div className="rounded-[30px] border border-[#eecdd4] bg-[#fdf8f5]/95 backdrop-blur-2xl shadow-[0_8px_40px_rgba(28,18,20,0.14)] px-2 py-2">
              <div className="flex items-center gap-0.5">
                {TABS.map(({ key, label, icon: Icon }) => {
                  const active = activeTab === key;
                  return (
                    <button key={key} type="button" onClick={() => choose(key)}
                      className={`flex flex-col items-center justify-center w-12 min-h-[50px] rounded-[20px] transition-all duration-200 active:scale-90 ${active ? 'bg-[linear-gradient(135deg,#c8788a,#e4a0b0)] text-white shadow-[0_4px_14px_rgba(200,120,138,0.35)]' : 'text-[#6b4a52] hover:bg-[#faeef0]'}`}>
                      <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                      <span className="text-[8px] uppercase tracking-[0.1em] mt-0.5 font-semibold leading-none">{label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="w-6 h-1 rounded-full bg-[#e2c0c8]/60 mx-auto mt-1.5" />
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ─── detail panel ─── */
function DetailPanel({ booking, note, setNote, onClose, onUpdate, onArchive, onRestore, onMarkAttended, onDelete, busy }) {
  if (!booking) return (
    <div className="rose-card p-8 flex flex-col items-center justify-center min-h-[200px] text-sm text-[#9a7080]">
      <Ticket size={28} className="mb-3 text-[#eecdd4]"/>
      Select a booking to view details.
    </div>
  );
  return (
    <div className="rose-card overflow-y-auto max-h-[90vh] lg:max-h-none">
      <div className="w-10 h-1.5 rounded-full bg-[#e8c4cc] mx-auto mt-3 mb-1 lg:hidden"/>
      <div className="p-5 lg:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="font-semibold text-[#3d1f6e] text-lg">{booking.clientName}</p>
            <p className="font-mono text-xs text-[#9a7080] mt-0.5">{booking.bookingId}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge status={booking.bookingStatus}/>
            {onClose && <button type="button" onClick={onClose} className="lg:hidden text-[#9a7080]"><X size={15}/></button>}
          </div>
        </div>

        <p className="text-3xl font-bold text-[#3d1f6e] mb-4">{booking.currency} {Number(booking.totalAmount||0).toLocaleString()}</p>

        <div className="grid grid-cols-2 gap-2.5 text-xs mb-4">
          {[['Summary',booking.summary||'—'],['Payment ref',booking.paymentReference||'—'],['Date',booking.preferredDate||'—'],['Time',booking.startTime||'—'],['Type',booking.bookingType],['Phone',booking.phone||'—'],['Email',booking.email||'—']].map(([k,v])=>(
            <div key={k} className="rounded-2xl bg-white/70 border border-[#eed4da] px-3 py-2.5">
              <p className="text-[8px] uppercase tracking-[0.22em] text-[#9a7080] mb-0.5">{k}</p>
              <p className="text-[#3d1f6e] text-xs">{v}</p>
            </div>
          ))}
          {booking.notes && (
            <div className="col-span-2 rounded-2xl bg-white/70 border border-[#eed4da] px-3 py-2.5">
              <p className="text-[8px] uppercase tracking-[0.22em] text-[#9a7080] mb-0.5">Client notes</p>
              <p className="text-[#3d1f6e] text-xs">{booking.notes}</p>
            </div>
          )}
          {/* service attended indicator */}
          <div className="col-span-2 rounded-2xl border px-3 py-2.5 flex items-center gap-2"
            style={{ background: booking.serviceAttended ? '#f0faf3' : '#fff4f6', borderColor: booking.serviceAttended ? '#b8e0c8' : '#eecdd4' }}>
            <CheckCircle2 size={14} className={booking.serviceAttended ? 'text-[#3d7a53]' : 'text-[#d4a0b0]'} />
            <div className="flex-1">
              <p className="text-[8px] uppercase tracking-[0.22em] text-[#9a7080] mb-0.5">Service attended</p>
              <p className="text-xs font-semibold" style={{ color: booking.serviceAttended ? '#3d7a53' : '#9a7080' }}>
                {booking.serviceAttended ? `Attended · ${booking.attendedAt ? fmtDate(booking.attendedAt) : ''}` : 'Not yet attended'}
              </p>
            </div>
            {!booking.serviceAttended && (
              <button type="button" onClick={() => onMarkAttended(booking.bookingId)} disabled={busy}
                className="text-[9px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full bg-[linear-gradient(120deg,#c8788a,#e4a0b0)] text-white disabled:opacity-50 whitespace-nowrap">
                Mark Attended ✓
              </button>
            )}
          </div>
        </div>

        {booking.paymentReceiptUrl ? (
          <div className="flex gap-2 mb-4">
            <a href={booking.paymentReceiptUrl} target="_blank" rel="noreferrer" className="btn-outline-dark flex-1 text-center text-xs">View Receipt</a>
            <a href={booking.paymentReceiptUrl} download className="btn-outline-dark flex-1 text-center text-xs">Download</a>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#e8c4cc] p-3 mb-4 text-xs text-[#9a7080] text-center">No receipt uploaded yet.</div>
        )}

        {/* Voice note — special/glam requests */}
        {booking.specialRequestAudioUrl && (
          <div className="rounded-2xl border border-[#d4c8f0] bg-[#f8f4ff] p-4 mb-4">
            <p className="text-[8px] uppercase tracking-[0.22em] text-[#6b3fa0] font-semibold mb-2">🎙️ Voice Note from Client</p>
            <audio src={booking.specialRequestAudioUrl} controls className="w-full h-10 rounded-xl mb-2"/>
            <a href={booking.specialRequestAudioUrl} download={`voice-${booking.bookingId}.webm`}
              className="text-xs text-[#6b3fa0] font-semibold flex items-center gap-1 hover:underline">
              ⬇ Download voice note
            </a>
          </div>
        )}

        <textarea value={note} onChange={e=>setNote(e.target.value)} className="input-field min-h-[80px] mb-4 text-sm" placeholder="Admin note (sent to client on confirm/reject)"/>

        <div className="grid gap-2.5">
          {/* Confirm — hide if already confirmed */}
          {booking.bookingStatus !== 'confirmed' && (
            <button type="button" onClick={()=>onUpdate(booking.bookingId,'confirmed',note)} disabled={busy}
              className="w-full py-3 rounded-[14px] bg-[#5a9e70] text-white font-semibold text-sm disabled:opacity-50">
              {busy?'Saving…':'✓ Confirm'}
            </button>
          )}
          {/* Reject — hide if already rejected */}
          {booking.bookingStatus !== 'rejected' && (
            <button type="button" onClick={()=>onUpdate(booking.bookingId,'rejected',note)} disabled={busy}
              className="w-full py-3 rounded-[14px] border border-[#e8b0b0] text-[#b05860] font-semibold text-sm disabled:opacity-50">
              ✕ Reject
            </button>
          )}
          {/* Back to pending — hide if already pending or draft */}
          {booking.bookingStatus !== 'pending' && booking.bookingStatus !== 'draft' && (
            <button type="button" onClick={()=>onUpdate(booking.bookingId,'pending',note)} disabled={busy}
              className="w-full py-3 rounded-[14px] border border-[#e8cad0] text-[#7a5460] font-semibold text-sm disabled:opacity-50">
              ↩ Back to pending
            </button>
          )}
          {/* Archive/Restore/Delete */}
          {!booking.isArchived
            ? <button type="button" onClick={()=>onArchive(booking.bookingId)} disabled={busy}
                className="w-full py-3 rounded-[14px] border border-[#e8cad0] text-[#7a5460] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                <Archive size={13}/> Archive
              </button>
            : <div className="space-y-2">
                <button type="button" onClick={()=>onRestore(booking.bookingId)} disabled={busy}
                  className="w-full py-3 rounded-[14px] border border-[#e8cad0] text-[#7a5460] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  <ArchiveRestore size={13}/> Restore
                </button>
                <button type="button" onClick={()=>onDelete(booking.bookingId, booking.clientName)} disabled={busy}
                  className="w-full py-3 rounded-[14px] bg-[#fff0f0] border border-[#f0c8c8] text-[#b05860] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  <Trash2 size={13}/> Delete forever
                </button>
              </div>
          }
        </div>
      </div>
    </div>
  );
}

/* ─── calendar booking detail modal ─── */
function CalendarModal({ booking, onClose }) {
  if (!booking) return null;
  const fields = [
    ['Client name', booking.clientName],
    ['Booking ID', booking.bookingId],
    ['Status', booking.bookingStatus],
    ['Type', booking.bookingType],
    ['Date', booking.preferredDate || '—'],
    ['Time', booking.startTime || '—'],
    ['Duration', booking.durationHours ? `${booking.durationHours}h` : '—'],
    ['Service', booking.summary || '—'],
    ['Phone', booking.phone || '—'],
    ['Email', booking.email || '—'],
    ['Location', booking.locationType || '—'],
    ['Session type', booking.sessionType || '—'],
    ['Amount', booking.totalAmount ? `${booking.currency} ${Number(booking.totalAmount).toLocaleString()}` : '—'],
    ['Payment ref', booking.paymentReference || '—'],
    ['Admin note', booking.adminNote || '—'],
    ['Notes', booking.notes || '—'],
    ['Attended', booking.serviceAttended ? `Yes · ${booking.attendedAt ? fmtDate(booking.attendedAt) : ''}` : 'Not yet'],
  ].filter(([,v]) => v && v !== '—' && v !== 'Not yet' || true);

  return (
    <>
      <button type="button" onClick={onClose} className="fixed inset-0 bg-black/30 backdrop-blur-[3px] z-50"/>
      <div className="fixed inset-x-3 top-1/2 -translate-y-1/2 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[560px] z-50 max-h-[90vh] overflow-y-auto rounded-[28px]">
        <div className="rose-card p-6">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <p className="font-display text-xl text-[#3d1f6e]">{booking.clientName}</p>
              <p className="font-mono text-xs text-[#9a7080] mt-0.5">{booking.bookingId}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge status={booking.bookingStatus}/>
              <button type="button" onClick={onClose} className="w-8 h-8 rounded-full border border-[#eecdd4] bg-white flex items-center justify-center text-[#9a7080]"><X size={14}/></button>
            </div>
          </div>
          {/* 2-column grid of fields */}
          <div className="grid grid-cols-2 gap-2.5">
            {fields.map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white/70 border border-[#eed4da] px-3 py-2.5">
                <p className="text-[8px] uppercase tracking-[0.22em] text-[#9a7080] mb-0.5">{k}</p>
                <p className="text-xs text-[#3d1f6e] font-medium capitalize break-words">{v}</p>
              </div>
            ))}
          </div>
          {booking.serviceAttended && (
            <div className="mt-3 flex items-center gap-2 bg-[#f0faf3] border border-[#b8e0c8] rounded-2xl px-4 py-2.5">
              <CheckCircle2 size={15} className="text-[#3d7a53]"/>
              <p className="text-sm font-semibold text-[#3d7a53]">Service attended · {booking.attendedAt ? fmtDate(booking.attendedAt) : ''}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── calendar tab ─── */
function CalendarTab({ bookings }) {
  const today = new Date();
  const [weekStart, setWeekStart] = useState(startOfWeek(today, { weekStartsOn: 1 }));
  const [activeDay, setActiveDay] = useState(today);
  const [modalBooking, setModalBooking] = useState(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dayBookings = useMemo(() =>
    bookings.filter(b => b.preferredDate === format(activeDay, 'yyyy-MM-dd') && !b.isArchived),
    [bookings, activeDay]
  );

  return (
    <div>
      {modalBooking && <CalendarModal booking={modalBooking} onClose={() => setModalBooking(null)}/>}
      {/* week strip */}
      <div className="flex items-center gap-2 mb-4">
        <button type="button" onClick={() => setWeekStart(d => addDays(d,-7))} className="w-8 h-8 rounded-full border border-[#eecdd4] bg-white flex items-center justify-center"><ChevronLeft size={14}/></button>
        <div className="flex-1 flex gap-1.5 overflow-x-auto">
          {days.map(day => {
            const iso = format(day,'yyyy-MM-dd');
            const hasBk = bookings.some(b=>b.preferredDate===iso&&!b.isArchived);
            const isActive = isSameDay(day, activeDay);
            return (
              <button key={iso} type="button" onClick={() => setActiveDay(day)}
                className={`flex flex-col items-center rounded-2xl px-3 py-2.5 min-w-[52px] transition-all ${isActive ? 'bg-[linear-gradient(135deg,#c8788a,#e4a0b0)] text-white shadow-md' : 'bg-white border border-[#eecdd4] text-[#7a5460]'}`}>
                <span className="text-[9px] uppercase tracking-[0.12em] font-semibold">{format(day,'EEE')}</span>
                <span className="text-base font-bold mt-0.5">{format(day,'d')}</span>
                {hasBk && <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isActive?'bg-white/70':'bg-[#c8788a]'}`}/>}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => setWeekStart(d => addDays(d,7))} className="w-8 h-8 rounded-full border border-[#eecdd4] bg-white flex items-center justify-center"><ChevronRight size={14}/></button>
      </div>

      <p className="label-text mb-3">{format(activeDay,'EEEE, dd MMMM yyyy')}</p>
      {dayBookings.length === 0 ? (
        <div className="rose-card p-8 text-center text-sm text-[#9a7080]">No bookings on this day.</div>
      ) : (
        <div className="space-y-3">
          {dayBookings.map(b => (
            <button key={b.bookingId} type="button" onClick={() => setModalBooking(b)}
              className="glass-card p-4 flex gap-4 items-start w-full text-left hover:shadow-md transition-all">
              {/* LEFT — date + time column */}
              <div className="flex flex-col items-center justify-start shrink-0 w-12 pt-0.5">
                <div className="w-10 h-10 rounded-xl bg-[linear-gradient(135deg,#fce4ea,#f8d0dc)] border border-[#eecdd4] flex items-center justify-center mb-1">
                  <CalendarDays size={15} className="text-[#c8788a]" />
                </div>
                <span className="text-[11px] font-bold text-[#3d1f6e] leading-tight">{format(parseISO(b.preferredDate),'d')}</span>
                <span className="text-[8px] uppercase tracking-[0.1em] text-[#9a7080]">{format(parseISO(b.preferredDate),'MMM')}</span>
                {b.startTime && (
                  <span className="text-[8px] text-[#c8788a] font-semibold mt-1 leading-tight">{b.startTime}</span>
                )}
              </div>

              {/* RIGHT — booking info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-[#3d1f6e] text-sm truncate">{b.clientName}</p>
                  <Badge status={b.bookingStatus}/>
                </div>
                <p className="font-mono text-xs text-[#9a7080]">{b.bookingId}</p>
                <p className="text-xs text-[#7a5460] mt-1">{b.summary}</p>
                {b.durationHours && <p className="text-xs text-[#9a7080] mt-0.5">Duration: {b.durationHours}h</p>}
                {b.serviceAttended && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-semibold text-[#3d7a53] bg-[#f0faf3] border border-[#b8e0c8] rounded-full px-2 py-0.5">
                    <CheckCircle2 size={9}/> Attended
                  </span>
                )}
                <p className="text-[9px] text-[#b8a0b0] mt-1.5">Tap to view full details →</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── users tab ─── */
function UsersTab({ bookings, onDeleteUser }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const users = useMemo(() => {
    const m = new Map();
    bookings.forEach(b => {
      if (!b.email && !b.phone) return;
      const key = b.email || b.phone;
      if (!m.has(key)) m.set(key, { name:b.clientName, email:b.email, phone:b.phone, bookings:[] });
      m.get(key).bookings.push(b);
    });
    return [...m.values()].sort((a,b)=>b.bookings.length-a.bookings.length);
  }, [bookings]);

  const filtered = search ? users.filter(u => [u.name,u.email,u.phone].some(v=>String(v||'').toLowerCase().includes(search.toLowerCase()))) : users;

  function pick(u) { setSelected(u); setSheetOpen(true); }

  return (
    <div className="lg:grid lg:grid-cols-[45%_55%] gap-5">
      <div>
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b08a90]"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} className="input-field pl-9" placeholder="Search clients…"/>
        </div>
        <div className="space-y-2.5">
          {filtered.map(u => (
            <button key={u.email||u.phone} type="button" onClick={()=>pick(u)}
              className={`w-full text-left glass-card p-4 transition-all hover:shadow-md ${selected?.email===u.email?'ring-2 ring-[#d9a0b0]/50':''}`}>
              <p className="font-semibold text-sm text-[#3d1f6e]">{u.name}</p>
              <p className="text-xs text-[#9a7080] mt-0.5">{u.email || u.phone}</p>
              <p className="text-xs text-[#c8788a] mt-1 font-medium">{u.bookings.length} booking{u.bookings.length!==1?'s':''}</p>
            </button>
          ))}
          {filtered.length === 0 && <div className="rose-card p-5 text-sm text-[#9a7080]">No clients found.</div>}
        </div>
      </div>

      {/* desktop detail panel — always visible on lg */}
      <div className="hidden lg:block">
        {selected ? (
          <div className="rose-card p-5">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <p className="font-semibold text-[#3d1f6e] mb-0.5">{selected.name}</p>
                <p className="text-xs text-[#9a7080]">{selected.email}</p>
                <p className="text-xs text-[#9a7080]">{selected.phone}</p>
              </div>
              <button type="button" onClick={()=>onDeleteUser(selected)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#fff0f0] border border-[#f0c8c8] text-[#b05860] text-xs font-semibold hover:bg-[#ffe0e0] transition-all">
                <Trash2 size={12}/> Delete client
              </button>
            </div>
            <p className="label-text mb-3">Booking history</p>
            <div className="space-y-2.5">
              {selected.bookings.map(b=>(
                <div key={b.bookingId} className="rounded-2xl bg-white/70 border border-[#eed4da] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-mono text-xs text-[#9a7080]">{b.bookingId}</p>
                    <Badge status={b.bookingStatus}/>
                  </div>
                  <p className="text-xs text-[#3d1f6e]">{b.summary}</p>
                  <p className="text-xs text-[#9a7080] mt-0.5">{b.preferredDate||'No date'} · {b.currency} {Number(b.totalAmount||0).toLocaleString()}</p>
                  {b.serviceAttended && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-semibold text-[#3d7a53] bg-[#f0faf3] border border-[#b8e0c8] rounded-full px-2 py-0.5">
                      <CheckCircle2 size={9}/> Attended
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rose-card p-8 flex flex-col items-center justify-center min-h-[200px] text-sm text-[#9a7080]">
            <Users size={28} className="mb-3 text-[#eecdd4]"/>
            Select a client to view their history.
          </div>
        )}
      </div>

      {/* mobile bottom sheet — slides up like the ticket sheet */}
      {sheetOpen && selected && (
        <>
          <button type="button" onClick={() => setSheetOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40"/>
          <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-[28px]">
            <div className="rose-card rounded-t-[28px]">
              <div className="w-10 h-1.5 rounded-full bg-[#e8c4cc] mx-auto mt-3 mb-1"/>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-[#3d1f6e] text-lg">{selected.name}</p>
                    <p className="text-xs text-[#9a7080] mt-0.5">{selected.email}</p>
                    <p className="text-xs text-[#9a7080]">{selected.phone}</p>
                  </div>
                  <button type="button" onClick={() => setSheetOpen(false)} className="text-[#9a7080]"><X size={15}/></button>
                </div>
                <p className="text-xs font-semibold text-[#c8788a] mb-3">{selected.bookings.length} booking{selected.bookings.length!==1?'s':''}</p>
                <button type="button" onClick={()=>{ setSheetOpen(false); onDeleteUser(selected); }}
                  className="w-full mb-4 flex items-center justify-center gap-2 py-2.5 rounded-[12px] bg-[#fff0f0] border border-[#f0c8c8] text-[#b05860] text-sm font-semibold">
                  <Trash2 size={13}/> Delete this client & all their bookings
                </button>
                <p className="label-text mb-3">Booking history</p>
                <div className="space-y-2.5">
                  {selected.bookings.map(b=>(
                    <div key={b.bookingId} className="rounded-2xl bg-white/70 border border-[#eed4da] p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-mono text-xs text-[#9a7080]">{b.bookingId}</p>
                        <Badge status={b.bookingStatus}/>
                      </div>
                      <p className="text-xs text-[#3d1f6e]">{b.summary}</p>
                      <p className="text-xs text-[#9a7080] mt-0.5">{b.preferredDate||'No date'} · {b.currency} {Number(b.totalAmount||0).toLocaleString()}</p>
                      {b.serviceAttended && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-semibold text-[#3d7a53] bg-[#f0faf3] border border-[#b8e0c8] rounded-full px-2 py-0.5">
                          <CheckCircle2 size={9}/> Attended
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Email setup panel ─── */
function EmailSetupPanel({ pin }) {
  const [testing, setTesting] = useState(false);
  const { showToast } = useToast();

  async function testEmail() {
    try {
      setTesting(true);
      await bookingApi.testEmail(pin);
      showToast('Test email sent to beccastouchstudio@gmail.com ✓', 'success');
    } catch(e) { showToast(e.message, 'error'); }
    finally { setTesting(false); }
  }

  return (
    <div className="rose-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Mail size={16} className="text-[#c8788a]"/>
        <p className="font-semibold text-[#3d1f6e] text-sm">Email notifications</p>
      </div>
      <div className="flex items-center gap-2 text-sm text-[#3d7a53] bg-[#f0faf3] rounded-[12px] px-4 py-3 border border-[#b8e0c8]">
        <CheckCircle size={14}/> <span>Active via <b>Gmail OAuth</b> — sending as <b>beccastouchstudio@gmail.com</b></span>
      </div>
      <button type="button" onClick={testEmail} disabled={testing} className="btn-rose text-xs">
        {testing ? 'Sending…' : '✉ Send test email'}
      </button>
    </div>
  );
}

/* ─── settings tab ─── */
function SettingsTab({ pin, adminProfile, onProfileSaved }) {
  const [curPin, setCurPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [adminName, setAdminName] = useState(adminProfile?.name || 'Admin');
  const [savingProfile, setSavingProfile] = useState(false);
  const { showToast } = useToast();

  async function changePin() {
    if (!curPin.trim()) return showToast('Enter your current PIN.', 'error');
    if (newPin.length < 4) return showToast('New PIN must be at least 4 digits.', 'error');
    if (!/^\d+$/.test(newPin)) return showToast('PIN must contain numbers only.', 'error');
    if (newPin === curPin) return showToast('New PIN must be different from current PIN.', 'error');
    try {
      setSavingPin(true);
      await bookingApi.resetPin(curPin, newPin);
      sessionStorage.setItem('beccastouch_admin_pin', newPin);
      showToast('PIN updated successfully! Use your new PIN next time.', 'success');
      setCurPin(''); setNewPin('');
    } catch(e) { showToast(e.message || 'Failed to update PIN. Check your current PIN is correct.', 'error'); } finally { setSavingPin(false); }
  }

  async function saveProfile() {
    if (!adminName.trim()) return showToast('Name cannot be empty.', 'error');
    try {
      setSavingProfile(true);
      await bookingApi.saveAdminProfile(pin, adminName.trim());
      onProfileSaved(adminName.trim());
      showToast('Profile saved.', 'success');
    } catch(e) { showToast(e.message, 'error'); } finally { setSavingProfile(false); }
  }

  return (
    <div className="space-y-5 max-w-lg">
      {/* Admin profile */}
      <div className="rose-card p-6">
        <p className="font-semibold text-[#3d1f6e] mb-4">Admin profile</p>
        <div className="space-y-3">
          <div>
            <label className="label-text">Your name</label>
            <input value={adminName} onChange={e=>setAdminName(e.target.value)} maxLength={40} className="input-field" placeholder="e.g. Becca"/>
            <p className="text-[10px] text-[#9a7080] mt-1">Shown on the PIN screen and your dashboard greeting.</p>
          </div>
          <button type="button" onClick={saveProfile} disabled={savingProfile||!adminName.trim()} className="btn-rose">
            {savingProfile?'Saving…':'Save profile'}
          </button>
        </div>
      </div>
      {/* Gmail email setup */}
      <EmailSetupPanel pin={pin}/>
      {/* Change PIN */}
      <div className="rose-card p-6">
        <p className="font-semibold text-[#3d1f6e] mb-4">Change admin PIN</p>
        <div className="space-y-3">
          <div><label className="label-text">Current PIN</label><input type="password" inputMode="numeric" pattern="[0-9]*" value={curPin} onChange={e=>setCurPin(e.target.value.replace(/\D/g,''))} maxLength={8} className="input-field" placeholder="Current PIN"/></div>
          <div><label className="label-text">New PIN (numbers only)</label><input type="password" inputMode="numeric" pattern="[0-9]*" value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\D/g,''))} maxLength={8} className="input-field" placeholder="New PIN (min 4 digits)"/></div>
          <button type="button" onClick={changePin} disabled={savingPin||!curPin||!newPin} className="btn-rose">{savingPin?'Saving…':'Update PIN'}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── main admin ─── */
export default function Admin() {
  const [pin, setPin]     = useState(() => sessionStorage.getItem('beccastouch_admin_pin') || '');
  const [adminProfile, setAdminProfile] = useState({ name: 'Admin' });
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState({ today:0, thisWeek:0, pending:0 });
  const [shopOrderCount, setShopOrderCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingId, setLoadingId]   = useState('');
  const [activeTab, setActiveTab]   = useState('home');
  const [ticketFilter, setTicketFilter] = useState('all');
  const [query, setQuery]   = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [sheetOpen, setSheetOpen]   = useState(false);
  const [note, setNote]   = useState('');
  const { showToast } = useToast();
  const refreshTimer = useRef(null);

  const load = useCallback(async () => {
    if (!pin) return;
    try {
      setRefreshing(true);
      const data = await bookingApi.adminOverview(pin);
      setBookings(data.bookings || []); setStats(data.stats || {});
      if (data.adminProfile) setAdminProfile(data.adminProfile);
      sessionStorage.setItem('beccastouch_admin_pin', pin);
      // Load shop orders count for dashboard metric
      try {
        const { orders: shopOrds } = await bookingApi.adminGetShopOrders(pin);
        setShopOrderCount((shopOrds || []).filter(o => o.status === 'pending').length);
      } catch(_) {}
    } catch(e) { showToast(e.message,'error'); sessionStorage.removeItem('beccastouch_admin_pin'); setPin(''); }
    finally { setRefreshing(false); }
  }, [pin]);

  useEffect(() => { load(); }, [load]);
  // Store pin in a ref so the interval always uses the latest value without re-creating
  const pinRef = useRef(pin);
  useEffect(() => { pinRef.current = pin; }, [pin]);
  useEffect(() => {
    if (!pin) return;
    refreshTimer.current = setInterval(async () => {
      // Use pinRef.current so a PIN change doesn't trigger 401 logout
      if (!pinRef.current) return;
      try {
        const data = await bookingApi.adminOverview(pinRef.current);
        setBookings(data.bookings || []); setStats(data.stats || {});
        if (data.adminProfile) setAdminProfile(data.adminProfile);
        // Sync sessionStorage in case it drifted
        sessionStorage.setItem('beccastouch_admin_pin', pinRef.current);
      } catch(e) {
        // Only log out on explicit auth failure, not transient errors
        if (e.message === 'Invalid PIN') {
          sessionStorage.removeItem('beccastouch_admin_pin');
          setPin('');
        }
      }
    }, 60000); // 60s instead of 45s — less aggressive
    return () => clearInterval(refreshTimer.current);
  }, [pin]);

  function logout() { sessionStorage.removeItem('beccastouch_admin_pin'); setPin(''); }

  const counts = useMemo(() => ({
    total:     bookings.filter(b=>!b.isArchived).length,
    pending:   bookings.filter(b=>b.bookingStatus==='pending'&&!b.isArchived).length,
    confirmed: bookings.filter(b=>b.bookingStatus==='confirmed'&&!b.isArchived).length,
    drafts:    bookings.filter(b=>b.bookingStatus==='draft'&&!b.isArchived).length,
    archived:  bookings.filter(b=>b.isArchived).length,
    attended:  bookings.filter(b=>b.serviceAttended&&!b.isArchived).length,
  }), [bookings]);

  const TICKET_FILTERS = [
    { key:'all', label:'All' },
    { key:'pending', label:'Pending' },
    { key:'confirmed', label:'Confirmed' },
    { key:'archived', label:'Archived' },
    { key:'draft', label:'Draft' },
  ];

  const filteredTickets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter(b => {
      const tabMatch = ticketFilter==='all' ? !b.isArchived : ticketFilter==='archived' ? b.isArchived : b.bookingStatus===ticketFilter&&!b.isArchived;
      const qMatch = !q || [b.bookingId,b.clientName,b.email,b.phone].some(v=>String(v||'').toLowerCase().includes(q));
      return tabMatch && qMatch;
    });
  }, [bookings, ticketFilter, query]);

  const grouped = useMemo(() => groupByDate(filteredTickets), [filteredTickets]);
  const selectedBooking = useMemo(() => bookings.find(b=>b.bookingId===selectedId)||filteredTickets[0]||null, [bookings,filteredTickets,selectedId]);

  useEffect(() => { if (selectedBooking) { setNote(selectedBooking.adminNote||''); setSelectedId(selectedBooking.bookingId); } }, [selectedBooking?.bookingId]);

  function pick(b) { setSelectedId(b.bookingId); setNote(b.adminNote||''); setSheetOpen(true); }

  function syncLocal(u) { setBookings(prev=>prev.map(b=>b.bookingId===u.bookingId?u:b)); setSelectedId(u.bookingId); setNote(u.adminNote||''); setSheetOpen(false); }

  async function updateStatus(bookingId, status, adminNote='') {
    try { setLoadingId(bookingId); const {booking:u} = await bookingApi.adminUpdateStatus(pin,bookingId,status,adminNote); syncLocal(u); showToast(`Booking ${status}.`,'success'); }
    catch(e) { showToast(e.message,'error'); } finally { setLoadingId(''); }
  }
  async function archiveBooking(bookingId) {
    try { setLoadingId(bookingId); const {booking:u} = await bookingApi.archiveBooking(pin,bookingId); syncLocal(u); showToast('Archived.','success'); }
    catch(e) { showToast(e.message,'error'); } finally { setLoadingId(''); }
  }
  async function restoreBooking(bookingId) {
    try { setLoadingId(bookingId); const {booking:u} = await bookingApi.restoreBooking(pin,bookingId); syncLocal(u); showToast('Restored.','success'); }
    catch(e) { showToast(e.message,'error'); } finally { setLoadingId(''); }
  }
  async function deleteUser(user) {
    const count = user.bookings.length;
    if (!window.confirm(`Delete client "${user.name}" and all ${count} booking${count!==1?'s':''}?\n\nThis cannot be undone.`)) return;
    const uid = 'user_' + (user.email || user.phone || 'del');
    try {
      setLoadingId(uid);
      // Sequential deletes to avoid Firestore race conditions
      let deleted = 0;
      for (const b of user.bookings) {
        try { await bookingApi.deleteBooking(pin, b.bookingId); deleted++; }
        catch(e) { console.warn('Failed to delete booking', b.bookingId, e.message); }
      }
      setBookings(prev => prev.filter(b => b.email !== user.email || (!user.email && b.phone !== user.phone)));
      showToast(`Client deleted with ${deleted} booking${deleted!==1?'s':''}.`,'success');
    } catch(e) { showToast(e.message,'error'); } finally { setLoadingId(''); }
  }
  async function deleteBooking(bookingId, clientName) {
    if (!window.confirm(`Permanently delete booking for "${clientName}"?\n\nThis cannot be undone.`)) return;
    try {
      setLoadingId(bookingId);
      await bookingApi.deleteBooking(pin, bookingId);
      setBookings(prev => prev.filter(b => b.bookingId !== bookingId));
      setSheetOpen(false); setSelectedId('');
      showToast('Booking deleted permanently.','success');
    } catch(e) { showToast(e.message,'error'); } finally { setLoadingId(''); }
  }
  async function markAttended(bookingId) {
    try {
      setLoadingId(bookingId);
      const { booking: u } = await bookingApi.markAttended(pin, bookingId);
      setBookings(prev => prev.map(b => b.bookingId === u.bookingId ? u : b));
      showToast('Marked as attended ✓', 'success');
    } catch(e) { showToast(e.message,'error'); } finally { setLoadingId(''); }
  }

  if (!pin) return <PinScreen onUnlock={setPin}/>;

  /* stat gradient cards */
  const statCards = [
    ['Today',    stats.today,     'linear-gradient(135deg,#fce4ea,#f8d8e2)','#b8607a'],
    ['This week',stats.thisWeek,  'linear-gradient(135deg,#f8e0e8,#f4d4dc)','#a05070'],
    ['Pending',  counts.pending,  'linear-gradient(135deg,#fff4e0,#ffecc0)','#a07428'],
    ['Confirmed',counts.confirmed,'linear-gradient(135deg,#f0faf3,#d8f0e0)','#3d7a53'],
    ['Attended', counts.attended, 'linear-gradient(135deg,#e8f8ee,#d0f0dc)','#2d6a44'],
    ['Shop Orders', shopOrderCount, 'linear-gradient(135deg,#e8f0ff,#d8e4ff)','#3a5aaa'],
  ];

  return (
    <div className="min-h-screen bg-[#fdf8f5] text-[#3d1f6e]">

      {/* mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 bg-[#fdf8f5]/95 backdrop-blur border-b border-[#eecdd4]/60 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">Beccastouch Studio</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9a7080]">Admin</p>
        </div>
        <div className="flex items-center gap-2">
          {counts.pending > 0 && (
            <div className="w-9 h-9 rounded-full border border-[#f0d898] bg-[#fff4e0] flex items-center justify-center shadow-sm" title={`${counts.pending} pending`}>
              <span className="text-[11px] font-bold text-[#a07428]">{counts.pending}</span>
            </div>
          )}
          <button type="button" onClick={load} className="w-9 h-9 rounded-full border border-[#eecdd4] bg-white flex items-center justify-center shadow-sm">
            <RefreshCw size={13} className="animate-spin" style={{animationDuration:'3s'}}/>
          </button>
          <button type="button" onClick={() => setActiveTab('settings')} className="w-9 h-9 rounded-full border border-[#eecdd4] bg-white flex items-center justify-center shadow-sm">
            <Settings2 size={13} className="text-[#9a7080]"/>
          </button>
          <button type="button" onClick={logout} className="w-9 h-9 rounded-full border border-[#f0c8c8] bg-white flex items-center justify-center shadow-sm text-[#b05860]">
            <Lock size={13}/>
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto lg:grid lg:grid-cols-[220px_1fr] min-h-screen">

        {/* desktop sidebar */}
        <aside className="hidden lg:flex flex-col border-r border-[#eecdd4]/60 bg-white/50 px-4 py-6">
          <div className="mb-7">
            <p className="font-display text-lg text-[#3d1f6e]">Beccastouch <span className="text-gradient-rose italic">Studio</span></p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#9a7080] mt-1">Admin control room</p>
            {adminProfile?.name && adminProfile.name !== 'Admin' && (
              <p className="text-sm font-semibold text-[#c8788a] mt-1.5">{adminProfile.name}</p>
            )}
          </div>
          <nav className="space-y-1 flex-1">
            {TABS.map(({key,label,icon:Icon})=>(
              <button key={key} type="button" onClick={()=>setActiveTab(key)}
                className={`w-full flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-left text-sm font-medium transition-all ${activeTab===key?'bg-[linear-gradient(120deg,#fce4ea,#f8d8e2)] text-[#8c3a50] shadow-sm':'text-[#7a5460] hover:bg-white'}`}>
                <Icon size={16}/> {label}
              </button>
            ))}
          </nav>
          <div className="border-t border-[#eecdd4]/60 pt-4 mt-2 space-y-1">
            <button type="button" onClick={()=>setActiveTab('settings')}
              className={`w-full flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-sm text-[#7a5460] hover:bg-white transition-all ${activeTab==='settings'?'bg-[linear-gradient(120deg,#fce4ea,#f8d8e2)] text-[#8c3a50]':''}`}>
              <Settings2 size={16}/> Settings
            </button>
            <button type="button" onClick={logout}
              className="w-full flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-sm text-[#b05860] hover:bg-[#fff0f0] transition-all">
              <Lock size={16}/> Lock admin
            </button>
          </div>
        </aside>

        {/* main */}
        <div className="px-4 lg:px-7 py-5 pb-28 lg:pb-10">

          {/* desktop header */}
          <div className="hidden lg:flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display text-3xl text-[#3d1f6e]">{TABS.find(t=>t.key===activeTab)?.label||'Settings'}</h1>
              <p className="text-sm text-[#9a7080]">Calm, clean, and built for quick approvals.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={load} className="w-10 h-10 rounded-full border border-[#eecdd4] bg-white flex items-center justify-center shadow-sm hover:shadow-md transition-all">
                <RefreshCw size={14} className="animate-spin" style={{animationDuration:'3s'}}/>
              </button>
              <button type="button" onClick={logout} className="w-10 h-10 rounded-full border border-[#f0c8c8] bg-white flex items-center justify-center shadow-sm hover:shadow-md transition-all text-[#b05860]">
                <Lock size={14}/>
              </button>
            </div>
          </div>

          {/* ── HOME TAB ── */}
          {activeTab==='home' && (
            <div>
              {/* greeting */}
              <div className="rose-card p-5 mb-5">
                <p className="font-display text-xl text-[#3d1f6e] mb-1">Welcome back{adminProfile?.name && adminProfile.name !== 'Admin' ? `, ${adminProfile.name}` : ''} 👋</p>
                <p className="text-sm text-[#7a5460]">
                  You have <strong>{stats.today||0}</strong> booking{(stats.today||0)!==1?'s':''} today,
                  <strong> {stats.thisWeek||0}</strong> this week,
                  and <strong>{counts.pending||0}</strong> awaiting confirmation.
                </p>
              </div>

              {/* stat grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                {statCards.map(([label,value,bg,color])=>(
                  <div key={label} className="rounded-[18px] p-4 border border-[#eecdd4]" style={{background:bg}}>
                    <p className="text-3xl font-bold leading-none mb-1.5" style={{color}}>{value}</p>
                    <p className="text-xs font-semibold" style={{color}}>{label}</p>
                  </div>
                ))}
              </div>

              {/* recent pending */}
              <p className="label-text mb-3">Latest pending bookings</p>
              <div className="space-y-2.5">
                {bookings.filter(b=>b.bookingStatus==='pending'&&!b.isArchived).slice(0,5).map(b=>(
                  <div key={b.bookingId} className="glass-card p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-sm">{b.clientName}</p>
                      <Badge status={b.bookingStatus}/>
                    </div>
                    <p className="font-mono text-xs text-[#9a7080]">{b.bookingId} · {b.preferredDate||'No date'}</p>
                  </div>
                ))}
                {counts.pending === 0 && <div className="rose-card p-5 text-sm text-[#9a7080] text-center">No pending bookings. 🎉</div>}
              </div>
            </div>
          )}

          {/* ── TICKETS TAB ── */}
          {activeTab==='tickets' && (
            <div>
              {/* filter pills */}
              <div className="flex gap-2 flex-wrap mb-3">
                {TICKET_FILTERS.map(({key,label})=>(
                  <button key={key} type="button" onClick={()=>setTicketFilter(key)}
                    className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] border transition-all ${ticketFilter===key?'bg-[linear-gradient(120deg,#c8788a,#e4a0b0)] text-white border-transparent shadow-md':'bg-white border-[#eecdd4] text-[#7a5460]'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b08a90]"/>
                <input value={query} onChange={e=>setQuery(e.target.value)} className="input-field pl-9 pr-9" placeholder="Search by ID, name, email, phone…"/>
                {query && <button type="button" onClick={()=>setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b08a90]"><X size={13}/></button>}
              </div>

              <div className="lg:grid lg:grid-cols-[55%_45%] gap-5">
                <div className="space-y-4">
                  {refreshing && filteredTickets.length===0 && <div className="rose-card p-5 text-sm text-[#9a7080]">Loading…</div>}
                  {!refreshing && filteredTickets.length===0 && <div className="rose-card p-5 text-sm text-[#9a7080]">No bookings here yet.</div>}
                  {grouped.map(([date,items])=>(
                    <div key={date}>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-[#9a7080] mb-2 px-1 sticky top-[62px] lg:top-2 z-10 bg-[#fdf8f5]/95 py-1">{fmtDate(date)}</p>
                      <div className="space-y-2.5">
                        {items.map(b=>(
                          <button key={b.bookingId} type="button" onClick={()=>pick(b)}
                            className={`w-full text-left glass-card p-4 transition-all hover:shadow-md ${selectedBooking?.bookingId===b.bookingId?'ring-2 ring-[#d9a0b0]/50':''}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="font-semibold text-sm text-[#3d1f6e]">{b.clientName}</p>
                              <div className="flex items-center gap-1.5">
                                {b.serviceAttended && <CheckCircle2 size={12} className="text-[#3d7a53]"/>}
                                <Badge status={b.bookingStatus}/>
                              </div>
                            </div>
                            <p className="font-mono text-[10px] text-[#9a7080] mb-1">{b.bookingId} · {b.bookingType}</p>
                            <div className="flex items-center gap-3 text-xs text-[#7a5460]">
                              <span>{b.preferredDate||'No date'}</span>
                              {b.totalAmount&&<span>{b.currency} {Number(b.totalAmount).toLocaleString()}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden lg:block sticky top-6 h-fit">
                  <DetailPanel booking={selectedBooking} note={note} setNote={setNote}
                    onUpdate={updateStatus} onArchive={archiveBooking} onRestore={restoreBooking}
                    onMarkAttended={markAttended} onDelete={deleteBooking}
                    busy={loadingId===selectedBooking?.bookingId}/>
                </div>
              </div>
            </div>
          )}

          {/* ── CALENDAR TAB ── */}
          {activeTab==='calendar' && <CalendarTab bookings={bookings}/>}

          {/* ── USERS TAB ── */}
          {activeTab==='users' && <UsersTab bookings={bookings} onDeleteUser={deleteUser}/>}

          {/* ── SETTINGS TAB ── */}
          {activeTab==='settings' && <SettingsTab pin={pin} adminProfile={adminProfile} onProfileSaved={name=>setAdminProfile(p=>({...p,name}))}/>}

          {/* ── SHOP TAB ── */}
          {activeTab==='shop' && <AdminShopTab pin={pin}/>}
          {activeTab==='orders' && <AdminOrdersTab pin={pin}/>}

          {/* ── PRICING TAB ── */}
          {activeTab==='pricing' && <AdminPricingTab pin={pin}/>}
        </div>
      </div>

      {/* mobile bottom sheet for tickets */}
      {sheetOpen && selectedBooking && (
        <>
          <button type="button" onClick={()=>setSheetOpen(false)} className="lg:hidden fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40"/>
          <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-[28px]">
            <DetailPanel booking={selectedBooking} note={note} setNote={setNote}
              onClose={()=>setSheetOpen(false)}
              onUpdate={updateStatus} onArchive={archiveBooking} onRestore={restoreBooking}
              onMarkAttended={markAttended} onDelete={deleteBooking}
              busy={loadingId===selectedBooking?.bookingId}/>
          </div>
        </>
      )}

      {/* FAB */}
      <AdminFab activeTab={activeTab} setActiveTab={setActiveTab} onRefresh={load} refreshing={refreshing} onLogout={logout}/>
    </div>
  );
}
