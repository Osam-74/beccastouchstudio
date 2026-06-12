import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toPng } from 'html-to-image';
import { ArrowLeft, ArrowRight, Camera, Copy, RotateCcw, Send, Video , X } from 'lucide-react';
import CalendarPicker from '../components/CalendarPicker';
import ThankYouModal from '../components/ThankYouModal';
import { bookingApi } from '../utils/bookingApi';
import { SITE, STUDIO_HOURS, STUDIO_PRICING, BOOKING_RULES } from '../utils/siteConfig';
import { useToast } from '../hooks/useToast';
import { uploadReceiptFile } from '../utils/fileHelpers';

const STEPS = ['Session', 'Your info', 'Payment'];

// ── Clock-style time picker ───────────────────────────────────────────────────
const TIME_SLOTS_STUDIO = (() => {
  const slots = [];
  for (let h = 7; h <= 20; h++) {
    slots.push(`${String(h).padStart(2,'0')}:00`);
    if (h < 20) slots.push(`${String(h).padStart(2,'0')}:30`);
  }
  return slots;
})();

function TimePicker({ value, onChange, label = 'Preferred start time' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function outside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);
  function fmt(v) {
    if (!v) return 'Select time';
    const [h, m] = v.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
  }
  return (
    <div ref={ref} className="relative">
      <label className="label-text">{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="input-field text-left flex items-center justify-between mt-1">
        <span className={value ? 'text-[#3d1f6e] font-medium' : 'text-[#b08090]'}>{fmt(value)}</span>
        <span className="text-[#c8788a] text-xs">🕐</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-2xl border border-[rgba(61,31,110,0.15)] bg-white shadow-xl">
          <div className="grid grid-cols-3 gap-1 p-2">
            {TIME_SLOTS_STUDIO.map(t => (
              <button key={t} type="button"
                onClick={() => { onChange(t); setOpen(false); }}
                className={`rounded-xl py-2 text-xs font-semibold transition-all
                  ${value === t ? 'bg-[#3d1f6e] text-white' : 'bg-[#fdf4f8] text-[#3d1f6e] hover:bg-[#f0e4ee]'}`}>
                {fmt(t)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


function StepBar({ current }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-0">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-[0.18em] transition-all
            ${i===current?'bg-[#3d1f6e] text-white shadow-md':i<current?'bg-[#e8c4cc] text-[#8c3a50]':'bg-white border border-[#eecdd4] text-[#b08a90]'}`}>
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold">{i<current?'✓':i+1}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
          {i<STEPS.length-1&&<div className={`w-6 h-px mx-1 ${i<current?'bg-[#d9a0b0]':'bg-[#eecdd4]'}`}/>}
        </div>
      ))}
    </div>
  );
}

function SessionIdBadge({ bookingId, onCopy }) {
  if (!bookingId) return null;
  return (
    <div className="rose-card px-4 py-3 flex items-center justify-between gap-3 mb-5">
      <div>
        <p className="label-text">Your Booking ID</p>
        <p className="font-mono text-sm font-semibold text-[#3d1f6e]">{bookingId}</p>
        <p className="text-[10px] text-[#9a7080] mt-0.5">Use this as your payment transfer description.</p>
      </div>
      <button type="button" onClick={onCopy} className="btn-outline-dark px-3 py-2 text-xs"><Copy size={13}/> Copy</button>
    </div>
  );
}




function StudioResumeBanner() {
  const [open, setOpen] = React.useState(false);
  const [val, setVal] = React.useState('');
  const navigate = useNavigate();
  function goResume() {
    const id = val.trim().toUpperCase();
    if (!id) return;
    navigate('/track?id=' + encodeURIComponent(id));
  }
  return (
    <div className="rose-card px-5 py-4 mb-6">
      {!open ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔖</span>
            <div>
              <p className="font-semibold text-[#3d1f6e] text-sm">Already started a booking?</p>
              <p className="text-xs text-[#9a7080] mt-0.5">Resume from where you left off.</p>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(true)}
            className="btn-outline-dark text-xs shrink-0 px-4 py-2 flex items-center gap-1.5">
            <RotateCcw size={12}/> Resume
          </button>
        </div>
      ) : (
        <div>
          <p className="font-semibold text-[#3d1f6e] text-sm mb-2">Enter your Booking ID</p>
          <div className="flex gap-2">
            <input type="text" value={val} onChange={e => setVal(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && goResume()}
              placeholder="e.g. STU-20260612-ABC"
              className="flex-1 rounded-xl border border-[#e0c8d8] px-3 py-2 text-sm text-[#3d1f6e] font-mono outline-none focus:border-[#c8788a] bg-white"
              autoFocus
            />
            <button type="button" onClick={goResume}
              className="btn-rose text-xs px-4 py-2 flex items-center gap-1.5 shrink-0">
              Go →
            </button>
            <button type="button" onClick={() => { setOpen(false); setVal(''); }}
              className="w-9 h-9 rounded-xl border border-[#eecdd4] bg-white flex items-center justify-center text-[#9a7080] shrink-0">
              <X size={13}/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookStudio() {
  const [sp] = useSearchParams();
  const resumeId = sp.get('resume');
  const isReschedule = sp.get('mode') === 'reschedule';
  const { showToast } = useToast();
  const ticketRef = useRef(null);

  const [step, setStep] = useState(0);
  // Scroll to top of page whenever step changes
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);
  const [loadingResume, setLoadingResume] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [bookingId, setBookingId] = useState(() => {
    // Recover in-progress booking ID from storage (handles page refresh mid-booking)
    return '';
  });
  const [rescheduleCount, setRescheduleCount] = useState(0);
  const [submitted, setSubmitted] = useState(null);
  const [form, setForm] = useState({
    studioUse: 'photoshoot',   // 'photoshoot' | 'content'
    sessionType: 'single',     // 'single' | 'group'
    durationHours: 1,          // 0.5 | 1
    groupSize: '',
    startTime: '10:00',
    clientName:'', phone:'', email:'', notes:'',
    paymentReference:'', paymentReceiptName:'', paymentReceiptDataUrl:'',
  });
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    if(!resumeId)return;
    (async()=>{
      try{
        setLoadingResume(true);
        const{booking:b}=await bookingApi.getBooking(resumeId);
        if(b.bookingType!=='studio')throw new Error('ID belongs to a different booking type.');
        if(isReschedule&&Number(b.rescheduleCount||0)>=1)throw new Error('Already used one reschedule.');
        setBookingId(b.bookingId);setRescheduleCount(Number(b.rescheduleCount||0));
        setSelectedDate(b.preferredDate?new Date(`${b.preferredDate}T00:00:00`):null);
        setForm({studioUse:b.studioUse||'photoshoot',sessionType:b.sessionType||'single',durationHours:b.durationHours||1,groupSize:b.sessionType==='group'?(b.groupSize||''):'',startTime:b.startTime||'10:00',clientName:b.clientName||'',phone:b.phone||'',email:b.email||'',notes:b.notes||'',paymentReference:b.paymentReference||'',paymentReceiptName:b.paymentReceiptName||'',paymentReceiptDataUrl:b.paymentReceiptUrl||''});
        setStep(1);showToast(`Loaded: ${b.bookingId}`,'success');
      }catch(e){showToast(e.message,'error');}finally{setLoadingResume(false);}
    })();
  },[resumeId]);

  const total = useMemo(()=>{
    if(form.studioUse==='content'&&form.durationHours===2) return 25000;
    if(form.sessionType==='group') return form.durationHours===0.5?STUDIO_PRICING.single_half:STUDIO_PRICING.group;
    return form.durationHours===0.5?STUDIO_PRICING.single_half:STUDIO_PRICING.single;
  },[form.sessionType,form.durationHours]);

  async function draft(partial=false){
    const d=await bookingApi.saveDraft({booking_type:'studio',booking_id:bookingId||undefined,studio_use:form.studioUse,session_type:form.sessionType,group_size:form.sessionType==='group'&&form.groupSize?Number(form.groupSize):undefined,preferred_date:selectedDate?format(selectedDate,'yyyy-MM-dd'):'',start_time:form.startTime,duration_hours:Number(form.durationHours),client_name:form.clientName,phone:form.phone,email:form.email,notes:form.notes,payment_reference:form.paymentReference,payment_receipt_name:form.paymentReceiptName,payment_receipt_data_url:form.paymentReceiptDataUrl,total_amount:total,currency:SITE.currency,reschedule_count:rescheduleCount,booking_status:partial?'draft':undefined});
    setBookingId(d.bookingId);return d;
  }

  async function nextStep0(){
    if(!selectedDate)return showToast('Choose a date first.','error');
    setSaving(true);
    try{
      const d=await draft(true);
      setBookingId(d.bookingId);
      localStorage.setItem('beccastouch_last_studio_id', d.bookingId);
      setStep(1);
      showToast(`Booking ID: ${d.bookingId}`,'success');
    }catch(e){
      showToast(e.message,'error');
      setSaving(false); // always unfreeze on error
    }finally{
      setSaving(false);
    }
  }
  async function nextStep1(){
    if(!form.clientName||!form.phone||!form.email)return showToast('Fill in name, phone and email.','error');
    try{setSaving(true);await draft(true);setForm(prev=>({...prev,paymentReference:prev.paymentReference||bookingId}));setStep(2);}
    catch(e){showToast(e.message,'error');}finally{setSaving(false);}
  }
  async function submit(){
    if(!selectedDate)return showToast('Choose a date.','error');
    if(!form.clientName||!form.phone||!form.email)return showToast('Fill in your details first.','error');
    if(!form.paymentReference)return showToast('Add payment reference.','error');
    if(!form.paymentReceiptDataUrl)return showToast('Attach payment receipt.','error');
    if(isReschedule&&rescheduleCount>=1)return showToast('Already rescheduled once.','error');
    try{
      setSubmitting(true);
      const d=await bookingApi.submitBooking({booking_type:'studio',booking_id:bookingId||undefined,studio_use:form.studioUse,session_type:form.sessionType,group_size:form.sessionType==='group'&&form.groupSize?Number(form.groupSize):undefined,preferred_date:format(selectedDate,'yyyy-MM-dd'),start_time:form.startTime,duration_hours:Number(form.durationHours),client_name:form.clientName,phone:form.phone,email:form.email,notes:form.notes,payment_reference:form.paymentReference,payment_receipt_name:form.paymentReceiptName,payment_receipt_data_url:form.paymentReceiptDataUrl,total_amount:total,currency:SITE.currency,reschedule_count:isReschedule?rescheduleCount+1:rescheduleCount,booking_status:'pending'});
      setBookingId(d.bookingId);setSubmitted(d.booking);showToast(isReschedule?'Rescheduled!':'Submitted!','success');
    }catch(e){showToast(e.message,'error');}finally{setSubmitting(false);}
  }

  function copyId(){if(!bookingId)return;navigator.clipboard.writeText(bookingId);showToast('Copied!','success');}
  async function handleReceipt(file){
    if(!file)return;
    try{const{dataUrl,name}=await uploadReceiptFile(file);set('paymentReceiptDataUrl',dataUrl);set('paymentReceiptName',name);showToast('Receipt attached.','success');}
    catch(e){showToast(e.message,'error');}
  }

  return (
    <div className="min-h-screen bg-silk pt-24 pb-28 md:pb-10">
      <div className="max-w-3xl mx-auto px-5">
        <div className="mb-7">
          <p className="section-label text-[#b8607a] mb-2">Photography & Content</p>
          <h1 className="font-display text-[22px] md:text-[32px] text-[#3d1f6e] mb-2">Book the studio</h1>
          <p className="text-[#7a5460] text-sm">Step-by-step booking. Your booking ID appears right away — use it as your payment reference.</p>
        </div>
        <StepBar current={submitted?STEPS.length:step}/>
        <SessionIdBadge bookingId={bookingId} onCopy={copyId}/>
        {/* ── Resume booking banner — step 0 only ─────── */}
        {step === 0 && !resumeId && <StudioResumeBanner />}
        {loadingResume&&<div className="rose-card p-5 mb-5 text-sm text-[#7a5460]">Loading saved booking…</div>}

        {!submitted&&step===0&&(
          <div className="rose-card p-6 space-y-6">
            {/* Studio use */}
            <div>
              <p className="label-text mb-3">What are you coming in for?</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {k:'photoshoot',Icon:Camera,t:'Photoshoot',d:'Portraits, branding, headshots, family shoots.'},
                  {k:'content',Icon:Video,t:'Content Creation',d:'Reels, TikTok, YouTube, product videos.'},
                ].map(({k,Icon,t,d})=>(
                  <button key={k} type="button" onClick={()=>{ set('studioUse',k); if(k==='content'&&form.durationHours===0.5) set('durationHours',1); }}
                    className={`rounded-2xl border p-4 text-left transition-all ${form.studioUse===k?'border-[#c8788a] bg-[linear-gradient(135deg,#fce4ea,#f8d8e2)] shadow-sm':'border-[#eecdd4] bg-white hover:border-[#d9a0b0]'}`}>
                    <Icon size={18} className={form.studioUse===k?'text-[#c8788a]':'text-[#9a7080]'}/>
                    <p className="font-semibold text-sm text-[#3d1f6e] mt-2">{t}</p>
                    <p className="text-xs text-[#9a7080] mt-0.5">{d}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Session type */}
            <div>
              <p className="label-text mb-3">Session type</p>
              <div className="grid grid-cols-2 gap-3">
                {(form.studioUse==='photoshoot'
                  ?[{k:'single',t:'Single / Solo'},{k:'group',t:'Group / Family'}]
                  :[{k:'single',t:'Single / Solo'},{k:'group',t:'Group'}]
                ).map(({k,t})=>(
                  <button key={k} type="button" onClick={()=>{set('sessionType',k);if(k==='group')set('durationHours',1);}}
                    className={`rounded-2xl border p-4 text-left transition-all ${form.sessionType===k?'border-[#c8788a] bg-[linear-gradient(135deg,#fce4ea,#f8d8e2)] shadow-sm':'border-[#eecdd4] bg-white hover:border-[#d9a0b0]'}`}>
                    <p className="font-semibold text-sm text-[#3d1f6e]">{t}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration — 30min removed for content creation */}
            <div>
              <p className="label-text mb-3">Duration</p>
              <div className={`grid gap-3 ${form.studioUse==='content' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {(form.sessionType==='single'
                  ? (form.studioUse==='content'
                      ? [{v:1,lbl:'1 hour',p:STUDIO_PRICING.single},{v:2,lbl:'2 hours',p:25000}]
                      : [{v:0.5,lbl:'30 min',p:STUDIO_PRICING.single_half},{v:1,lbl:'1 hour',p:STUDIO_PRICING.single}])
                  : form.sessionType==='group'
                    ? (form.studioUse==='content'
                        ? [{v:1,lbl:'1 hour',p:STUDIO_PRICING.group},{v:2,lbl:'2 hours',p:25000}]
                        : [{v:0.5,lbl:'30 min',p:STUDIO_PRICING.single_half},{v:1,lbl:'1 hour',p:STUDIO_PRICING.group}])
                    : []
                ).map(({v,lbl,p})=>(
                  <button key={v} type="button" onClick={()=>set('durationHours',v)}
                    className={`rounded-2xl border p-3 text-center transition-all ${form.durationHours===v?'border-[#c8788a] bg-[linear-gradient(135deg,#fce4ea,#f8d8e2)] shadow-sm':'border-[#eecdd4] bg-white hover:border-[#d9a0b0]'}`}>
                    <p className="font-semibold text-sm text-[#3d1f6e]">{lbl}</p>
                    {p&&<p className="text-[10px] text-[#9a7080] mt-0.5">{SITE.currency} {p.toLocaleString()}</p>}
                  </button>
                ))}
              </div>
              
            </div>
            {form.sessionType==='group'&&(
              <div><label className="label-text">Group size (optional)</label><input value={form.groupSize} onChange={e=>set('groupSize',e.target.value)} type="number" min="2" max="50" className="input-field" placeholder="e.g. 4"/></div>
            )}

            {/* Date — comes first */}
            <div>
              <p className="label-text mb-3">Pick a date</p>
              <CalendarPicker selected={selectedDate} onChange={setSelectedDate}/>
              {selectedDate && (
                <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-[#f0faf3] border border-[#b8e0c8] px-4 py-2.5">
                  <span className="text-lg leading-none">✅</span>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#4a8a60] font-semibold">Date selected</p>
                    <p className="text-sm font-bold text-[#2a5a40]">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Start time */}
            <TimePicker value={form.startTime} onChange={v=>set('startTime',v)}/>

            {selectedDate&&(
              <div className="rounded-2xl bg-[linear-gradient(135deg,#fce4ea,#f8d8e2)] border border-[#e8c4cc] p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#9a7080] uppercase tracking-[0.18em] font-semibold">Total</p>
                  <p className="font-display text-2xl text-[#3d1f6e]">{`${SITE.currency} ${total.toLocaleString()}`}</p>
                </div>
                <div className="text-right text-xs text-[#7a5460]">
                  <p>{format(selectedDate,'dd MMM yyyy')}</p>
                  <p>{form.startTime} · {form.sessionType==='group'&&form.durationHours===0.5?'30min group':form.sessionType==='group'&&form.durationHours===2?'2hr group':form.sessionType==='group'?'1hr group':form.durationHours===0.5?'30min':form.durationHours===2?'2hr':'1hr'}</p>
                </div>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button type="button" onClick={nextStep0} disabled={saving||!selectedDate} className="btn-ink">{saving?'Saving…':'Next'} <ArrowRight size={14}/></button>
            </div>
          </div>
        )}

        {!submitted&&step===1&&(
          <div className="rose-card p-6 space-y-4">
            <p className="font-semibold text-[#3d1f6e]">Your details</p>
            <div><label className="label-text">Full name *</label><input value={form.clientName} onChange={e=>set('clientName',e.target.value)} className="input-field" placeholder="Your full name"/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-text">Phone *</label><input value={form.phone} onChange={e=>set('phone',e.target.value)} className="input-field" placeholder="08000000000"/></div>
              <div><label className="label-text">Email *</label><input type="email" value={form.email} onChange={e=>set('email',e.target.value)} className="input-field" placeholder="you@email.com"/></div>
            </div>
            <div><label className="label-text">Notes (optional)</label><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2} className="input-field resize-none" placeholder="Anything specific you'd like us to know"/></div>
            <div className="flex justify-between pt-2">
              <button type="button" onClick={()=>setStep(0)} className="btn-outline-dark"><ArrowLeft size={14}/> Back</button>
              <button type="button" onClick={nextStep1} disabled={saving} className="btn-ink">{saving?'Saving…':'Next'} <ArrowRight size={14}/></button>
            </div>
          </div>
        )}

        {!submitted&&step===2&&(
          <div className="rose-card p-6 space-y-4">
            <p className="font-semibold text-[#3d1f6e]">Payment</p>
            {/* Anti-scam payment card */}
            <div className="rounded-2xl border border-[#eecdd4] overflow-hidden">
              <div className="bg-[linear-gradient(135deg,#3d1f6e,#6b3fa0)] px-4 py-3 flex items-center gap-2">
                <span className="text-white text-lg">🏦</span>
                <div>
                  <p className="text-white text-xs font-bold uppercase tracking-[0.18em]">Official Payment Account</p>
                  <p className="text-white/70 text-[10px]">Always verify this account before transferring</p>
                </div>
              </div>
              <div className="bg-[#f8f0f2] p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white border border-[#eecdd4] px-3 py-2">
                    <p className="text-[8px] uppercase tracking-[0.2em] text-[#9a7080] mb-0.5">Recipient name</p>
                    <p className="font-bold text-[#3d1f6e] text-sm">{SITE.accountName}</p>
                  </div>
                  <div className="rounded-xl bg-white border border-[#eecdd4] px-3 py-2">
                    <p className="text-[8px] uppercase tracking-[0.2em] text-[#9a7080] mb-0.5">Bank</p>
                    <p className="font-bold text-[#3d1f6e] text-sm">{SITE.bankName}</p>
                  </div>
                  <div className="rounded-xl bg-white border border-[#eecdd4] px-3 py-2">
                    <p className="text-[8px] uppercase tracking-[0.2em] text-[#9a7080] mb-0.5">Account number</p>
                    <p className="font-bold text-[#3d1f6e] text-sm font-mono">{SITE.accountNumber}</p>
                  </div>
                  <div className="rounded-xl bg-white border border-[#eecdd4] px-3 py-2">
                    <p className="text-[8px] uppercase tracking-[0.2em] text-[#9a7080] mb-0.5">Amount</p>
                    <p className="font-bold text-[#c8788a] text-sm">{SITE.currency} {total.toLocaleString()}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-[#fff8e0] border border-[#f0d898] px-3 py-2.5 flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">⚠️</span>
                  <div>
                    <p className="text-[10px] font-bold text-[#8a6020] uppercase tracking-[0.1em]">Payment reference</p>
                    <p className="text-xs text-[#7a5020] mt-0.5">Use your Booking ID <strong className="font-mono text-[#3d1f6e]">{bookingId}</strong> as the payment reference/narration. Confirm the recipient name is <strong>{SITE.accountName}</strong> before sending.</p>
                  </div>
                </div>
                <p className="text-[10px] text-[#b05060] font-semibold text-center">⚠️ Please note, no refunds after payment.</p>
              </div>
            </div>
            <div><label className="label-text">Payment reference *</label><input value={form.paymentReference} onChange={e=>set('paymentReference',e.target.value)} className="input-field" placeholder={`e.g. ${bookingId}`}/></div>
            <div>
              <label className="label-text mb-1 block">Payment receipt *</label>
              {form.paymentReceiptName?(
                <div className="flex items-center gap-3 rounded-2xl bg-[#f0faf3] border border-[#b8e0c8] p-3">
                  <div className="flex-1 text-sm text-[#2a5a3a] truncate">{form.paymentReceiptName}</div>
                  <button type="button" onClick={()=>{set('paymentReceiptDataUrl','');set('paymentReceiptName','');}} className="text-xs text-[#b05860]">Remove</button>
                </div>
              ):(
                <label className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#eecdd4] p-6 cursor-pointer hover:border-[#d9a0b0] transition-all">
                  <p className="text-sm font-semibold text-[#7a5460]">Tap to upload receipt</p>
                  <p className="text-xs text-[#b08090]">Image or PDF · max 1 MB</p>
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e=>handleReceipt(e.target.files?.[0])}/>
                </label>
              )}
            </div>
            {/* Booking rules reminder */}
            <div className="rounded-2xl bg-[#fdf8ff] border border-[#ede8f5] p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-[#9a7080] mb-2">Booking rules</p>
              <ul className="space-y-1.5">
                {BOOKING_RULES.map((r,i)=>(
                  <li key={i} className="flex gap-2 text-xs text-[#7a5460]">
                    <span className="text-[#c8788a] font-bold shrink-0">{i+1}.</span>{r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-between pt-2">
              <button type="button" onClick={()=>setStep(1)} className="btn-outline-dark"><ArrowLeft size={14}/> Back</button>
              <button type="button" onClick={submit} disabled={submitting} className="btn-rose"><Send size={13}/> {submitting?'Submitting…':isReschedule?'Confirm reschedule':'Submit booking'}</button>
            </div>
          </div>
        )}

        {submitted&&<ThankYouModal booking={submitted} onClose={()=>setSubmitted(null)}/>}
      </div>
    </div>
  );
}
