import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const links = [
  { to: '/', label: 'Home' },
  { to: '/book-studio', label: 'Studio' },
  { to: '/book-glam', label: 'Glam' },
  { to: '/track-booking', label: 'Track' },
  { to: '/shop', label: 'Shop' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [loc.pathname]);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 shadow-[0_1px_0_rgba(107,63,160,0.08)] ${scrolled ? 'bg-[#fdf8f5]/92 backdrop-blur-xl border-b border-[rgba(155,114,208,0.15)] shadow-[0_2px_20px_rgba(61,31,110,0.08)]' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-5 lg:px-12 h-18 flex items-center justify-between" style={{height:'72px'}}>
        <Link to="/" className="font-display text-xl md:text-2xl text-[#3d1f6e] leading-none">
          Beccastouch <span className="text-gradient-rose italic">Studio</span>
        </Link>

        <div className="hidden md:flex items-center gap-7">
          {links.map((item) => (
            <Link key={item.to} to={item.to}
              className={`text-[10px] tracking-[0.28em] uppercase font-semibold transition-colors ${loc.pathname === item.to ? 'text-[#c8788a]' : 'text-[#6b3fa0] hover:text-[#c8788a]'}`}>
              {item.label}
            </Link>
          ))}
        </div>

        <button type="button" onClick={() => setOpen(v => !v)} className="md:hidden w-9 h-9 flex items-center justify-center rounded-full border border-[#eecdd4] bg-white/80 text-[#3a2228] shadow-sm">
          {open ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-[#eecdd4] bg-[#fdf8f5]/96 backdrop-blur-xl px-5 py-5 flex flex-col gap-4">
          {links.map((item) => (
            <Link key={item.to} to={item.to}
              className={`text-xs tracking-[0.22em] uppercase font-semibold py-1 ${loc.pathname === item.to ? 'text-[#b8607a]' : 'text-[#4a2e36]'}`}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
