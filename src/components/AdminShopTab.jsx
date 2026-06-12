import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, X, Package, Tag, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, ImagePlus, Link } from 'lucide-react';
import { bookingApi } from '../utils/bookingApi';
import { uploadToStorage } from '../lib/firebase';
import { useToast } from '../hooks/useToast';
import { SITE } from '../utils/siteConfig';

const CATS = ['Makeup', 'Skincare', 'Hair', 'Tools & Accessories', 'Bundles', 'Other'];

const EMPTY = { name:'', description:'', price:'', sale_price:'', category:'Makeup', in_stock:true, image_url:'', images:[], whatsapp_order:true, is_archived:false };

export default function AdminShopTab({ pin }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [imgPreviews, setImgPreviews] = useState([]); // array of data urls or external URLs
  const [urlInput, setUrlInput] = useState('');           // current URL being typed
  const fileRef = useRef(null);
  // track total size of uploaded file-based images (base64 bytes)
  const { showToast } = useToast();

  async function load() {
    try { setLoading(true); const { products: list } = await bookingApi.adminGetProducts(pin); setProducts(list || []); }
    catch(e) { showToast(e.message,'error'); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function startNew() { setForm({...EMPTY, images:[]}); setImgPreviews([]); setUrlInput(''); setEditing('new'); }
  function startEdit(p) {
    const imgs = Array.isArray(p.images) && p.images.length > 0 ? p.images : p.image_url ? [p.image_url] : [];
    setForm({ id: p.id, name: p.name||'', description: p.description||'', price: String(p.price||''), sale_price: p.sale_price != null ? String(p.sale_price) : '', category: p.category||'Makeup', in_stock: p.in_stock!==false, image_url: p.image_url||'', images: imgs, whatsapp_order: p.whatsapp_order!==false, is_archived: !!p.is_archived });
    setImgPreviews(imgs);
    setEditing(p);
    setUrlInput('');
    // recalculate bytes for existing uploads
    
  }
  function cancel() { setEditing(null); setImgPreviews([]); setUrlInput(''); }

  const set = (k,v) => setForm(p => ({...p,[k]:v}));

  async function handleImages(files) {
    if (!files || files.length === 0) return;
    if (imgPreviews.length >= 10) return showToast('Maximum 10 images per product.', 'error');
    const toProcess = Array.from(files).slice(0, 10 - imgPreviews.length);
    const results = [];
    showToast(`Uploading ${toProcess.length} image${toProcess.length!==1?'s':''}…`, 'info');
    for (const file of toProcess) {
      if (file.size > 20 * 1024 * 1024) { showToast(`${file.name} is too large (max 20 MB).`, 'error'); continue; }
      try {
        const url = await uploadToStorage(file, 'products');
        results.push(url);
      } catch(e) { showToast(`Failed to upload ${file.name}: ${e.message}`, 'error'); }
    }
    if (results.length === 0) return;
    const newPreviews = [...imgPreviews, ...results];
    setImgPreviews(newPreviews);
    set('images', newPreviews);
    set('image_url', newPreviews[0] || '');
    showToast(`${results.length} image${results.length!==1?'s':''} uploaded successfully.`, 'success');
  }

  function addImageUrl() {
    const url = urlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) return showToast('Please enter a full URL starting with http:// or https://', 'error');
    if (imgPreviews.length >= 10) return showToast('Maximum 10 images per product.', 'error');
    if (imgPreviews.includes(url)) return showToast('This URL is already added.', 'error');
    const newPreviews = [...imgPreviews, url];
    setImgPreviews(newPreviews);
    set('images', newPreviews);
    set('image_url', newPreviews[0] || '');
    setUrlInput('');
    showToast('Image link added.', 'success');
  }

  function removeImage(idx) {
    const removed = imgPreviews[idx];
    const newPreviews = imgPreviews.filter((_, i) => i !== idx);
    setImgPreviews(newPreviews);
    set('images', newPreviews);
    set('image_url', newPreviews[0] || '');
  }

  async function save() {
    if (!form.name.trim()) return showToast('Product name is required.','error');
    try {
      setSaving(true);
      const { product } = await bookingApi.adminSaveProduct(pin, {
        ...form,
        price: parseFloat(form.price)||0,
        images: imgPreviews,
        image_url: imgPreviews[0] || form.image_url || '',
      });
      setProducts(prev => form.id ? prev.map(p => p.id===product.id ? product : p) : [product, ...prev]);
      showToast(form.id ? 'Product updated.' : 'Product added.','success');
      cancel();
    } catch(e) { showToast(e.message,'error'); } finally { setSaving(false); }
  }

  async function toggleArchive(p) {
    try {
      const { product } = await bookingApi.adminSaveProduct(pin, { ...p, is_archived: !p.is_archived });
      setProducts(prev => prev.map(x => x.id===product.id ? product : x));
      showToast(product.is_archived ? 'Product hidden from shop.' : 'Product restored.','success');
    } catch(e) { showToast(e.message,'error'); }
  }

  async function del(p) {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await bookingApi.adminDeleteProduct(pin, p.id);
      setProducts(prev => prev.filter(x => x.id !== p.id));
      showToast('Deleted.','success');
    } catch(e) { showToast(e.message,'error'); }
  }

  const visible = products.filter(p => showArchived ? true : !p.is_archived);

  return (
    <div className="space-y-5 max-w-2xl">
      {/* header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-[#1c1214]">Shop Products</p>
          <p className="text-xs text-[#9a7080] mt-0.5">{products.filter(p=>!p.is_archived).length} active · {products.filter(p=>p.is_archived).length} hidden</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowArchived(v => !v)} className="btn-outline-dark text-xs">
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
          <button type="button" onClick={startNew} className="btn-rose text-sm">
            <Plus size={14}/> New product
          </button>
        </div>
      </div>

      {/* form modal */}
      {editing && (
        <>
          <button type="button" onClick={cancel} className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50"/>
          <div className="fixed inset-x-3 top-1/2 -translate-y-1/2 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[600px] z-50 max-h-[90vh] overflow-y-auto rounded-[28px]">
          <div className="bg-white border border-[#eecdd4] shadow-xl rounded-[28px] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-[#3d1f6e]">{editing==='new'?'New product':'Edit product'}</p>
            <button type="button" onClick={cancel} className="text-[#9a7080]"><X size={16}/></button>
          </div>

          {/* Multi-image upload + URL links */}
          <div>
            <label className="label-text mb-2 block">Product images — up to 10, total 20 MB</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {imgPreviews.map((src, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-[12px] overflow-hidden border border-[#eecdd4]">
                  <img src={src} alt="" className="w-full h-full object-cover" onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}}/>
                  <div style={{display:'none'}} className="w-full h-full bg-[#f0e8f4] flex items-center justify-center text-[8px] text-[#9a7080] text-center p-1 leading-tight">
                    <Link size={12} className="text-[#c8788a] mr-0.5"/>URL
                  </div>
                  <button type="button" onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 flex items-center justify-center shadow text-[#b05860]">
                    <X size={10}/>
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 text-[8px] bg-[#c8788a] text-white rounded-full px-1.5 py-0.5 font-bold">Main</span>
                  )}
                </div>
              ))}
              {imgPreviews.length < 10 && (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-[12px] border-2 border-dashed border-[#eecdd4] bg-[#fdf8f5] flex flex-col items-center justify-center text-[#9a7080] hover:border-[#c8788a] hover:bg-[#fdf0f2] transition-all">
                  <ImagePlus size={18} className="mb-1 text-[#c8788a]"/>
                  <span className="text-[9px]">Upload</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { handleImages(e.target.files); e.target.value = ''; }}/>
            {/* Image URL input */}
            <div className="flex gap-2 mt-2">
              <input
                value={urlInput} onChange={e=>setUrlInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addImageUrl())}
                className="input-field text-xs flex-1" placeholder="Or paste an image URL (https://…)"
              />
              <button type="button" onClick={addImageUrl} disabled={!urlInput.trim()}
                className="btn-rose text-xs px-3 flex items-center gap-1">
                <Plus size={12}/> Add
              </button>
            </div>
            <p className="text-[10px] text-[#9a7080] mt-1">Upload files or paste external links. First image = main photo. Total uploaded files: max 20 MB.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label-text">Product name *</label><input value={form.name} onChange={e=>set('name',e.target.value)} className="input-field" placeholder="e.g. Foundation Stick"/></div>
            <div>
              <label className="label-text">Original price (NGN) *</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={e=>set('price',e.target.value)} className="input-field" placeholder="0.00"/>
            </div>
            <div>
              <label className="label-text">Sale price (NGN) — optional</label>
              <input type="number" min="0" step="0.01" value={form.sale_price} onChange={e=>set('sale_price',e.target.value)} className="input-field" placeholder="Leave blank if no discount"/>
              {form.sale_price && Number(form.sale_price) >= Number(form.price) && (
                <p className="text-[10px] text-[#b05860] mt-1">⚠ Sale price must be lower than original price.</p>
              )}
            </div>
            <div><label className="label-text">Category</label>
              <select value={form.category} onChange={e=>set('category',e.target.value)} className="input-field">
                {CATS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="label-text">Description</label><textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={2} className="input-field resize-none" placeholder="Short product description"/></div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <button type="button" onClick={()=>set('in_stock',!form.in_stock)} className={`w-10 h-6 rounded-full transition-all ${form.in_stock?'bg-[#3d7a53]':'bg-[#ddd]'} relative`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.in_stock?'right-0.5':'left-0.5'}`}/>
              </button>
              <span className="text-sm text-[#5a3a42]">In stock</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <button type="button" onClick={()=>set('whatsapp_order',!form.whatsapp_order)} className={`w-10 h-6 rounded-full transition-all ${form.whatsapp_order?'bg-[#25d366]':'bg-[#ddd]'} relative`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.whatsapp_order?'right-0.5':'left-0.5'}`}/>
              </button>
              <span className="text-sm text-[#5a3a42]">Order via WhatsApp</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={cancel} className="btn-outline-dark">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="btn-rose">{saving?'Saving…':'Save product'}</button>
          </div>
        </div>
        </div>
        </>
      )}

      {/* product list */}
      {loading && <div className="rose-card p-5 text-sm text-[#9a7080]">Loading products…</div>}
      {!loading && visible.length === 0 && (
        <div className="rose-card p-8 text-center">
          <Package size={32} className="text-[#d9a0b0] mx-auto mb-3"/>
          <p className="font-semibold text-[#1c1214] mb-1">No products yet</p>
          <p className="text-sm text-[#9a7080]">Add your first product to get started.</p>
        </div>
      )}

      <div className="space-y-2.5">
        {visible.map(p => {
          const imgs = Array.isArray(p.images) && p.images.length > 0 ? p.images : p.image_url ? [p.image_url] : [];
          return (
            <div key={p.id} className={`glass-card p-4 flex gap-3 items-start ${p.is_archived?'opacity-50':''}`}>
              {imgs.length > 0 ? (
                <img src={imgs[0]} alt={p.name} className="w-14 h-14 rounded-[12px] object-cover shrink-0 border border-[#eecdd4]"/>
              ) : (
                <div className="w-14 h-14 rounded-[12px] bg-[#fdf0f2] border border-[#eecdd4] flex items-center justify-center shrink-0"><Package size={20} className="text-[#d9a0b0]"/></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-[#1c1214]">{p.name}</p>
                    <p className="text-[10px] text-[#9a7080] uppercase tracking-wider">{p.category}</p>
                  </div>
                  {p.sale_price != null && Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price) ? (
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm text-[#c8788a]">{SITE.currency} {Number(p.sale_price).toLocaleString()}</p>
                      <p className="text-xs text-[#9a8080] line-through">{SITE.currency} {Number(p.price||0).toLocaleString()}</p>
                    </div>
                  ) : (
                    <p className="font-bold text-sm text-[#c8788a] shrink-0">{SITE.currency} {Number(p.price||0).toLocaleString()}</p>
                  )}
                </div>
                {p.description && <p className="text-xs text-[#7a5460] mt-1 line-clamp-2">{p.description}</p>}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${p.in_stock?'bg-[#f0faf3] text-[#3d7a53]':'bg-[#f4f1ef] text-[#9a8880]'}`}>{p.in_stock?'In stock':'Out of stock'}</span>
                  {p.whatsapp_order && <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[#e8f8ee] text-[#25d366]">WhatsApp</span>}
                  {imgs.length > 1 && <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[#f0f0ff] text-[#6060c0]">{imgs.length} photos</span>}
                  {p.is_archived && <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[#f4f1ef] text-[#9a8880]">Hidden</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button type="button" onClick={()=>startEdit(p)} className="w-8 h-8 rounded-full border border-[#eecdd4] bg-white flex items-center justify-center text-[#7a5460] hover:bg-[#fce4ea] transition-all"><Pencil size={12}/></button>
                <button type="button" onClick={()=>toggleArchive(p)} className="w-8 h-8 rounded-full border border-[#eecdd4] bg-white flex items-center justify-center text-[#7a5460] hover:bg-[#fce4ea] transition-all" title={p.is_archived?'Restore':'Hide'}>{p.is_archived?<ToggleLeft size={12}/>:<ToggleRight size={12}/>}</button>
                <button type="button" onClick={()=>del(p)} className="w-8 h-8 rounded-full border border-[#f0c8c8] bg-white flex items-center justify-center text-[#b05860] hover:bg-[#fff0f0] transition-all"><Trash2 size={12}/></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
