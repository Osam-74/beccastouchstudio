import { forwardRef, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { MapPin, Ticket, Calendar, Clock, User, Banknote, Phone, Mail } from 'lucide-react';
import { SITE } from '../utils/siteConfig';

const BookingTicketCard = forwardRef(function BookingTicketCard({ booking }, ref) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !booking) return;
    const trackUrl = `${window.location.origin}/track-booking?id=${booking.bookingId}`;
    QRCode.toCanvas(canvasRef.current, trackUrl, {
      width: 56,   // small QR
      margin: 0,
      color: { dark: '#5a1f35', light: '#fdf0f2' },
    });
  }, [booking?.bookingId]);

  if (!booking) return null;

  // Two-column info rows: [label, value, icon]
  const rows = [
    ['Name',   booking.clientName || '—',                                          User],
    ['Date',   booking.preferredDate || 'TBD',                                     Calendar],
    ['Type',   booking.bookingType === 'studio' ? 'Studio Session' : 'Glam',       Ticket],
    ['Amount', `${booking.currency} ${Number(booking.totalAmount||0).toLocaleString()}`, Banknote],
  ];
  if (booking.startTime) rows.push(['Time', booking.startTime, Clock]);
  if (booking.phone)     rows.push(['Phone', booking.phone, Phone]);

  return (
    <div
      ref={ref}
      style={{
        width: 320,
        borderRadius: 24,
        overflow: 'hidden',
        background: '#fff',
        border: '1.5px solid rgba(200,120,138,0.3)',
        boxShadow: '0 4px 32px rgba(180,80,110,0.14)',
        fontFamily: 'Manrope, sans-serif',
        color: '#2a1820',
      }}
    >
      {/* ── TOP GRADIENT BAND ── */}
      <div style={{
        background: 'linear-gradient(135deg,#c8788a 0%,#e4a0b0 60%,#f2c4ac 100%)',
        padding: '18px 20px 16px',
      }}>
        {/* icon + "Ticket Booked" */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Ticket size={18} color="white" />
          </div>
          <div>
            <p style={{ margin:0, fontSize:9, textTransform:'uppercase', letterSpacing:'0.3em', color:'rgba(255,255,255,0.75)' }}>Ticket Booked</p>
            <p style={{ margin:0, fontSize:15, fontWeight:800, color:'white', lineHeight:1.2 }}>{SITE.name}</p>
          </div>
        </div>

        {/* location */}
        <div style={{ display:'flex', alignItems:'center', gap:5, color:'rgba(255,255,255,0.85)', fontSize:10 }}>
          <MapPin size={11} color="rgba(255,255,255,0.85)" />
          {SITE.location}
        </div>
      </div>

      {/* ── BOOKING ID BAND ── */}
      <div style={{
        background: '#fdf2f5',
        borderBottom: '1px dashed rgba(200,120,138,0.35)',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ margin:0, fontSize:8, textTransform:'uppercase', letterSpacing:'0.28em', color:'#9a6070' }}>Booking ID</p>
          <p style={{ margin:0, fontFamily:'monospace', fontSize:13, fontWeight:700, letterSpacing:'0.04em', color:'#3d1f6e' }}>{booking.bookingId}</p>
        </div>
        <span style={{
          padding:'4px 10px', borderRadius:99,
          fontSize:9, textTransform:'uppercase', letterSpacing:'0.18em', fontWeight:700,
          background: booking.bookingStatus === 'confirmed' ? '#f0faf3' : '#fff4e0',
          color: booking.bookingStatus === 'confirmed' ? '#3d7a53' : '#a07428',
          border: `1px solid ${booking.bookingStatus === 'confirmed' ? '#b8e0c8' : '#f0d898'}`,
        }}>
          {booking.bookingStatus}
        </span>
      </div>

      {/* ── INFO GRID (two columns) ── */}
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 12px' }}>
          {rows.map(([label, value, Icon]) => (
            <div key={label} style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <Icon size={9} color="#c8788a" />
                <p style={{ margin:0, fontSize:8, textTransform:'uppercase', letterSpacing:'0.24em', color:'#b08090' }}>{label}</p>
              </div>
              <p style={{ margin:0, fontSize:12, fontWeight:600, color:'#3d1f6e', lineHeight:1.3 }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── TEAR LINE ── */}
      <div style={{
        margin: '14px 0 0',
        borderTop: '1.5px dashed rgba(200,120,138,0.35)',
        position: 'relative',
      }}>
        {/* notch circles */}
        <div style={{ position:'absolute', top:-8, left:-10, width:16, height:16, borderRadius:'50%', background:'white', border:'1.5px solid rgba(200,120,138,0.3)' }} />
        <div style={{ position:'absolute', top:-8, right:-10, width:16, height:16, borderRadius:'50%', background:'white', border:'1.5px solid rgba(200,120,138,0.3)' }} />
      </div>

      {/* ── BOTTOM: QR + scan text ── */}
      <div style={{
        padding: '12px 20px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#fdf8f9',
      }}>
        <canvas ref={canvasRef} style={{ borderRadius:6, background:'#fdf0f2', flexShrink:0 }} />
        <div>
          <p style={{ margin:'0 0 3px', fontWeight:700, fontSize:11, color:'#3d1f6e' }}>Scan to track</p>
          <p style={{ margin:0, fontSize:9, color:'#7a5060', lineHeight:1.5 }}>{booking.summary || 'Scan QR to view your booking details online.'}</p>
        </div>
      </div>
    </div>
  );
});

export default BookingTicketCard;
