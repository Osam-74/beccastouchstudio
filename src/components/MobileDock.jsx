import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { House, Camera, Sparkles, Search, ShoppingBag } from 'lucide-react';

const items = [
  { to: '/', label: 'Home', icon: House },
  { to: '/book-studio', label: 'Studio', icon: Camera },
  { to: '/book-glam', label: 'Glam', icon: Sparkles },
  { to: '/track-booking', label: 'Track', icon: Search },
  { to: '/shop', label: 'Shop', icon: ShoppingBag },
];

const SNAP_EDGE = 16; // px from left/right edge when snapped

export default function MobileDock() {
  const { pathname } = useLocation();
  const [side, setSide] = useState('center'); // 'center' | 'left' | 'right'
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const dockRef = useRef(null);

  function handleDragStart(e) {
    setDragging(true);
    startX.current = e.touches ? e.touches[0].clientX : e.clientX;
  }

  function handleDragEnd(e) {
    if (!dragging) return;
    setDragging(false);
    const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const delta = endX - startX.current;
    if (Math.abs(delta) < 30) return; // tap, ignore
    if (delta < 0) setSide('left');
    else setSide('right');
  }

  // reset to center on route change
  useEffect(() => setSide('center'), [pathname]);

  const posStyle = side === 'left'
    ? { left: SNAP_EDGE, right: 'auto', transform: 'none' }
    : side === 'right'
    ? { right: SNAP_EDGE, left: 'auto', transform: 'none' }
    : { left: '50%', transform: 'translateX(-50%)' };

  const isLeft = side === 'left';
  const isRight = side === 'right';

  return (
    <div
      ref={dockRef}
      onTouchStart={handleDragStart}
      onTouchEnd={handleDragEnd}
      onMouseDown={handleDragStart}
      onMouseUp={handleDragEnd}
      style={{ ...posStyle, transition: dragging ? 'none' : 'all 0.3s cubic-bezier(.34,1.56,.64,1)' }}
      className="md:hidden fixed bottom-4 z-50 select-none"
    >
      {/* pill */}
      <div className="rounded-[30px] border border-[#eecdd4] bg-[#fdf8f5]/95 backdrop-blur-2xl shadow-[0_8px_40px_rgba(28,18,20,0.14)] px-2 py-2">
        <div className={`flex ${isLeft ? 'flex-row' : isRight ? 'flex-row-reverse' : 'flex-row'} items-center gap-0.5`}>
          {items.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link key={to} to={to}
                className={`flex flex-col items-center justify-center w-14 min-h-[54px] rounded-[22px] transition-all duration-200 ${active ? 'bg-[linear-gradient(135deg,#c8788a,#e4a0b0)] text-white shadow-[0_4px_14px_rgba(200,120,138,0.35)]' : 'text-[#6b4a52] hover:bg-[#faeef0]'}`}>
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                <span className="text-[9px] uppercase tracking-[0.14em] mt-0.5 font-semibold leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
        {/* drag hint */}
        <div className="w-6 h-1 rounded-full bg-[#e2c0c8]/60 mx-auto mt-1.5" />
      </div>
    </div>
  );
}
