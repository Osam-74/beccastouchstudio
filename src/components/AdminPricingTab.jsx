import { useEffect, useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { bookingApi } from '../utils/bookingApi';
import { useToast } from '../hooks/useToast';
import { STUDIO_PRICING, GLAM_WALKIN, GLAM_BASE_PRICING, GLAM_EXTRAS } from '../utils/siteConfig';

const PRICING_SCHEMA = [
  {
    section: '📸 Studio Sessions',
    fields: [
      { key: 'studio_single_half', label: 'Single — 30 min',  default: STUDIO_PRICING.single_half },
      { key: 'studio_single',      label: 'Single — 1 hour',  default: STUDIO_PRICING.single      },
      { key: 'studio_group',       label: 'Group — 1 hour',   default: STUDIO_PRICING.group       },
    ],
  },
  {
    section: '💄 Glam — Walk-in (General)',
    fields: [
      { key: 'glam_walkin_makeup',      label: 'Makeup only',    default: GLAM_WALKIN.makeup         },
      { key: 'glam_walkin_gele',        label: 'Gele only',      default: GLAM_WALKIN.gele           },
      { key: 'glam_walkin_makeup_gele', label: 'Makeup + Gele',  default: GLAM_WALKIN['makeup+gele'] },
    ],
  },
  {
    section: '🌸 Glam — Makeup Only',
    fields: [
      { key: 'glam_makeup_general_studio', label: 'General · Studio', default: GLAM_BASE_PRICING.makeup.general.studio },
      { key: 'glam_makeup_general_home',   label: 'General · Home',   default: GLAM_BASE_PRICING.makeup.general.home   },
      { key: 'glam_makeup_bridal_studio',  label: 'Bridal · Studio',  default: GLAM_BASE_PRICING.makeup.bridal.studio  },
      { key: 'glam_makeup_bridal_home',    label: 'Bridal · Home',    default: GLAM_BASE_PRICING.makeup.bridal.home    },
    ],
  },
  {
    section: '🎀 Glam — Gele Only',
    fields: [
      { key: 'glam_gele_general_studio', label: 'General · Studio', default: GLAM_BASE_PRICING.gele.general.studio },
      { key: 'glam_gele_general_home',   label: 'General · Home',   default: GLAM_BASE_PRICING.gele.general.home   },
      { key: 'glam_gele_bridal_studio',  label: 'Bridal · Studio',  default: GLAM_BASE_PRICING.gele.bridal.studio  },
      { key: 'glam_gele_bridal_home',    label: 'Bridal · Home',    default: GLAM_BASE_PRICING.gele.bridal.home    },
    ],
  },
  {
    section: '✨ Glam — Makeup + Gele',
    fields: [
      { key: 'glam_combo_general_studio', label: 'General · Studio', default: GLAM_BASE_PRICING['makeup+gele'].general.studio },
      { key: 'glam_combo_general_home',   label: 'General · Home',   default: GLAM_BASE_PRICING['makeup+gele'].general.home   },
      { key: 'glam_combo_bridal_studio',  label: 'Bridal · Studio',  default: GLAM_BASE_PRICING['makeup+gele'].bridal.studio  },
      { key: 'glam_combo_bridal_home',    label: 'Bridal · Home',    default: GLAM_BASE_PRICING['makeup+gele'].bridal.home    },
    ],
  },
  {
    section: '➕ Add-ons & Extras',
    fields: [
      { key: 'glam_extra_bridesmaid_makeup', label: 'Bridesmaid makeup (each)',        default: GLAM_EXTRAS.bridesmaidMakeup    },
      { key: 'glam_extra_bridesmaid_gele',   label: 'Bridesmaid gele (each)',          default: GLAM_EXTRAS.bridesmaidGele      },
      { key: 'glam_extra_day_multiplier',    label: 'Extra bridal day multiplier (0–1)', default: GLAM_EXTRAS.extraDayMultiplier },
    ],
  },
];

export default function AdminPricingTab({ pin }) {
  const [values,   setValues]   = useState({});
  const [saved,    setSaved]    = useState({});
  const [loading,  setLoading]  = useState(true);
  const [dirty,    setDirty]    = useState({});
  const [savingKey, setSavingKey] = useState('');
  const { showToast } = useToast();

  async function load() {
    try {
      setLoading(true);
      const { pricing } = await bookingApi.adminGetPricing(pin);
      const init = {};
      PRICING_SCHEMA.forEach(s => s.fields.forEach(f => {
        init[f.key] = pricing[f.key] !== undefined ? pricing[f.key] : String(f.default);
      }));
      setValues(init); setSaved({ ...init }); setDirty({});
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function change(key, val) {
    setValues(p => ({ ...p, [key]: val }));
    setDirty(p  => ({ ...p, [key]: val !== saved[key] }));
  }

  async function saveSingle(key) {
    try {
      setSavingKey(key);
      await bookingApi.adminSavePricing(pin, key, values[key]);
      setSaved(p => ({ ...p, [key]: values[key] }));
      setDirty(p  => ({ ...p, [key]: false }));
      showToast('Price saved.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSavingKey(''); }
  }

  async function saveAll() {
    const dirtyKeys = Object.keys(dirty).filter(k => dirty[k]);
    if (!dirtyKeys.length) return showToast('No unsaved changes.', 'info');
    try {
      setSavingKey('__all__');
      for (const k of dirtyKeys) await bookingApi.adminSavePricing(pin, k, values[k]);
      setSaved({ ...values }); setDirty({});
      showToast(`Saved ${dirtyKeys.length} price(s).`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSavingKey(''); }
  }

  const anyDirty = Object.values(dirty).some(Boolean);

  return (
    <div className="space-y-5 max-w-2xl">
      {/* header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-[#3d1f6e]">Booking Prices</p>
          <p className="text-xs text-[#9a7080]">All amounts in NGN. Changes take effect immediately.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="btn-outline-dark py-2 px-3">
            <RefreshCw size={13}/>
          </button>
          {anyDirty && (
            <button type="button" onClick={saveAll} disabled={savingKey === '__all__'} className="btn-rose py-2">
              <Save size={13}/> {savingKey === '__all__' ? 'Saving…' : 'Save all'}
            </button>
          )}
        </div>
      </div>

      {loading && <div className="rose-card p-5 text-sm text-[#9a7080]">Loading prices…</div>}

      {!loading && PRICING_SCHEMA.map(({ section, fields }) => (
        <div key={section} className="rose-card p-5">
          <p className="font-semibold text-[#3d1f6e] mb-4 text-sm">{section}</p>
          {/* ── always 2-column grid (col on mobile too) ── */}
          <div className="grid grid-cols-2 gap-3">
            {fields.map(({ key, label }) => {
              const isDirty  = !!dirty[key];
              const isSaving = savingKey === key;
              return (
                <div key={key}>
                  <label className="label-text mb-1 block">{label}</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number" min="0" step="1"
                      value={values[key] ?? ''}
                      onChange={e => change(key, e.target.value)}
                      className={`input-field flex-1 min-w-0 ${isDirty ? 'border-[#9b72d0]' : ''}`}
                    />
                    {isDirty && (
                      <button
                        type="button"
                        onClick={() => saveSingle(key)}
                        disabled={isSaving}
                        className="w-9 h-[42px] rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm"
                        style={{ background: 'linear-gradient(135deg,#c8788a,#9b72d0)' }}
                        title="Save this price"
                      >
                        {isSaving
                          ? <RefreshCw size={11} className="animate-spin"/>
                          : <Save size={11}/>
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {anyDirty && (
        <div className="sticky bottom-4 z-10">
          <button type="button" onClick={saveAll} disabled={savingKey === '__all__'} className="btn-rose w-full justify-center shadow-lg">
            <Save size={14}/> {savingKey === '__all__' ? 'Saving…' : `Save ${Object.values(dirty).filter(Boolean).length} unsaved change(s)`}
          </button>
        </div>
      )}
    </div>
  );
}
