import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ShoppingBag, Search, MessageCircle, X, ChevronLeft, ChevronRight, ShoppingCart, Trash2, Plus, Minus, Send , SlidersHorizontal } from 'lucide-react';
import { bookingApi } from '../utils/bookingApi';
import { SITE } from '../utils/siteConfig';
import { useToast } from '../hooks/useToast';

const CATS = ['All', 'Makeup', 'Skincare', 'Hair', 'Tools & Accessories', 'Bundles', 'Other'];
const CART_KEY = 'beccastouch_cart_v1';

/* ── Cart helpers (localStorage-based session, no login needed) ── */
function loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
}
function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

/* ── Image carousel ── */
function ImageCarousel({ images, name, className = '' }) {
  const [idx, setIdx] = useState(0);
  const imgs = Array.isArray(images) && images.length ? images : [];
  if (!imgs.length) return (
    <div className={`aspect-square w-full bg-gradient-to-br from-[#fce4ea] to-[#f5e2f8] flex items-center justify-center ${className}`}>
      <ShoppingBag size={32} className="text-[#c8788a]/40"/>
    </div>
  );
  return (
    <div className={`relative aspect-square w-full overflow-hidden bg-[#fdf0f4] ${className}`}>
      <img src={imgs[idx]} alt={name} className="w-full h-full object-cover transition-opacity duration-300"/>
      {imgs.length > 1 && <>
        <button type="button" onClick={e=>{e.stopPropagation();setIdx(i=>(i-1+imgs.length)%imgs.length);}}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 flex items-center justify-center shadow-sm">
          <ChevronLeft size={13}/>
        </button>
        <button type="button" onClick={e=>{e.stopPropagation();setIdx(i=>(i+1)%imgs.length);}}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 flex items-center justify-center shadow-sm">
          <ChevronRight size={13}/>
        </button>
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
          {imgs.map((_,i)=>(
            <button key={i} type="button" onClick={e=>{e.stopPropagation();setIdx(i);}} className={`rounded-full transition-all ${i===idx?'bg-[#c8788a] w-3 h-1.5':'bg-white/60 w-1.5 h-1.5'}`}/>
          ))}
        </div>
      </>}
    </div>
  );
}

