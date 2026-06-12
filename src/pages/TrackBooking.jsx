import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { Search, Download, Printer, RotateCcw, ArrowRight, ChevronDown, Sparkles, Camera } from 'lucide-react';
import { bookingApi } from '../utils/bookingApi';
import { SITE, BOOKING_RULES } from '../utils/siteConfig';
import { useToast } from '../hooks/useToast';
import BookingTicketCard from '../components/BookingTicketCard';

function Badge({ status }) {
  const m = {
    draft:     'bg-[#f4f1ef] text-[#7b736e] border-[#ddd6d1]',
    pending:   'bg-[#fff4e0] text-[#a07428] border-[#f0d898]',
    confirmed: 'bg-[#f0faf3] text-[#3d7a53] border-[#b8e0c8]',
    rejected:  'bg-[#fff0f0] text-[#a84040] border-[#f0c8c8]',
  };
  return <span className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] font-semibold border ${m[status]||m.pending}`}>{status}</span>;
}

const SEARCH_MODES = [
  { key:'id',    label:'Booking ID' },
  { key:'email', label:'Email address' },
  { key:'phone', label:'Phone number' },
];

export default function TrackBooking() {
  const [sp] = useSearchParams();
  const [searchMode, setSearchMode] = useState('id');
  const [query, setQuery]   = useState('');
  const [booking, setBooking] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const ticketRef = useRef(null);

  // auto-load from URL param
  useEffect(() => {
    const id = sp.get('id');
    if (id) { setSearchMode('id'); setQuery(id.toUpperCase()); lookup('id', id.toUpperCase()); }
  }, []);

  async function lookup(mode, value) {
    const q = (value || query).trim();
    if (!q) return showToast('Enter a search value first.', 'error');
    try {
      setLoading(true); setBooking(null); setResults([]);
      if (mode === 'id' || searchMode === 'id') {
        const { booking: b } = await bookingApi.getBooking(q.toUpperCase());
        setBooking(b); showToast('Booking found.', 'success');
      } else {
        const payload = searchMode === 'email' ? { email: q } : { phone: q };
        const { bookings } = await bookingApi.searchBookings(payload);
        if (!bookings?.length) throw new Error('No bookings found for that ' + searchMode + '.');
        if (bookings.length === 1) { setBooking(bookings[0]); showToast('Booking found.', 'success'); }
        else { setResults(bookings); showToast(`Found ${bookings.length} bookings.`, 'success'); }
      }
    } catch(e) { showToast(e.message, 'error'); } finally { setLoading(false); }
  }

  function reschedule() {
    if (!booking) return;
    if (Number(booking.rescheduleCount||0) >= 1) return showToast('Already used one reschedule.', 'error');
    navigate(booking.bookingType==='glam' ? `/book-glam?resume=${booking.bookingId}&mode=reschedule` : `/book-studio?resume=${booking.bookingId}&mode=reschedule`);
  }

  function resume() {
    if (!booking) return;
    navigate(booking.bookingType==='glam' ? `/book-glam?resume=${booking.bookingId}` : `/book-studio?resume=${booking.bookingId}`);
  }

  async function dlTicket() {
    if (!ticketRef.current || !booking) return;
    const u = await toPng(ticketRef.current, { cacheBust:true, pixelRatio:2 });
    const a = document.createElement('a'); a.href=u; a.download=`${booking.bookingId}-ticket.png`; a.click();
  }

  return (
    <div className="min-h-screen bg-silk pt-24 pb-28 md:pb-10">
      <div className="max-w-3xl mx-auto px-5">
        <div className="text-center mb-8">
          <p className="section-label text-[#b8607a] mb-3">Manage your booking</p>
          <h1 className="font-display text-4xl md:text-5xl text-[#3d1f6e] mb-3">Track every booking</h1>
          <p className="text-[#7a5460] text-sm max-w-lg mx-auto">Use your Booking ID, email address, or phone number to find your booking.</p>
        </div>

        {/* search mode tabs */}
        <div className="flex gap-2 justify-center mb-4">
          {SEARCH_MODES.map(({key, label}) => (
            <button key={key} type="button" onClick={() => { setSearchMode(key); setQuery(''); setBooking(null); setResults([]); }}
              className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-[0.14em] border transition-all ${searchMode===key ? 'bg-[linear-gradient(120deg,#c8788a,#e4a0b0)] text-white border-transparent shadow-md' : 'bg-white border-[#eecdd4] text-[#7a5460]'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* search form */}
        <form onSubmit={e=>{e.preventDefault();lookup(searchMode);}} className="rose-card p-5 mb-6 flex gap-3">
          <input value={query}
            onChange={e => setQuery(searchMode==='id' ? e.target.value.toUpperCase() : e.target.value)}
            placeholder={searchMode==='id' ? 'e.g. STU-20260609-AB3' : searchMode==='email' ? 'you@email.com' : '08000000000'}
            className="input-field flex-1" />
          <button type="submit" disabled={loading} className="btn-ink whitespace-nowrap">
            <Search size={14}/> {loading ? 'Searching…' : 'Find'}
          </button>
        </form>

        {/* multiple results picker */}
        {results.length > 0 && (
          <div className="rose-card p-5 mb-6">
            <p className="label-text mb-3">Multiple bookings found — select one:</p>
            <div className="space-y-2.5">
              {results.map(b => (
                <button key={b.bookingId} type="button" onClick={() => { setBooking(b); setResults([]); }}
                  className="w-full text-left glass-card p-4 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <p className="font-semibold text-sm text-[#3d1f6e]">{b.clientName}</p>
                    <Badge status={b.bookingStatus} />
                  </div>
                  <p className="font-mono text-xs text-[#9a7080]">{b.bookingId} · {b.bookingType} · {b.preferredDate||'No date'}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* booking detail */}
        {booking && (
          <div className="space-y-5 animate-fade-up">
            <div className="rose-card p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
                <div>
                  <p className="label-text mb-1">Booking found</p>
                  <h2 className="font-display text-3xl text-[#3d1f6e]">{booking.bookingId}</h2>
                </div>
                <Badge status={booking.bookingStatus} />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-5">
                {[['Client',booking.clientName],['Type',booking.bookingType],['Date',booking.preferredDate||'—'],['Start time',booking.startTime||'—'],['Amount',`${booking.currency} ${Number(booking.totalAmount||0).toLocaleString()}`]].filter(([,v])=>v&&v!=='—'||true).map(([k,v])=>(
                  <div key={k}>
                    <p className="label-text mb-0.5">{k}</p>
                    <p className="text-[#3d1f6e] font-medium capitalize">{v}</p>
                  </div>
                ))}
              </div>

              {booking.adminNote && (
                <div className="rounded-2xl bg-white/70 border border-[#eecdd4] p-4 mb-4 text-sm">
                  <p className="label-text mb-1">Admin note</p>
                  <p className="text-[#3d1f6e]">{booking.adminNote}</p>
                </div>
              )}

              <p className="text-xs text-[#9a7080]">{booking.summary}</p>
            </div>

            {/* action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={resume} disabled={['confirmed','rejected','archived'].includes(booking.bookingStatus)}
                className="btn-outline-dark justify-center disabled:opacity-40">
                <RotateCcw size={13}/> Resume draft
              </button>
              <button type="button" onClick={reschedule} disabled={Number(booking.rescheduleCount||0)>=1}
                className="btn-ink justify-center disabled:opacity-40">
                Reschedule <ArrowRight size={13}/>
              </button>
            </div>

            {/* ticket — only show if confirmed */}
            {booking.bookingStatus === 'confirmed' && (
              <div className="rose-card p-5">
                <p className="label-text mb-4">Your confirmed ticket</p>
                <div className="flex justify-center mb-4">
                  <BookingTicketCard ref={ticketRef} booking={booking} />
                </div>
                <div className="flex gap-3 justify-center">
                  <button type="button" onClick={dlTicket} className="btn-outline-dark"><Download size={13}/> Download</button>
                </div>
              </div>
            )}

            {booking.bookingStatus !== 'confirmed' && (
              <div className="rose-card p-5 text-center">
                <p className="text-2xl mb-2">⏳</p>
                <p className="font-semibold text-[#3d1f6e] mb-1">Ticket not ready yet</p>
                <p className="text-xs text-[#7a5460]">Your downloadable ticket will appear here once your booking is confirmed by the studio.</p>
              </div>
            )}

            {/* rules */}
            <details className="rose-card p-5">
              <summary className="label-text cursor-pointer flex items-center gap-2">Booking rules <ChevronDown size={12}/></summary>
              <ul className="mt-3 space-y-2 text-xs text-[#7a5460]">
                {BOOKING_RULES.map(r=><li key={r} className="flex gap-2"><span className="text-[#c8788a]">·</span>{r}</li>)}
              </ul>
            </details>
          </div>
        )}

        {/* ── Book Now nudge ──
            Always visible — whether the user found a booking, got no results,
            or just landed on the page fresh. Sits at the very bottom as a gentle CTA. */}
        <div className="mt-10 rounded-[24px] overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#fce4ea 0%,#f8d0dc 50%,#fde8e0 100%)', border: '1px solid #eecdd4' }}>
          <div className="p-6 md:p-8 flex flex-col md:flex-row gap-5 md:items-center md:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-[#b8607a] mb-1">Haven't booked yet?</p>
              <h3 className="font-display text-2xl text-[#3d1f6e] mb-1">Ready to book your session?</h3>
              <p className="text-sm text-[#6b4a52] max-w-sm">
                Whether it's a glam look or a studio shoot, your slot is waiting. Pick a service and lock in your date.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link to="/book-studio"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[14px] bg-[#03045E] text-white text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap">
                <Camera size={15}/> Book Studio
              </Link>
              <Link to="/book-glam"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[14px] bg-[linear-gradient(135deg,#c8788a,#e4a0b0)] text-white text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shadow-[0_4px_14px_rgba(200,120,138,0.35)]">
                <Sparkles size={15}/> Book Glam
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
