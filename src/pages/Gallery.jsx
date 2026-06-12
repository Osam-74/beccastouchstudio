import React from 'react';
import { Camera, ArrowLeft, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const GALLERY = [
  { id: 1,  src: 'https://images.unsplash.com/photo-1542596594-649edbc13630?w=600&q=80', label: 'Studio Portrait',      cat: 'portraits' },
  { id: 2,  src: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80', label: 'Bridal Glam',         cat: 'bridal' },
  { id: 3,  src: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80', label: 'Wedding Day',         cat: 'bridal' },
  { id: 4,  src: 'https://images.unsplash.com/photo-1516914943479-89db7d9ae7f2?w=600&q=80', label: 'Fashion Shoot',       cat: 'fashion' },
  { id: 5,  src: 'https://images.unsplash.com/photo-1512099734263-a9a4e0a26bdb?w=600&q=80', label: 'Makeup Artistry',     cat: 'glam' },
  { id: 6,  src: 'https://images.unsplash.com/photo-1487412947147-5cebf100d293?w=600&q=80', label: 'Glam Ready',          cat: 'glam' },
  { id: 7,  src: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&q=80', label: 'Studio Setup',         cat: 'studio' },
  { id: 8,  src: 'https://images.unsplash.com/photo-1526817575615-7685a7295fc0?w=600&q=80', label: 'Creative Portrait',   cat: 'portraits' },
  { id: 9,  src: 'https://images.unsplash.com/photo-1604014237800-1c9102c219da?w=600&q=80', label: 'Birthday Glam',       cat: 'glam' },
  { id: 10, src: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&q=80', label: 'Professional Headshot',cat: 'portraits' },
  { id: 11, src: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=600&q=80', label: 'Couple Session',      cat: 'fashion' },
  { id: 12, src: 'https://images.unsplash.com/photo-1595959183082-7b570b7e08e2?w=600&q=80', label: 'Studio Lighting',     cat: 'studio' },
];

const CATS = ['all', 'portraits', 'bridal', 'glam', 'fashion', 'studio'];

export default function Gallery() {
  const [active, setActive]     = React.useState('all');
  const [lightbox, setLightbox] = React.useState(null);

  const filtered = active === 'all' ? GALLERY : GALLERY.filter(g => g.cat === active);

  return (
    <div className="min-h-screen pb-28 md:pb-10 pt-28" style={{ background: '#FDF8F3' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-10">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-body mb-6 transition-colors"
            style={{ color: '#A0736A' }}
            onMouseEnter={e => e.currentTarget.style.color = '#C8728A'}
            onMouseLeave={e => e.currentTarget.style.color = '#A0736A'}>
            <ArrowLeft size={13}/> Back to Home
          </Link>
          <p className="section-label">Our Work</p>
          <h1 className="section-title">Studio <em className="brand-text">Gallery</em></h1>
          <div className="rose-divider"/>
          <p className="font-body text-sm mt-4 max-w-md" style={{ color: '#A0736A' }}>
            A glimpse into the magic we create at Beccastouch Studio, Ibadan.
          </p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-10">
          {CATS.map(c => (
            <button key={c} type="button" onClick={() => setActive(c)}
              className={active === c ? 'pill-active' : 'pill-inactive'}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {filtered.map(img => (
            <div key={img.id} onClick={() => setLightbox(img)}
              className="relative overflow-hidden group cursor-pointer aspect-square rounded-2xl"
              style={{ background: '#F2E8DA' }}>
              <img src={img.src} alt={img.label}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={e => { e.target.src = `https://picsum.photos/seed/${img.id}/600/600`; }}/>
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4"
                style={{ background: 'linear-gradient(to top, rgba(92,61,53,0.7) 0%, transparent 60%)' }}>
                <p className="text-white text-xs font-body font-medium">{img.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <p className="font-body text-sm mb-6" style={{ color: '#A0736A' }}>Ready to be part of our gallery?</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/book-studio" className="btn-primary">Book Studio Session</Link>
            <Link to="/book-glam"   className="btn-outline">Book Glam</Link>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(60,28,22,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setLightbox(null)}>
          <div className="relative max-w-3xl w-full animate-fade-in" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)}
              className="absolute -top-12 right-0 w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all">
              <X size={18}/>
            </button>
            <img src={lightbox.src} alt={lightbox.label}
              className="w-full max-h-[80vh] object-contain rounded-2xl"/>
            <p className="font-body text-sm text-center mt-4" style={{ color: 'rgba(253,248,243,0.7)' }}>
              {lightbox.label}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
