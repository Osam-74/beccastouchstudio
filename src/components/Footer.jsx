import { Link } from 'react-router-dom';
import { Phone, MapPin, Clock, Calendar } from 'lucide-react';
import { SITE, OPENING_HOURS } from '../utils/siteConfig';

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/>
  </svg>
);

const USP_ITEMS = [
  { icon: '💎', title: 'Professional',        desc: 'Experienced artists with skill and passion.' },
  { icon: '🌿', title: 'Quality Products',    desc: 'We use only high-quality beauty products.' },
  { icon: '🤍', title: 'Clean & Safe',        desc: 'Hygienic environment for all our customers.' },
  { icon: '⭐', title: 'Client Satisfaction', desc: 'Your beauty and comfort is our happiness.' },
];

export default function Footer() {
  return (
    <footer>
      {/* ── USP strip ── */}
      <div style={{ background: '#fdf3f6', borderTop: '1px solid rgba(200,120,138,0.12)' }}>
        <div className="max-w-7xl mx-auto px-5 lg:px-12 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {USP_ITEMS.map(({ icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg"
                  style={{ background: 'linear-gradient(135deg,#fce4ea,#f5e2f8)', border: '1px solid rgba(155,114,208,0.18)' }}>
                  {icon}
                </div>
                <div>
                  <p className="font-semibold text-[#3d1f6e] text-sm leading-tight">{title}</p>
                  <p className="text-[#9a6080] text-[11px] leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main footer body ── */}
      <div style={{ background: '#f7ecf1', borderTop: '1px solid rgba(200,120,138,0.15)' }}>
        <div className="max-w-7xl mx-auto px-5 lg:px-12 py-10">

          {/* Brand */}
          <div className="mb-8">
            <p className="font-display text-2xl text-[#3d1f6e] font-bold">Beccastouch <span className="text-[#c8788a] italic">Studio</span></p>
            <p className="text-[#8a5070] text-sm mt-1 max-w-md">Glam sessions, photography, content creation studio, and beauty products — all in one place.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 items-start">

            {/* Column 1: Contact */}
            <div>
              <p className="text-[#6b3fa0] text-[10px] uppercase tracking-[0.3em] font-semibold mb-4">Contact Us</p>
              <div className="flex flex-col gap-3">
                <a href={`tel:${SITE.phone?.replace(/\s/g,'')}`}
                  className="flex items-center gap-3 text-[#4a2060] hover:text-[#c8788a] text-sm transition-colors">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg,#fce4ea,#f0d4f8)', border: '1px solid rgba(200,120,138,0.2)' }}>
                    <Phone size={13} className="text-[#c8788a]"/>
                  </span>
                  {SITE.phone}
                </a>
                <a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 text-[#4a2060] hover:text-[#25d366] text-sm transition-colors">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg,#e4f8ea,#d8f0e0)', border: '1px solid rgba(37,211,102,0.2)' }}>
                    <WhatsAppIcon />
                  </span>
                  08051982695 <span className="text-[10px] text-[#8a9080] ml-0.5">(WhatsApp)</span>
                </a>
                <span className="flex items-start gap-3 text-[#4a2060] text-sm">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'linear-gradient(135deg,#fce4ea,#f5e0d0)', border: '1px solid rgba(200,120,80,0.2)' }}>
                    <MapPin size={13} className="text-[#c87850]"/>
                  </span>
                  <span className="leading-relaxed">{SITE.location}</span>
                </span>
                {/* Social row */}
                <div className="flex items-center gap-2 mt-1">
                  <a href={SITE.instagram} target="_blank" rel="noreferrer"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#4a2060] hover:text-[#e1306c] transition-colors"
                    style={{ background: 'linear-gradient(135deg,#fce4f0,#f8d4e8)', border: '1px solid rgba(225,48,108,0.2)' }}>
                    <InstagramIcon />
                  </a>
                  <a href={SITE.tiktok} target="_blank" rel="noreferrer"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#4a2060] hover:text-black transition-colors"
                    style={{ background: 'linear-gradient(135deg,#f0e8f8,#e8e0f0)', border: '1px solid rgba(107,63,160,0.2)' }}>
                    <TikTokIcon />
                  </a>
                  <a href={SITE.instagram} target="_blank" rel="noreferrer"
                    className="text-[#7a5090] hover:text-[#c8788a] transition-colors text-xs font-medium ml-0.5">
                    @beccastouch
                  </a>
                  <div className="ml-1 hidden">
                    <a href={SITE.instagram} target="_blank" rel="noreferrer" className="text-[10px] text-[#9a6080] block hover:text-[#e1306c]">@beccastouch</a>
                    <a href={SITE.tiktok} target="_blank" rel="noreferrer" className="text-[10px] text-[#9a6080] block hover:text-black">@beccastouch</a>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Opening Hours */}
            <div>
              <p className="text-[#6b3fa0] text-[10px] uppercase tracking-[0.3em] font-semibold mb-4">Opening Hours</p>
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg,#fce4ea,#f0d4f8)', border: '1px solid rgba(155,114,208,0.2)' }}>
                    <Clock size={13} className="text-[#9b72d0]"/>
                  </span>
                  <div>
                    <p className="text-[#3d1f6e] font-semibold text-sm">{OPENING_HOURS?.weekdays?.label}</p>
                    <p className="text-[#8a6070] text-xs mt-0.5">{OPENING_HOURS?.weekdays?.hours}</p>
                  </div>
                </div>
                <div className="h-px ml-11" style={{ background: 'rgba(107,63,160,0.1)' }} />
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg,#f0d4f8,#e4d4f8)', border: '1px solid rgba(155,114,208,0.2)' }}>
                    <Clock size={13} className="text-[#9b72d0]"/>
                  </span>
                  <div>
                    <p className="text-[#3d1f6e] font-semibold text-sm">{OPENING_HOURS?.sunday?.label}</p>
                    <p className="text-[#8a6070] text-xs mt-0.5">{OPENING_HOURS?.sunday?.hours}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Book CTA */}
            <div className="min-w-0">
              <div className="rounded-2xl p-6 flex flex-col items-center text-center"
                style={{ background: 'linear-gradient(135deg,#3d1f6e,#6b3fa0)', border: '1px solid rgba(155,114,208,0.3)' }}>
                <Calendar size={22} className="text-[#f0d4f8] mb-3"/>
                <p className="font-display text-xl text-white mb-1">Book a session</p>
                <p className="text-[#d4b8e8] text-xs mb-4">Studio, glam, or just a quick query — we're here.</p>
                <div className="flex gap-2 flex-wrap justify-center">
                  <Link to="/book-studio" className="px-4 py-2 rounded-full bg-white/20 text-white text-xs font-semibold hover:bg-white/30 transition-all border border-white/20">Studio</Link>
                  <Link to="/book-glam" className="px-4 py-2 rounded-full bg-[#c8788a] text-white text-xs font-semibold hover:bg-[#d4889a] transition-all">Glam</Link>
                </div>
              </div>
            </div>
          </div>

          {/* ── copyright ── */}
          <div className="mt-6 pt-5 pb-20 md:pb-6 border-t border-[rgba(107,63,160,0.12)] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#9a6080]">
            <p>© {new Date().getFullYear()} Beccastouch Studio. All rights reserved.</p>
            <p>Designed with ❤️ by{' '}
              <a href="https://osamusan.vercel.app" target="_blank" rel="noreferrer"
                className="font-semibold text-[#6b3fa0] hover:text-[#c8788a] transition-colors underline-offset-2 hover:underline">
                Ola
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
