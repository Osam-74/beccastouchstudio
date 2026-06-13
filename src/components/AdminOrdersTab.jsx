import { useEffect, useState } from 'react';
import { Trash2, RefreshCw, CheckCircle2, Clock, PackageSearch, X, XCircle, Truck } from 'lucide-react';
import { bookingApi } from '../utils/bookingApi';
import { useToast } from '../hooks/useToast';

const STATUS_STYLES = {
  pending:   'bg-[#fff4e0] text-[#a07428] border-[#f0d898]',
  viewed:    'bg-[#f0f4ff] text-[#3a5aaa] border-[#b8c8f0]',
  delivered: 'bg-[#f0faf3] text-[#3d7a53] border-[#b8e0c8]',
  cancelled: 'bg-[#fff0f0] text-[#a84040] border-[#f0c8c8]',
};

const FILTERS = ['all','pending','delivered','cancelled'];

function Badge({ status }) {
  return <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-[0.18em] font-semibold border ${STATUS_STYLES[status]||STATUS_STYLES.pending}`}>{status}</span>;
}

/* ── Order detail modal ── */
function OrderModal({ order, onClose, onUpdateStatus, onDelete, updating }) {
  if (!order) return null;
  let items = [];
  try { items = JSON.parse(order.items || '[]'); } catch {}
  const busy = updating === order.id;

  return (
    <>
      <button type="button" onClick={onClose} className="fixed inset-0 bg-black/30 backdrop-blur-[3px] z-50"/>
      <div className="fixed inset-x-3 top-1/2 -translate-y-1/2 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[520px] z-50 max-h-[90vh] overflow-y-auto rounded-[28px]">
        <div className="bg-white border border-[#eecdd4] shadow-xl rounded-[28px] p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <p className="font-display text-xl text-[#3d1f6e]">{order.client_name}</p>
              <p className="font-mono text-xs text-[#9a7080] mt-0.5">{order.order_id}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge status={order.status || 'pending'}/>
              <button type="button" onClick={onClose} className="w-8 h-8 rounded-full border border-[#eecdd4] bg-white flex items-center justify-center text-[#9a7080]"><X size={14}/></button>
            </div>
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div className="rounded-xl bg-[#fdf8f5] border border-[#eed4da] p-4 mb-4 space-y-2">
              <p className="text-[10px] font-bold text-[#3d1f6e] uppercase tracking-[0.18em] mb-2">Items ordered</p>
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-[#5a3a42]">{item.name} ×{item.qty}</span>
                  <span className="font-semibold text-[#3d1f6e]">₦{(item.price * item.qty).toLocaleString()}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm font-bold text-[#c8788a] pt-2 border-t border-[#eecdd4] mt-1">
                <span>Total</span><span>₦{Number(order.total_amount||0).toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Contact & delivery info */}
          <div className="grid grid-cols-2 gap-2 text-xs mb-4">
            <div className="rounded-xl bg-white border border-[#eed4da] px-3 py-2.5">
              <p className="text-[8px] uppercase tracking-[0.2em] text-[#9a7080] mb-0.5">Phone</p>
              <p className="text-[#3d1f6e] font-semibold">{order.phone}</p>
            </div>
            {order.email && (
              <div className="rounded-xl bg-white border border-[#eed4da] px-3 py-2.5">
                <p className="text-[8px] uppercase tracking-[0.2em] text-[#9a7080] mb-0.5">Email</p>
                <p className="text-[#3d1f6e] font-semibold truncate">{order.email}</p>
              </div>
            )}
            <div className="rounded-xl bg-white border border-[#eed4da] px-3 py-2.5">
              <p className="text-[8px] uppercase tracking-[0.2em] text-[#9a7080] mb-0.5">Delivery</p>
              <p className="text-[#3d1f6e] font-semibold">{order.delivery_type === 'home' ? 'Home delivery' : 'Self pickup'}</p>
            </div>
            <div className="rounded-xl bg-white border border-[#eed4da] px-3 py-2.5">
              <p className="text-[8px] uppercase tracking-[0.2em] text-[#9a7080] mb-0.5">Date</p>
              <p className="text-[#3d1f6e] font-semibold">{order.created_date ? new Date(order.created_date).toLocaleDateString() : '—'}</p>
            </div>
            {order.notes && (
              <div className="col-span-2 rounded-xl bg-[#fffbf0] border border-[#f0e4b8] px-3 py-2.5">
                <p className="text-[8px] uppercase tracking-[0.2em] text-[#a07428] mb-0.5">Notes</p>
                <p className="text-[#6a5020] text-xs">{order.notes}</p>
              </div>
            )}
          </div>

          {order.status === 'delivered' ? (
            <div className="rounded-xl bg-[#f0faf3] border border-[#b8e0c8] px-4 py-3 text-center">
              <p className="text-xs font-semibold text-[#3d7a53]">✅ Delivered — thank-you email sent to client</p>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => onUpdateStatus(order.id, 'delivered')} disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-[#f0faf3] border border-[#b8e0c8] text-[#3d7a53] text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Truck size={11}/> Delivered
              </button>
              {order.status !== 'cancelled' && (
                <button type="button" onClick={() => onUpdateStatus(order.id, 'cancelled')} disabled={busy}
                  className="flex-1 py-2.5 rounded-xl bg-[#fff0f0] border border-[#f0c8c8] text-[#a84040] text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                  <XCircle size={11}/> Cancel order
                </button>
              )}
              {order.status !== 'pending' && (
                <button type="button" onClick={() => onUpdateStatus(order.id, 'pending')} disabled={busy}
                  className="py-2.5 px-3 rounded-xl border border-[#eecdd4] text-[#7a5460] text-xs font-semibold disabled:opacity-50">
                  Pending
                </button>
              )}
              <button type="button" onClick={() => onDelete(order.id)} disabled={busy}
                className="w-10 py-2.5 rounded-xl border border-[#f0c8c8] bg-white text-[#b05860] flex items-center justify-center disabled:opacity-50">
                <Trash2 size={12}/>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminOrdersTab({ pin }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updating, setUpdating] = useState('');
  const { showToast } = useToast();

  async function load() {
    try {
      setLoading(true);
      const { orders: list } = await bookingApi.adminGetShopOrders(pin);
      // Auto-mark new orders as viewed when admin loads them
      setOrders(list || []);
    } catch(e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function updateStatus(docId, status) {
    try {
      setUpdating(docId);
      await bookingApi.adminUpdateShopOrder(pin, docId, status, '');
      setOrders(prev => prev.map(o => o.id === docId ? { ...o, status } : o));
      if (selectedOrder?.id === docId) setSelectedOrder(p => ({ ...p, status }));
      showToast(`Order marked as ${status}.`, 'success');
    } catch(e) { showToast(e.message, 'error'); }
    finally { setUpdating(''); }
  }

  async function del(docId) {
    if (!window.confirm('Delete this order permanently?')) return;
    try {
      await bookingApi.adminDeleteShopOrder(pin, docId);
      setOrders(prev => prev.filter(o => o.id !== docId));
      if (selectedOrder?.id === docId) setSelectedOrder(null);
      showToast('Order deleted.', 'success');
    } catch(e) { showToast(e.message, 'error'); }
  }

  const visible = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  return (
    <div className="space-y-5 max-w-2xl">
      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={updateStatus}
          onDelete={del}
          updating={updating}
        />
      )}

      {/* header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-[#1c1214]">Shop Orders</p>
          <p className="text-xs text-[#9a7080]">
            {orders.length} total
            {pendingCount > 0 && <span className="ml-2 inline-flex items-center gap-1 text-[#a07428] font-semibold"><Clock size={10}/> {pendingCount} pending</span>}
          </p>
        </div>
        <button type="button" onClick={load} className="w-9 h-9 rounded-full border border-[#eecdd4] bg-white flex items-center justify-center shadow-sm">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} style={{animationDuration:'1.5s'}}/>
        </button>
      </div>

      {/* filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize ${filter===f?'bg-[#3d1f6e] text-white border-transparent':'bg-white border-[#eecdd4] text-[#7a5460]'}`}>
            {f === 'all' ? `All (${orders.length})` : `${f} (${orders.filter(o=>o.status===f).length})`}
          </button>
        ))}
      </div>

      {loading && <div className="rose-card p-5 text-sm text-[#9a7080]">Loading orders…</div>}

      {!loading && visible.length === 0 && (
        <div className="rose-card p-10 text-center">
          <PackageSearch size={32} className="mx-auto text-[#e8c4cc] mb-3"/>
          <p className="text-sm text-[#9a7080]">No {filter !== 'all' ? filter : ''} orders yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {visible.map(order => (
          <button key={order.id} type="button"
            onClick={() => setSelectedOrder(order)}
            className="w-full text-left rose-card p-4 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[#1c1214] text-sm truncate">{order.client_name}</p>
                  <Badge status={order.status || 'pending'}/>
                </div>
                <p className="font-mono text-[10px] text-[#9a7080] mt-0.5">{order.order_id}</p>
                <p className="text-xs text-[#7a5460] mt-1">
                  {order.delivery_type === 'home' ? '🚚 Home delivery' : '🏪 Pickup'} · ₦{Number(order.total_amount||0).toLocaleString()}
                </p>
              </div>
              <p className="text-[10px] text-[#c8b0b8] shrink-0 mt-0.5">
                {order.created_date ? new Date(order.created_date).toLocaleDateString() : ''}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