/* ── Full product detail page ── */
function ProductDetailPage({ product, cart, onAddToCart, onBack }) {
  const [mainIdx, setMainIdx] = useState(0);
  if (!product) return null;
  const images = Array.isArray(product.images) && product.images.length ? product.images : product.image_url ? [product.image_url] : [];
  const inCart = cart.some(i => i.id === product.id);
  const cartItem = cart.find(i => i.id === product.id);
  const hasSale = product.sale_price != null && Number(product.sale_price) > 0 && Number(product.sale_price) < Number(product.price);

  return (
    <div className="fixed inset-0 z-40 bg-[#fdf8f5] overflow-y-auto">
      {/* Back bar */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-[#f0e0e8] px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={onBack} className="w-9 h-9 rounded-full border border-[#eecdd4] bg-white flex items-center justify-center text-[#3d1f6e]">
          <ChevronLeft size={16}/>
        </button>
        <p className="font-semibold text-[#3d1f6e] text-sm truncate flex-1">{product.name}</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-32">
        {/* Main image */}
        <div className="relative rounded-[24px] overflow-hidden bg-[#fdf0f4] mb-4 aspect-square w-full">
          {images.length > 0 ? (
            <img src={images[mainIdx]} alt={product.name} className="w-full h-full object-cover"/>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag size={48} className="text-[#c8788a]/30"/>
            </div>
          )}
          {!product.in_stock && (
            <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-semibold">Out of stock</div>
          )}
        </div>

        {/* Thumbnail gallery */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
            {images.map((src, i) => (
              <button key={i} type="button" onClick={() => setMainIdx(i)}
                className={`shrink-0 w-16 h-16 rounded-[12px] overflow-hidden border-2 transition-all ${i === mainIdx ? 'border-[#c8788a]' : 'border-transparent opacity-60 hover:opacity-90'}`}>
                <img src={src} alt="" className="w-full h-full object-cover"/>
              </button>
            ))}
          </div>
        )}

        {/* Product info */}
        <div className="bg-white rounded-[20px] p-5 mb-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <p className="font-display text-2xl text-[#3d1f6e] leading-tight">{product.name}</p>
              <p className="text-xs text-[#9a7080] mt-1">{product.category}</p>
            </div>
            <div className="text-right shrink-0">
              {hasSale ? (
                <>
                  <p className="font-bold text-xl text-[#c8788a]">₦{Number(product.sale_price).toLocaleString()}</p>
                  <p className="text-sm text-[#9a8080] line-through">₦{Number(product.price).toLocaleString()}</p>
                </>
              ) : (
                <p className="font-bold text-xl text-[#c8788a]">₦{Number(product.price||0).toLocaleString()}</p>
              )}
            </div>
          </div>
          <ProductDescription text={product.description} />
        </div>

        {/* Add to cart */}
        <div className="bg-white rounded-[20px] p-4">
          {product.in_stock ? (
            <button type="button" onClick={() => { onAddToCart(product); onBack(); }}
              className={`w-full py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${inCart ? 'bg-[#3d1f6e] text-white' : 'bg-[#c8788a] text-white hover:bg-[#d4889a]'}`}>
              <ShoppingCart size={16}/>
              {inCart ? `In cart (×${cartItem?.qty || 1}) — add another` : 'Add to cart'}
            </button>
          ) : (
            <div className="w-full py-4 rounded-2xl bg-[#f4f1ef] text-[#9a8880] font-semibold text-sm text-center">Currently out of stock</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Cart drawer ── */
function CartDrawer({ cart, onUpdate, onRemove, onClose, onCheckout }) {
  const total = cart.reduce((s,i) => s + i.price * i.qty, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto rounded-t-[28px] sm:rounded-l-[28px] sm:rounded-tr-none flex flex-col pb-20 sm:pb-0" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0e0e8]">
          <p className="font-display text-xl text-[#3d1f6e]">Your cart</p>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-[#fdf0f2] flex items-center justify-center text-[#9a6070]"><X size={14}/></button>
        </div>
        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-[#9a7080]">
            <ShoppingCart size={32} className="mb-3 text-[#e8c4cc]"/>
            <p className="text-sm">Your cart is empty</p>
          </div>
        ) : (
          <>
            <div className="flex-1 px-5 py-4 space-y-3">
              {cart.map(item => (
                <div key={item.id} className="flex gap-3 items-center">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-14 h-14 rounded-xl object-cover border border-[#f0e0e8] shrink-0"/>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-[#fdf0f2] flex items-center justify-center shrink-0"><ShoppingBag size={16} className="text-[#c8788a]/40"/></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#3d1f6e] truncate">{item.name}</p>
                    <p className="text-xs text-[#c8788a] font-bold">₦{Number(item.price||0).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => onUpdate(item.id, item.qty - 1)} className="w-6 h-6 rounded-full border border-[#eecdd4] flex items-center justify-center text-[#9a7080]"><Minus size={10}/></button>
                    <span className="text-sm font-bold text-[#3d1f6e] w-5 text-center">{item.qty}</span>
                    <button type="button" onClick={() => onUpdate(item.id, item.qty + 1)} className="w-6 h-6 rounded-full border border-[#eecdd4] flex items-center justify-center text-[#9a7080]"><Plus size={10}/></button>
                    <button type="button" onClick={() => onRemove(item.id)} className="w-6 h-6 rounded-full bg-[#fff0f0] border border-[#f0c8c8] flex items-center justify-center text-[#b05860] ml-1"><Trash2 size={10}/></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-[#f0e0e8] space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[#3d1f6e]">Total</p>
                <p className="font-bold text-xl text-[#c8788a]">₦{total.toLocaleString()}</p>
              </div>
              <button type="button" onClick={onCheckout}
                className="w-full py-3.5 rounded-2xl bg-[#3d1f6e] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#5a3a8a] transition-all">
                <ShoppingCart size={15}/> Proceed to checkout
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Checkout form ── */
function CheckoutModal({ cart, onClose, onDone }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ name:'', phone:'', email:'', delivery:'pickup', notes:'' });
  const [submitting, setSubmitting] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const total = cart.reduce((s,i) => s + i.price * i.qty, 0);

  const itemsSummary = cart.map(i => `• ${i.name} ×${i.qty} = ₦${(i.price*i.qty).toLocaleString()}`).join('\n');
  const fullSummary = `*SHOP ORDER — Beccastouch Studio*\n\n${itemsSummary}\n\n*Total: ₦${total.toLocaleString()}*\n\nName: ${form.name}\nPhone: ${form.phone}\nDelivery: ${form.delivery === 'home' ? 'Home Delivery' : 'Self Pickup'}${form.notes ? '\nNote: ' + form.notes : ''}`;

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return showToast('Name and phone are required.','error');
    setSubmitting(true);
    try {
      // Save order to backend
      await bookingApi.saveShopOrder({
        name: form.name, phone: form.phone, email: form.email,
        delivery_type: form.delivery, notes: form.notes,
        items: cart.map(i => ({ id:i.id, name:i.name, qty:i.qty, price:i.price })),
        total_amount: total,
      });
      // Open WhatsApp with order summary
      const waMsg = encodeURIComponent(fullSummary);
      window.open(`https://wa.me/${SITE.whatsapp}?text=${waMsg}`, '_blank');
      onDone();
    } catch(e) { showToast(e.message, 'error'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] overflow-hidden max-h-[95vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0e0e8]">
          <p className="font-display text-xl text-[#3d1f6e]">Checkout</p>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-[#fdf0f2] flex items-center justify-center text-[#9a6070]"><X size={14}/></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Order summary */}
          <div className="rounded-2xl border border-[rgba(61,107,223,0.18)] bg-[#fdf8f5] p-4 space-y-1">
            <p className="text-[10px] font-bold text-[#3d1f6e] uppercase tracking-[0.18em] mb-2">Order summary</p>
            {cart.map(i=>(
              <div key={i.id} className="flex items-center justify-between text-xs">
                <span className="text-[#5a3a42]">{i.name} ×{i.qty}</span>
                <span className="font-semibold text-[#3d1f6e]">₦{(i.price*i.qty).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm font-bold text-[#c8788a] pt-2 border-t border-[#eecdd4] mt-2">
              <span>Total</span><span>₦{total.toLocaleString()}</span>
            </div>
          </div>

          <div>
            <label className="label-text">Full name *</label>
            <input value={form.name} onChange={e=>set('name',e.target.value)} required className="input-field" placeholder="Your full name" style={{background:'#fff',border:'1px solid rgba(61,107,223,0.18)'}}/>
          </div>
          <div>
            <label className="label-text">Phone number *</label>
            <input value={form.phone} onChange={e=>set('phone',e.target.value)} required className="input-field" placeholder="08000000000" style={{background:'#fff',border:'1px solid rgba(61,107,223,0.18)'}}/>
          </div>
          <div>
            <label className="label-text">Email (optional)</label>
            <input type="email" value={form.email} onChange={e=>set('email',e.target.value)} className="input-field" placeholder="you@email.com" style={{background:'#fff',border:'1px solid rgba(61,107,223,0.18)'}}/>
          </div>

          {/* Delivery type */}
          <div>
            <p className="label-text mb-2">Delivery option</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { k:'pickup', t:'Self Pickup', d:'Collect at our studio in Bodija' },
                { k:'home',   t:'Home Delivery', d:'We deliver to your address' },
              ].map(({ k, t, d }) => (
                <button key={k} type="button" onClick={() => set('delivery', k)}
                  className={`rounded-2xl border p-3 text-left transition-all ${form.delivery===k?'border-[#c8788a] bg-[linear-gradient(135deg,#fce4ea,#f8d8e2)] shadow-sm':'border-[#eecdd4] bg-white hover:border-[#d9a0b0]'}`}>
                  <p className="font-semibold text-sm text-[#3d1f6e]">{t}</p>
                  <p className="text-xs text-[#9a7080] mt-0.5">{d}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-text">Additional notes</label>
            <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2} className="input-field resize-none" placeholder="Any delivery instructions or requests…" style={{background:'#fff',border:'1px solid rgba(61,107,223,0.18)'}}/>
          </div>

          <button type="submit" disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-[#25d366] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#1da952] transition-all disabled:opacity-60">
            <MessageCircle size={16}/> {submitting ? 'Processing…' : 'Send order on WhatsApp'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Main shop page ── */

// Collapsible product description
function ProductDescription({ text }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="text-xs font-semibold text-[#6b3fa0] flex items-center gap-1 hover:text-[#c8788a] transition-colors">
        {open ? '▲ Hide description' : '▼ Show description'}
      </button>
      {open && <p className="text-sm text-[#6b4a52] leading-relaxed mt-2">{text}</p>}
    </div>
  );
}

export default function Shop() {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const [selected, setSelected] = useState(null);
  const [cart, setCart] = useState(loadCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Persist cart
  useEffect(() => { saveCart(cart); }, [cart]);

  useEffect(() => {
    const API = 'https://beccastouchstudio-api.amusanolamide74.workers.dev';
    fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'getPublicProducts' }) })
      .then(r => r.json())
      .then(d => { if (d.products) setProducts(d.products); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addToCart = useCallback((product) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      const imgs = Array.isArray(product.images) && product.images.length ? product.images : product.image_url ? [product.image_url] : [];
      if (ex) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: product.id, name: product.name, price: Number(product.price||0), qty: 1, image: imgs[0] || '' }];
    });
    showToast(`${product.name} added to cart!`, 'success');
  }, []);

  const updateQty = (id, qty) => {
    if (qty < 1) return removeFromCart(id);
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
  };
  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const filtered = useMemo(() => {
    return products
      .filter(p => !p.is_archived)
      .filter(p => cat === 'All' || p.category === cat)
      .filter(p => !search || [p.name, p.description, p.category].some(v => String(v||'').toLowerCase().includes(search.toLowerCase())));
  }, [products, cat, search]);

  const cats = useMemo(() => {
    const used = new Set(products.filter(p=>!p.is_archived).map(p=>p.category).filter(Boolean));
    return CATS.filter(c => c==='All' || used.has(c));
  }, [products]);

  const cartCount = cart.reduce((s,i) => s + i.qty, 0);

  return (
    <div className="min-h-screen bg-[#fdf8f5] pt-24 pb-32 md:pb-16">
      {selected && <ProductDetailPage product={selected} cart={cart} onAddToCart={addToCart} onBack={()=>setSelected(null)}/>}
      {cartOpen && <CartDrawer cart={cart} onUpdate={updateQty} onRemove={removeFromCart} onClose={()=>setCartOpen(false)} onCheckout={()=>{setCartOpen(false);setCheckoutOpen(true);}}/>}
      {checkoutOpen && <CheckoutModal cart={cart} onClose={()=>setCheckoutOpen(false)} onDone={()=>{ setCart([]); setCheckoutOpen(false); showToast('Order sent! WhatsApp should have opened.','success'); }}/>}

      <div className="max-w-6xl mx-auto px-5">
        {/* Header with cart button */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="section-label text-[#b8607a] mb-2">Products</p>
            <h1 className="font-display text-4xl md:text-5xl text-[#3d1f6e] mb-3">Beauty shop</h1>
            <p className="text-[#7a5460] text-sm max-w-xl">Premium beauty products hand-picked by the Beccastouch team. Add to cart and order via WhatsApp.</p>
          </div>
          {/* Cart button — only shown on shop page */}
          <button type="button" onClick={() => setCartOpen(true)}
            className="relative shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[#eecdd4] bg-white text-[#3d1f6e] hover:border-[#c8788a] transition-all shadow-sm mt-2">
            <ShoppingCart size={18}/>
            <span className="text-sm font-semibold hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#c8788a] text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Search + Filter icon */}
        <div className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#b08a90]"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products…"
                className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm outline-none transition-all"
                style={{background:'#ffffff',border:'1px solid rgba(61,107,223,0.18)'}}/>
            </div>
            <div className="relative">
              <button type="button" onClick={() => setFilterOpen(p=>!p)}
                className={`h-full px-4 rounded-2xl border text-sm font-semibold flex items-center gap-2 transition-all ${cat!=='All'?'bg-[#3d1f6e] text-white border-transparent':'bg-white border-[#eecdd4] text-[#3d1f6e] hover:border-[#c8788a]'}`}>
                <SlidersHorizontal size={15}/>
                <span className="hidden sm:inline">{cat !== 'All' ? cat : 'Filter'}</span>
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl border border-[#eecdd4] shadow-xl z-20 py-2 min-w-[160px]">
                  {cats.map(c => (
                    <button key={c} type="button" onClick={() => { setCat(c); setFilterOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${cat===c?'text-[#c8788a] font-semibold bg-[#fdf0f4]':'text-[#3d1f6e] hover:bg-[#fdf8f5]'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {cat !== 'All' && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-[#9a7080]">Filtered by: <span className="font-semibold text-[#3d1f6e]">{cat}</span></span>
              <button type="button" onClick={() => setCat('All')} className="text-xs text-[#c8788a] font-semibold">Clear ×</button>
            </div>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_,i) => (
              <div key={i} className="rounded-[22px] bg-white border border-[#eecdd4] overflow-hidden animate-pulse">
                <div className="aspect-square bg-[#f5e8ec]"/>
                <div className="p-3 space-y-2"><div className="h-3 bg-[#f0e0e4] rounded-full w-3/4"/><div className="h-3 bg-[#f0e0e4] rounded-full w-1/2"/></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rose-card p-12 text-center">
            <ShoppingBag size={40} className="mx-auto text-[#c8788a]/40 mb-4"/>
            <p className="font-display text-2xl text-[#3d1f6e] mb-2">
              {products.filter(p=>!p.is_archived).length === 0 ? 'Shop coming soon' : 'No products found'}
            </p>
            <p className="text-sm text-[#9a7080]">
              {products.filter(p=>!p.is_archived).length === 0 ? 'Our product catalog is being prepared. Check back soon!' : 'Try adjusting your search or filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(p => {
              const imgs = Array.isArray(p.images) && p.images.length ? p.images : p.image_url ? [p.image_url] : [];
              const inCart = cart.some(i => i.id === p.id);
              return (
                <div key={p.id} className="rounded-[22px] bg-white border border-[#eecdd4] overflow-hidden hover:shadow-lg hover:border-[#d9a0b0] transition-all flex flex-col">
                  <button type="button" onClick={() => setSelected(p)} className="flex-1 text-left">
                    <div className="relative">
                      <ImageCarousel images={imgs} name={p.name}/>
                      {!p.in_stock && (
                        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                          <span className="px-3 py-1 rounded-full bg-[#3d1f6e]/80 text-white text-[10px] font-bold uppercase tracking-wider">Out of stock</span>
                        </div>
                      )}
                      {inCart && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#3d1f6e] flex items-center justify-center shadow-sm">
                          <ShoppingCart size={11} className="text-white"/>
                        </div>
                      )}
                    </div>
                    <div className="p-3 pb-2">
                      <p className="font-semibold text-sm text-[#3d1f6e] leading-tight line-clamp-2 mb-1">{p.name}</p>
                      <p className="text-xs text-[#9a7080] mb-1">{p.category}</p>
                      {p.sale_price != null && Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price) ? (
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <p className="font-bold text-sm text-[#c8788a]">₦{Number(p.sale_price).toLocaleString()}</p>
                          <p className="text-xs text-[#9a8080] line-through">₦{Number(p.price||0).toLocaleString()}</p>
                        </div>
                      ) : (
                        <p className="font-bold text-sm text-[#c8788a]">₦{Number(p.price||0).toLocaleString()}</p>
                      )}
                    </div>
                  </button>
                  {p.in_stock && (
                    <div className="px-3 pb-3">
                      <button type="button" onClick={() => addToCart(p)}
                        className={`w-full py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${inCart?'bg-[#f0f4ff] text-[#3d1f6e] border border-[#c0c8f0]':'bg-[#3d1f6e] text-white hover:bg-[#5a3a8a]'}`}>
                        <Plus size={11}/> {inCart ? 'Add more' : 'Add to cart'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating cart button (mobile) */}
      {cartCount > 0 && (
        <button type="button" onClick={() => setCartOpen(true)}
          className="fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full bg-[#3d1f6e] text-white flex items-center justify-center shadow-lg hover:bg-[#5a3a8a] transition-all md:hidden">
          <ShoppingCart size={20}/>
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#c8788a] text-white text-[10px] font-bold flex items-center justify-center">{cartCount}</span>
        </button>
      )}
    </div>
  );
}
