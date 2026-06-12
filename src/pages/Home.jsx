import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Sparkles, Search } from 'lucide-react';
import PwaInstallCard from '../components/PwaInstallCard';
import { SITE } from '../utils/siteConfig';
import heroImg from '../assets/hero.png';

const INSTAGRAM = 'https://www.instagram.com/beccastouch?igsh=NG0zNmkxeWFzdjV6';

const whyPoints = [
  { title: 'Real artists, not just a platform', body: 'Every service is delivered by trained, passionate professionals who actually care about your look. No faceless booking bots.' },
  { title: 'We run on time', body: 'Your appointment is yours — not squeezed between five others. You get the time and attention you paid for.' },
  { title: 'Glamour for every woman', body: "Every skin tone, body type, and vibe is celebrated here. You don't have to fit a mold to shine." },
];

const cards = [
  { icon: <Camera size={22} />, title: 'Studio Sessions', text: 'For photoshoots or content creation. Solo, group, couples. Backdrops, ring lights, good vibes — book by the hour.', cta: 'Book studio time', to: '/book-studio' },
  { icon: <Sparkles size={22} />, title: 'Glam & Bridal', text: 'Full glam, soft beat, or your wedding day face. Home service available. You tell us the look.', cta: 'Book your glam', to: '/book-glam' },
  { icon: <Search size={22} />, title: 'Track every booking', text: 'Use your booking ID to check status, reschedule once, or pick up where you left off.', cta: 'Manage booking', to: '/track-booking' },
];

const gallery = [
  { title: 'Behind the scenes', tone: 'from-[#f0d4da] via-[#f7e8e4] to-[#f4d0d6]' },
  { title: 'Soft light', tone: 'from-[#f7e4e8] via-[#f4dce0] to-[#efd8d0]' },
  { title: 'Studio vibe', tone: 'from-[#f2d8de] via-[#f8ecec] to-[#f0dcd6]' },
];

export default function Home() {
  return (
    <div className="overflow-hidden">

      {/* ── HERO ──
          Desktop: two-column grid. Left = content. Right = image column, clipped
                   BELOW the navbar (pt-24 = 96px pushes content down, image starts at 0
                   inside its own column but we clip the top with pt-24 on the outer wrapper).
          Mobile:  single column. Heading → full-width image strip → buttons.
      */}
      {/* HERO: left text in container, right image is full-bleed to viewport edge */}
      <section className="relative bg-blush overflow-hidden min-h-screen">

        {/* Desktop: absolutely positioned image on the right half, below navbar */}
        <div className="hidden lg:block" style={{
          position: 'absolute',
          top: '72px', /* navbar height — no overlap */
          right: 0,
          bottom: 0,
          width: '44%',
          zIndex: 0,
        }}>
          <img
            src={heroImg}
            alt="Beccastouch Studio"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center top',
              display: 'block',
            }}
          />
          {/* left-edge soft fade */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, rgba(253,242,245,0.7) 0%, transparent 35%)',
            pointerEvents: 'none',
          }} />
        </div>

        <div className="max-w-7xl mx-auto px-5 lg:px-12 relative" style={{ zIndex: 1 }}>
          <div className="flex flex-col lg:grid lg:grid-cols-[56%_44%] lg:items-stretch min-h-screen">

            {/* LEFT — text + buttons */}
            <div className="flex flex-col justify-center pt-24 pb-16 lg:py-32 animate-fade-up order-1">
              <p className="section-label text-[#b8607a] mb-4">PHOTOGRAPHY · BEAUTY · STYLE</p>
              <h1 className="font-display font-black text-[31px] md:text-[48px] lg:text-[62px] leading-[1.05] text-[#3d1f6e] mb-5" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
                Your Face,<br />
                <span className="text-gradient-rose">Your First Brand,</span><br />
                Your Confidence.
              </h1>
              <p className="text-[#5a3a42] text-sm md:text-base max-w-lg leading-relaxed mb-3">
                Glam that moves with you — shoots, events, and every room you walk into. One session with us reveals the beautiful, confident and unstoppable version of yourself.
              </p>
              <p className="text-[#5a3a42] text-sm max-w-lg leading-relaxed mb-6">
                Glam, Photography studio, Beauty products — all you need in one place.
              </p>

              {/* Mobile image — full-width, portrait ratio to show the full subject */}
              <div className="block lg:hidden mb-6 -mx-5">
                <img
                  src={heroImg}
                  alt="Beccastouch Studio"
                  style={{
                    width: '100%',
                    height: 'auto',
                    aspectRatio: '4/5',
                    objectFit: 'cover',
                    objectPosition: 'center top',
                    display: 'block',
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Link to="/book-studio" className="btn-ink">Book Studio <ArrowRight size={14} /></Link>
                <Link to="/book-glam" className="btn-rose">Book Glam <ArrowRight size={14} /></Link>
                <Link to="/track-booking" className="btn-outline-dark">Track / Resume</Link>
              </div>
              <p className="text-xs text-[#9a7080] mt-5">Based in {SITE.location}</p>
            </div>

            {/* RIGHT — empty column on desktop (image is absolutely positioned above) */}
            <div className="hidden lg:block order-2" />

          </div>
        </div>
      </section>

      {/* ── WHAT MAKES US DIFFERENT ── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-5 lg:px-12">
          <div className="mb-10 max-w-xl">
            <p className="section-label text-[#b8607a] mb-3">Our promise</p>
            <h2 className="font-display text-[26px] md:text-[38px] text-[#3d1f6e]">What makes us different</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {whyPoints.map((item) => (
              <div key={item.title} className="rose-card p-7">
                <div className="w-2 h-8 rounded-full bg-rose-gradient mb-4" />
                <h3 className="font-display text-2xl text-[#3d1f6e] mb-3">{item.title}</h3>
                <p className="text-[#6b4a52] text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-7">
            <a href={INSTAGRAM} target="_blank" rel="noreferrer" className="btn-outline-dark">See our work <ArrowRight size={14} /></a>
          </div>
        </div>
      </section>

      {/* ── SERVICE CARDS ── */}
      <section className="py-20 bg-blush">
        <div className="max-w-7xl mx-auto px-5 lg:px-12">
          <div className="grid md:grid-cols-3 gap-5">
            {cards.map((item) => (
              <div key={item.title} className="glass-card p-7 flex flex-col">
                <div className="w-11 h-11 rounded-2xl bg-rose-gradient flex items-center justify-center text-white mb-5 shadow-[0_4px_14px_rgba(200,120,138,0.3)]">{item.icon}</div>
                <h3 className="font-display text-2xl text-[#3d1f6e] mb-3">{item.title}</h3>
                <p className="text-[#6b4a52] text-sm leading-relaxed flex-1 mb-5">{item.text}</p>
                <Link to={item.to} className="btn-outline-dark self-start">{item.cta} <ArrowRight size={13} /></Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY ── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-5 lg:px-12">
          <div className="flex items-end justify-between gap-6 mb-8 flex-wrap">
            <div>
              <p className="section-label text-[#b8607a] mb-3">Gallery</p>
              <h2 className="font-display text-[26px] md:text-[38px] text-[#3d1f6e]">Real clients, real moments</h2>
            </div>
            <p className="text-[#7a5460] text-sm max-w-xs">No stock photography here. Just women who showed up and shined.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 mb-7">
            {gallery.map((item) => (
              <div key={item.title} className="rounded-[28px] overflow-hidden border border-[#eecdd4] shadow-sm">
                <div className={`aspect-[4/5] bg-gradient-to-br ${item.tone} relative`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_30%,rgba(255,255,255,0.55),transparent_42%)]" />
                  <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-white/75 backdrop-blur-sm px-4 py-3">
                    <p className="font-semibold text-[#2a1820] text-sm">{item.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <a href={INSTAGRAM} target="_blank" rel="noreferrer" className="btn-outline-dark">See our work <ArrowRight size={13} /></a>
        </div>
      </section>

      {/* ── MAKEUP ARTISTRY SERVICES ── */}
      <section className="py-20 bg-blush">
        <div className="max-w-7xl mx-auto px-5 lg:px-12">
          <div className="mb-10 max-w-xl">
            <p className="section-label text-[#b8607a] mb-3">What we do</p>
            <h2 className="font-display text-[26px] md:text-[38px] text-[#3d1f6e]">Makeup Artistry</h2>
            <p className="text-[#6b4a52] text-sm mt-3 leading-relaxed">From everyday glam to special occasions — we bring out the best version of you. Every service is delivered by trained professionals who care about your look.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {[
              { icon:'💄', title:'Makeover & Gele', desc:'Full glam beat with professional gele tying. Perfect for events, owambes, and special days.' },
              { icon:'💅', title:'Pedicure & Manicure', desc:'Clean, polished nails from toes to fingertips. Relaxing treatments with quality products.' },
              { icon:'✨', title:'Nails Fixing', desc:'Nail extensions, gel nails, nail art and more. Your nails, done right.' },
              { icon:'🎀', title:'Bridal Glam', desc:'Your wedding day face, perfected. Home service available. Long-lasting, breathtaking looks.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="rose-card p-6 flex flex-col">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4"
                  style={{ background: 'linear-gradient(135deg,#fce4ea,#f5e2f8)', border: '1px solid rgba(200,120,138,0.15)' }}>
                  {icon}
                </div>
                <h3 className="font-display text-lg text-[#3d1f6e] mb-2">{title}</h3>
                <p className="text-[#6b4a52] text-sm leading-relaxed flex-1">{desc}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/book-glam" className="btn-rose">Book your glam <ArrowRight size={14} /></Link>
            <a href={INSTAGRAM} target="_blank" rel="noreferrer" className="btn-outline-dark">See our work <ArrowRight size={14} /></a>
          </div>
        </div>
      </section>

            {/* ── PWA + VIBE ── */}
      <section className="py-20 bg-blush">
        <div className="max-w-7xl mx-auto px-5 lg:px-12 space-y-6">
          <PwaInstallCard />
          <div className="sunset-card p-8 md:p-10 flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
            <div>
              <p className="section-label text-[#b8607a] mb-2">Boutique energy</p>
              <h3 className="font-display text-3xl text-[#3d1f6e] mb-2">Beccastouch Studio</h3>
              <p className="text-[#6b4a52] text-sm max-w-lg">A soft, modern beauty and studio experience built for women who want elegance, ease, and a little extra main-character energy.</p>
            </div>
            <Link to="/track-booking" className="btn-ink whitespace-nowrap">Open tracking <ArrowRight size={14} /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
