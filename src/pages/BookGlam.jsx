import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, ArrowRight, Copy, Mic, RotateCcw, Send, Square, X } from 'lucide-react';
import CalendarPicker from '../components/CalendarPicker';
import ThankYouModal from '../components/ThankYouModal';
import BridalSuccessModal from '../components/BridalSuccessModal';
import { bookingApi } from '../utils/bookingApi';
import { SITE, GLAM_WALKIN, BOOKING_RULES } from '../utils/siteConfig';
import { useToast } from '../hooks/useToast';
import { uploadReceiptFile } from '../utils/fileHelpers';

const OCCASION_OPTS = [
  { k: 'bridal',  t: 'Bridal',          d: 'Wedding day, engagement, traditional. Custom pricing — we\'ll reach out.' },
  { k: 'general', t: 'General / Others', d: 'Walk-in makeup, gele, or combo. Instant pricing, simple flow.' },
  { k: 'special', t: 'Special Request',  d: 'Something unique in mind? Describe it or record a voice note.' },
];

const GENERAL_SERVICES = [
  { k: 'makeup',       t: 'Makeup Only',   price: GLAM_WALKIN.makeup        },
  { k: 'gele',         t: 'Gele Only',      price: GLAM_WALKIN.gele          },
  { k: 'makeup+gele',  t: 'Makeup + Gele',  price: GLAM_WALKIN['makeup+gele'] },
];

const BRIDAL_EVENT_TYPES = ['Traditional', 'White Wedding', 'Engagement', 'Other'];
const STEPS_GENERAL = ['Service', 'Your info', 'Payment'];
const STEPS_BRIDAL  = ['Details', 'Your info'];
const STEPS_SPECIAL = ['Request', 'Your info'];

// ── Time picker (clock-style, 30-min slots) ──────────────────────────────────
const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 7; h <= 20; h++) {
    slots.push(`${String(h).padStart(2,'0')}:00`);
    if (h < 20) slots.push(`${String(h).padStart(2,'0')}:30`);
  }
  return slots;
})();

function TimePicker({ value, onChange, label = 'Preferred time' }) {
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
            {TIME_SLOTS.map(t => (
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

function StepBar({ current, steps }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-0">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-[0.18em] transition-all
            ${i===current?'bg-[#3d1f6e] text-white shadow-md':i<current?'bg-[#e8c4cc] text-[#8c3a50]':'bg-white border border-[#eecdd4] text-[#b08a90]'}`}>
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold">{i<current?'✓':i+1}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
          {i<steps.length-1&&<div className={`w-6 h-px mx-1 ${i<current?'bg-[#d9a0b0]':'bg-[#eecdd4]'}`}/>}
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

function VoiceRecorder({ onAudioReady }) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const { showToast } = useToast();

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        const reader = new FileReader();
        reader.onload = () => onAudioReady(reader.result);
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch { showToast('Microphone access denied.', 'error'); }
  }

  function stopRec() { mediaRef.current?.stop(); setRecording(false); }
  function clear() { setAudioUrl(''); onAudioReady(''); }

  return (
    <div className="space-y-2">
      <p className="label-text">Voice note (optional)</p>
      {!audioUrl && !recording && (
        <button type="button" onClick={startRec}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[#eecdd4] bg-white text-sm text-[#7a5460] hover:border-[#c8788a] transition-all">
          <Mic size={14} className="text-[#c8788a]"/> Record a voice note
        </button>
      )}
      {recording && (
        <button type="button" onClick={stopRec}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#fce4ea] border border-[#e8c4cc] text-sm text-[#c8788a] font-semibold animate-pulse">
          <Square size={14}/> Stop recording
        </button>
      )}
      {audioUrl && (
        <div className="space-y-2">
          <audio src={audioUrl} controls className="w-full h-10 rounded-xl"/>
          <button type="button" onClick={clear} className="text-xs text-[#b05860]">Remove recording</button>
        </div>
      )}
    </div>
  );
}


// ── Inline resume banner for glam booking ────────────────────────────────────
function GlamResumeBanner() {
  const [open, setOpen] = React.useState(false);
  const [val, setVal] = React.useState('');
  const navigate = useNavigate();
  function goResume() {
    const id = val.trim().toUpperCase();
    if (!id) return;
    navigate('/book-glam?resume=' + encodeURIComponent(id));
  }
  return (
    <div className="rose-card px-5 py-4 mb-5">
      {!open ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔖</span>
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
            <input
              type="text" value={val} onChange={e => setVal(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && goResume()}
              placeholder="e.g. GLM-20260612-ABC"
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

export default function BookGlam() {
  const [sp] = useSearchParams();
  const resumeId = sp.get('resume');
  const isReschedule = sp.get('mode') === 'reschedule';
  const { showToast } = useToast();

  const [occasion, setOccasion] = useState('');
  const [step, setStep] = useState(0);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step, occasion]);
  const [bookingId, setBookingId] = useState('');
  const [rescheduleCount, setRescheduleCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [customSubmitted, setCustomSubmitted] = useState(null);
  const [loadingResume, setLoadingResume] = useState(false);

  // General
  const [genService, setGenService] = useState('makeup');
  const [genLocationType, setGenLocationType] = useState('studio'); // 'studio' | 'home'
  const [genTime, setGenTime] = useState('10:00');
  const [selectedDate, setSelectedDate] = useState(null);
  const [contact, setContact] = useState({ clientName:'', phone:'', email:'', notes:'' });
  const [payment, setPayment] = useState({ reference:'', receiptName:'', receiptDataUrl:'' });
  const setC = (k,v) => setContact(p=>({...p,[k]:v}));
  const setP = (k,v) => setPayment(p=>({...p,[k]:v}));

  // Bridal
  const [bridal, setBridal] = useState({
    clientName:'', phone:'', email:'',
    weddingDate:'', eventType:'', eventLocation:'', readyLocation:'',
    eventStartTime:'', readyTime:'', hasBridesmaids:false, bridesmaidCount:'', notes:'',
  });
  const setB = (k,v) => setBridal(p=>({...p,[k]:v}));

  // Special
  const [special, setSpecial] = useState({ clientName:'', phone:'', email:'', requestText:'', requestAudioUrl:'', preferredDate:'' });
  const setSpec = (k,v) => setSpecial(p=>({...p,[k]:v}));

  const genTotal = GLAM_WALKIN[genService] || 0;

  // ── Resume ──
  useEffect(() => {
    if (!resumeId) return;
    (async()=>{
      try {
        setLoadingResume(true);
        const {booking:b} = await bookingApi.getBooking(resumeId);
        if (b.bookingType!=='glam') throw new Error('ID belongs to a different booking type.');
        if (isReschedule&&Number(b.rescheduleCount||0)>=1) throw new Error('Already used one reschedule.');
        setBookingId(b.bookingId); setRescheduleCount(Number(b.rescheduleCount||0));
        setOccasion(b.occasion||'general');
        setGenService(b.serviceType||'makeup');
        setGenLocationType(b.locationType||'studio');
        setGenTime(b.startTime||'10:00');
        setSelectedDate(b.preferredDate?new Date(`${b.preferredDate}T00:00:00`):null);
        setContact({clientName:b.clientName||'',phone:b.phone||'',email:b.email||'',notes:b.notes||''});
        setPayment({reference:b.paymentReference||'',receiptName:b.paymentReceiptName||'',receiptDataUrl:b.paymentReceiptUrl||''});
        setStep(1); showToast(`Loaded: ${b.bookingId}`,'success');
      } catch(e){showToast(e.message,'error');} finally{setLoadingResume(false);}
    })();
  },[resumeId]);

  function copyId(){if(!bookingId)return;navigator.clipboard.writeText(bookingId);showToast('Copied!','success');}

  async function handleReceipt(file){
    if(!file)return;
    try{const{dataUrl,name}=await uploadReceiptFile(file);setP('receiptDataUrl',dataUrl);setP('receiptName',name);showToast('Receipt attached.','success');}
    catch(e){showToast(e.message,'error');}
  }

  // ── General handlers ──
  async function genDraft(partial=false){
    const d=await bookingApi.saveDraft({booking_type:'glam',booking_id:bookingId||undefined,occasion:'general',service_type:genService,location_type:genLocationType,start_time:genTime,preferred_date:selectedDate?format(selectedDate,'yyyy-MM-dd'):'',client_name:contact.clientName,phone:contact.phone,email:contact.email,notes:contact.notes,payment_reference:payment.reference,payment_receipt_name:payment.receiptName,payment_receipt_data_url:payment.receiptDataUrl,total_amount:genTotal,currency:SITE.currency,reschedule_count:rescheduleCount,booking_status:partial?'draft':undefined});
    setBookingId(d.bookingId);return d;
  }
  async function genNext0(){
    try{setSaving(true);const d=await genDraft(true);setStep(1);showToast(`ID: ${d.bookingId}`,'success');}
    catch(e){showToast(e.message,'error');}finally{setSaving(false);}
  }
  async function genNext1(){
    if(!contact.clientName||!contact.phone||!contact.email)return showToast('Fill name, phone and email.','error');
    setSaving(true);
    try{await genDraft(true);setP('reference',payment.reference||bookingId);setStep(2);}
    catch(e){showToast(e.message,'error');}finally{setSaving(false);}
  }
  async function genSubmit(){
    if(!contact.clientName||!contact.phone||!contact.email)return showToast('Fill in your details.','error');
    if(!payment.reference)return showToast('Add payment reference.','error');
    if(!payment.receiptDataUrl)return showToast('Attach payment receipt.','error');
    if(isReschedule&&rescheduleCount>=1)return showToast('Already rescheduled once.','error');
    try{
      setSubmitting(true);
      const d=await bookingApi.submitBooking({booking_type:'glam',booking_id:bookingId||undefined,occasion:'general',service_type:genService,location_type:genLocationType,start_time:genTime,preferred_date:selectedDate?format(selectedDate,'yyyy-MM-dd'):'',client_name:contact.clientName,phone:contact.phone,email:contact.email,notes:contact.notes,payment_reference:payment.reference,payment_receipt_name:payment.receiptName,payment_receipt_data_url:payment.receiptDataUrl,total_amount:genTotal,currency:SITE.currency,reschedule_count:isReschedule?rescheduleCount+1:rescheduleCount,booking_status:'pending'});
      setBookingId(d.bookingId);setSubmitted(d.booking);showToast(isReschedule?'Rescheduled!':'Submitted!','success');
    }catch(e){showToast(e.message,'error');}finally{setSubmitting(false);}
  }

  // ── Bridal ──
  async function bridalSubmit(){
    if(!bridal.clientName||!bridal.phone||!bridal.email)return showToast('Fill name, phone and email.','error');
    try{
      setSubmitting(true);
      const d=await bookingApi.submitBooking({booking_type:'glam',booking_id:bookingId||undefined,occasion:'bridal',service_type:'bridal',location_type:'studio',client_name:bridal.clientName,phone:bridal.phone,email:bridal.email,preferred_date:bridal.weddingDate,bridal_wedding_date:bridal.weddingDate,bridal_event_type:bridal.eventType,bridal_event_location:bridal.eventLocation,bridal_ready_location:bridal.readyLocation,bridal_event_start_time:bridal.eventStartTime,bridal_ready_time:bridal.readyTime,bridal_bridesmaids:bridal.hasBridesmaids?Number(bridal.bridesmaidCount||0):0,notes:bridal.notes,total_amount:0,currency:SITE.currency,booking_status:'pending'});
      setBookingId(d.bookingId);setCustomSubmitted(d.booking);showToast('Request sent!','success');
    }catch(e){showToast(e.message,'error');}finally{setSubmitting(false);}
  }

  // ── Special ──
  async function specialSubmit(){
    if(!special.clientName||!special.phone||!special.email)return showToast('Fill name, phone and email.','error');
    if(!special.requestText&&!special.requestAudioUrl)return showToast('Describe your request or record a voice note.','error');
    try{
      setSubmitting(true);
      const d=await bookingApi.submitBooking({booking_type:'glam',booking_id:bookingId||undefined,occasion:'special',service_type:'special',location_type:'studio',client_name:special.clientName,phone:special.phone,email:special.email,preferred_date:special.preferredDate||'',special_request_text:special.requestText,special_request_audio_url:special.requestAudioUrl,total_amount:0,currency:SITE.currency,booking_status:'pending'});
      setBookingId(d.bookingId);setCustomSubmitted(d.booking);showToast('Request sent!','success');
    }catch(e){showToast(e.message,'error');}finally{setSubmitting(false);}
  }

  // ── Occasion selector ──
  if (!occasion) {
    return (
      <div className="min-h-screen bg-silk pt-24 pb-28 md:pb-10">
        <div className="max-w-3xl mx-auto px-5">
          <div className="mb-7">
            <p className="section-label text-[#b8607a] mb-2">Beauty</p>
            <h1 className="font-display text-[22px] md:text-[32px] text-[#3d1f6e] mb-2">Book a glam session</h1>
            <p className="text-[#7a5460] text-sm">Choose your glam type to get started.</p>
          </div>

          {/* ── Resume booking banner ── */}
          <GlamResumeBanner />

          <div className="space-y-3">
            {OCCASION_OPTS.map(({k,t,d})=>(
              <button key={k} type="button" onClick={()=>{setOccasion(k);setStep(0);}}
                className="w-full rounded-2xl border border-[#eecdd4] bg-white p-5 text-left hover:border-[#c8788a] hover:shadow-sm transition-all group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[#3d1f6e] group-hover:text-[#c8788a] transition-colors">{t}</p>
                    <p className="text-sm text-[#9a7080] mt-0.5">{d}</p>
                  </div>
                  <ArrowRight size={16} className="text-[#d9a0b0] group-hover:text-[#c8788a] shrink-0"/>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── BRIDAL ──
  if (occasion==='bridal') {
    return (
      <div className="min-h-screen bg-silk pt-24 pb-28 md:pb-10">
        <div className="max-w-3xl mx-auto px-5">
          <div className="mb-7">
            <button type="button" onClick={()=>setOccasion('')} className="text-xs text-[#9a7080] mb-3 flex items-center gap-1"><ArrowLeft size={12}/> Change type</button>
            <p className="section-label text-[#b8607a] mb-2">Bridal Glam</p>
            <h1 className="font-display text-[22px] md:text-[32px] text-[#3d1f6e] mb-2">Bridal booking request</h1>
            <p className="text-[#7a5460] text-sm">Tell us about your big day. We'll reach out to discuss and tailor everything just for you.</p>
          </div>
          <StepBar current={customSubmitted?STEPS_BRIDAL.length:step} steps={STEPS_BRIDAL}/>
          {!customSubmitted&&step===0&&(
            <div className="rose-card p-6 space-y-4">
              <p className="font-semibold text-[#3d1f6e]">Your wedding details</p>
              <div><label className="label-text">Wedding date *</label><input type="date" value={bridal.weddingDate} onChange={e=>setB('weddingDate',e.target.value)} className="input-field"/></div>
              <div>
                <label className="label-text mb-2 block">Event type</label>
                <div className="flex flex-wrap gap-2">
                  {BRIDAL_EVENT_TYPES.map(t=>{
                    const selArr=(bridal.eventType||'').split(',').map(x=>x.trim()).filter(Boolean);
                    const isActive=selArr.includes(t);
                    return(
                      <button key={t} type="button" onClick={()=>{
                        const next=isActive?selArr.filter(x=>x!==t):[...selArr,t];
                        setB('eventType',next.join(', '));
                      }}
                        className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${isActive?'bg-[#c8788a] text-white border-[#c8788a]':'border-[#eecdd4] text-[#7a5460] hover:border-[#d9a0b0]'}`}>{t}</button>
                    );
                  })}
                </div>
              </div>
              <div><label className="label-text">Event location</label><input value={bridal.eventLocation} onChange={e=>setB('eventLocation',e.target.value)} className="input-field" placeholder="e.g. Landmark Event Centre, Victoria Island, Lagos"/></div>
              <div><label className="label-text">Getting ready location (if different)</label><input value={bridal.readyLocation} onChange={e=>setB('readyLocation',e.target.value)} className="input-field" placeholder="e.g. Radisson Blu Hotel"/></div>
              {/* Bridal times on separate rows as requested */}
              <div><label className="label-text">Event start time</label><input type="time" value={bridal.eventStartTime} onChange={e=>setB('eventStartTime',e.target.value)} className="input-field"/></div>
              <div><label className="label-text">Time you need to be ready</label><input type="time" value={bridal.readyTime} onChange={e=>setB('readyTime',e.target.value)} className="input-field"/></div>
              <div>
                <label className="label-text mb-2 block">Include bridesmaids?</label>
                <div className="flex gap-3">
                  {[{v:false,t:'No'},{v:true,t:'Yes'}].map(({v,t})=>(
                    <button key={t} type="button" onClick={()=>setB('hasBridesmaids',v)}
                      className={`px-5 py-2 rounded-full text-sm font-semibold border transition-all ${bridal.hasBridesmaids===v?'bg-[#c8788a] text-white border-[#c8788a]':'border-[#eecdd4] text-[#7a5460]'}`}>{t}</button>
                  ))}
                </div>
                {bridal.hasBridesmaids&&<div className="mt-3"><label className="label-text">How many bridesmaids?</label><input type="number" min="1" max="20" value={bridal.bridesmaidCount} onChange={e=>setB('bridesmaidCount',e.target.value)} className="input-field" placeholder="e.g. 4"/></div>}
              </div>
              <div className="flex justify-end pt-2">
                <button type="button" onClick={()=>setStep(1)} className="btn-ink">Next <ArrowRight size={14}/></button>
              </div>
            </div>
          )}
          {!customSubmitted&&step===1&&(
            <div className="rose-card p-6 space-y-4">
              <p className="font-semibold text-[#3d1f6e]">Your contact details</p>
              <div><label className="label-text">Full name *</label><input value={bridal.clientName} onChange={e=>setB('clientName',e.target.value)} className="input-field" placeholder="Bride's full name"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-text">Phone *</label><input value={bridal.phone} onChange={e=>setB('phone',e.target.value)} className="input-field" placeholder="08000000000"/></div>
                <div><label className="label-text">Email *</label><input type="email" value={bridal.email} onChange={e=>setB('email',e.target.value)} className="input-field" placeholder="you@email.com"/></div>
              </div>
              <div><label className="label-text">Additional notes</label><textarea value={bridal.notes} onChange={e=>setB('notes',e.target.value)} rows={3} className="input-field resize-none" placeholder="Preferred styles, inspiration, concerns…"/></div>
              <div className="rounded-2xl bg-[#f0faf3] border border-[#b8e0c8] p-4 text-sm text-[#2a5a3a]">
                <p className="font-semibold mb-1">No payment needed now</p>
                <p className="text-xs">After you submit, our team will reach out to discuss pricing and your preferences.</p>
              </div>
              <div className="flex justify-between pt-2">
                <button type="button" onClick={()=>setStep(0)} className="btn-outline-dark"><ArrowLeft size={14}/> Back</button>
                <button type="button" onClick={bridalSubmit} disabled={submitting} className="btn-rose"><Send size={13}/> {submitting?'Sending…':'Send request'}</button>
              </div>
            </div>
          )}
          {customSubmitted&&<BridalSuccessModal bookingId={customSubmitted.bookingId} type="bridal" onClose={()=>{setCustomSubmitted(null);setOccasion('');setStep(0);}}/>}
        </div>
      </div>
    );
  }

  // ── SPECIAL REQUEST ──
  if (occasion==='special') {
    return (
      <div className="min-h-screen bg-silk pt-24 pb-28 md:pb-10">
        <div className="max-w-3xl mx-auto px-5">
          <div className="mb-7">
            <button type="button" onClick={()=>setOccasion('')} className="text-xs text-[#9a7080] mb-3 flex items-center gap-1"><ArrowLeft size={12}/> Change type</button>
            <p className="section-label text-[#b8607a] mb-2">Special Request</p>
            <h1 className="font-display text-[22px] md:text-[32px] text-[#3d1f6e] mb-2">Tell us what you need</h1>
            <p className="text-[#7a5460] text-sm">Something unique? Describe it in words or record a voice note — or both.</p>
          </div>
          <StepBar current={customSubmitted?STEPS_SPECIAL.length:step} steps={STEPS_SPECIAL}/>
          {!customSubmitted&&step===0&&(
            <div className="rose-card p-6 space-y-4">
              <div><label className="label-text mb-1 block">Describe your request</label><textarea value={special.requestText} onChange={e=>setSpec('requestText',e.target.value)} rows={4} className="input-field resize-none" placeholder="The event, the look you want, any special requirements…"/></div>
              <VoiceRecorder onAudioReady={url=>setSpec('requestAudioUrl',url)}/>
              <div><label className="label-text">Preferred date (optional)</label><input type="date" value={special.preferredDate} onChange={e=>setSpec('preferredDate',e.target.value)} className="input-field"/></div>
              <div className="flex justify-end pt-2">
                <button type="button" onClick={()=>setStep(1)} className="btn-ink">Next <ArrowRight size={14}/></button>
              </div>
            </div>
          )}
          {!customSubmitted&&step===1&&(
            <div className="rose-card p-6 space-y-4">
              <p className="font-semibold text-[#3d1f6e]">Your contact details</p>
              <div><label className="label-text">Full name *</label><input value={special.clientName} onChange={e=>setSpec('clientName',e.target.value)} className="input-field" placeholder="Your full name"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-text">Phone *</label><input value={special.phone} onChange={e=>setSpec('phone',e.target.value)} className="input-field" placeholder="08000000000"/></div>
                <div><label className="label-text">Email *</label><input type="email" value={special.email} onChange={e=>setSpec('email',e.target.value)} className="input-field" placeholder="you@email.com"/></div>
              </div>
              <div className="rounded-2xl bg-[#f0faf3] border border-[#b8e0c8] p-4 text-sm text-[#2a5a3a]">
                <p className="font-semibold mb-1">No payment needed now</p>
                <p className="text-xs">We'll review your request and reach out to discuss details and pricing.</p>
              </div>
              <div className="flex justify-between pt-2">
                <button type="button" onClick={()=>setStep(0)} className="btn-outline-dark"><ArrowLeft size={14}/> Back</button>
                <button type="button" onClick={specialSubmit} disabled={submitting} className="btn-rose"><Send size={13}/> {submitting?'Sending…':'Send request'}</button>
              </div>
            </div>
          )}
          {customSubmitted&&<BridalSuccessModal bookingId={customSubmitted.bookingId} type="special" onClose={()=>{setCustomSubmitted(null);setOccasion('');setStep(0);}}/>}
        </div>
      </div>
    );
  }

  // ── GENERAL / OTHERS ──
  return (
    <div className="min-h-screen bg-silk pt-24 pb-28 md:pb-10">
      <div className="max-w-3xl mx-auto px-5">
        <div className="mb-7">
          <button type="button" onClick={()=>setOccasion('')} className="text-xs text-[#9a7080] mb-3 flex items-center gap-1"><ArrowLeft size={12}/> Change type</button>
          <p className="section-label text-[#b8607a] mb-2">Glam Session</p>
          <h1 className="font-display text-[22px] md:text-[32px] text-[#3d1f6e] mb-2">Book a glam session</h1>
          <p className="text-[#7a5460] text-sm">Step-by-step. Your booking ID appears early — use it as your payment reference.</p>
        </div>
        <StepBar current={submitted?STEPS_GENERAL.length:step} steps={STEPS_GENERAL}/>
        <SessionIdBadge bookingId={bookingId} onCopy={copyId}/>
        {/* ── Resume booking banner — step 0 only ────────── */}
        {step === 0 && !resumeId && (
        <div className="rose-card px-5 py-4 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔖</span>
            <div>
              <p className="font-semibold text-[#3d1f6e] text-sm">Already started a booking?</p>
              <p className="text-xs text-[#9a7080] mt-0.5">Enter your Booking ID to resume from where you left off.</p>
            </div>
          </div>
          <a href="/track" className="btn-outline-dark text-xs shrink-0 px-4 py-2 flex items-center gap-1.5">
            <RotateCcw size={12}/> Resume
          </a>
        </div>
        )}
        {loadingResume&&<div className="rose-card p-5 mb-5 text-sm text-[#7a5460]">Loading saved booking…</div>}

        {!submitted&&step===0&&(
          <div className="rose-card p-6 space-y-5">
            {/* Service — 2 col grid for conciseness */}
            <div>
              <p className="label-text mb-2">Service</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {GENERAL_SERVICES.map(({k,t,price})=>(
                  <button key={k} type="button" onClick={()=>setGenService(k)}
                    className={`rounded-2xl border p-3 text-left transition-all ${genService===k?'border-[#c8788a] bg-[linear-gradient(135deg,#fce4ea,#f8d8e2)] shadow-sm':'border-[#eecdd4] bg-white hover:border-[#d9a0b0]'}`}>
                    <p className="font-semibold text-xs text-[#3d1f6e]">{t}</p>
                    <p className="text-[10px] text-[#9a7080] mt-0.5">{SITE.currency} {price.toLocaleString()}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Walk-in vs Home service */}
            <div>
              <p className="label-text mb-2">Session type</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { k:'studio', t:'Studio walk-in', d:'Come to us' },
                  { k:'home',   t:'Home service',   d:'We come to you' },
                ].map(({k,t,d})=>(
                  <label key={k} className={`flex items-center gap-3 rounded-2xl border p-3.5 cursor-pointer transition-all ${genLocationType===k?'border-[#c8788a] bg-[linear-gradient(135deg,#fce4ea,#f8d8e2)] shadow-sm':'border-[#eecdd4] bg-white hover:border-[#d9a0b0]'}`}>
                    <input type="radio" name="locType" value={k} checked={genLocationType===k} onChange={()=>setGenLocationType(k)} className="accent-[#c8788a]"/>
                    <div>
                      <p className="text-xs font-semibold text-[#3d1f6e]">{t}</p>
                      <p className="text-[10px] text-[#9a7080]">{d}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Date + Time in a 2-col grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="label-text mb-2">Date</p>
                <CalendarPicker selected={selectedDate} onChange={setSelectedDate}/>
                {selectedDate && (
                  <p className="mt-2 text-xs font-semibold text-[#3d7a53]">✅ {format(selectedDate, 'EEE, MMM d yyyy')}</p>
                )}
              </div>
              <div>
                <TimePicker value={genTime} onChange={setGenTime} label="Preferred time"/>
              </div>
            </div>

            {selectedDate&&(
              <div className="rounded-2xl bg-[linear-gradient(135deg,#fce4ea,#f8d8e2)] border border-[#e8c4cc] p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#9a7080] uppercase tracking-[0.18em] font-semibold">Total</p>
                  <p className="font-display text-2xl text-[#3d1f6e]">{SITE.currency} {genTotal.toLocaleString()}</p>
                </div>
                <p className="text-xs text-[#7a5460]">{format(selectedDate,'dd MMM yyyy')} · {genTime}</p>
              </div>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={genNext0} disabled={saving} className="btn-ink">{saving?'Saving…':'Next'} <ArrowRight size={14}/></button>
            </div>
          </div>
        )}

        {!submitted&&step===1&&(
          <div className="rose-card p-6 space-y-4">
            <p className="font-semibold text-[#3d1f6e]">Your details</p>
            <div><label className="label-text">Full name *</label><input value={contact.clientName} onChange={e=>setC('clientName',e.target.value)} className="input-field" placeholder="Your full name"/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-text">Phone *</label><input value={contact.phone} onChange={e=>setC('phone',e.target.value)} className="input-field" placeholder="08000000000"/></div>
              <div><label className="label-text">Email *</label><input type="email" value={contact.email} onChange={e=>setC('email',e.target.value)} className="input-field" placeholder="you@email.com"/></div>
            </div>
            <div><label className="label-text">Notes (optional)</label><textarea value={contact.notes} onChange={e=>setC('notes',e.target.value)} rows={2} className="input-field resize-none" placeholder="Anything we should know"/></div>
            <div className="flex justify-between pt-2">
              <button type="button" onClick={()=>setStep(0)} className="btn-outline-dark"><ArrowLeft size={14}/> Back</button>
              <button type="button" onClick={genNext1} disabled={saving} className="btn-ink">{saving?'Saving…':'Next'} <ArrowRight size={14}/></button>
            </div>
          </div>
        )}

        {!submitted&&step===2&&(
          <div className="rose-card p-6 space-y-4">
            <p className="font-semibold text-[#3d1f6e]">Payment</p>
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
                    <p className="font-bold text-[#c8788a] text-sm">{SITE.currency} {genTotal.toLocaleString()}</p>
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
            <div><label className="label-text">Payment reference *</label><input value={payment.reference} onChange={e=>setP('reference',e.target.value)} className="input-field" placeholder={`e.g. ${bookingId}`}/></div>
            <div>
              <label className="label-text mb-1 block">Payment receipt *</label>
              {payment.receiptName?(
                <div className="flex items-center gap-3 rounded-2xl bg-[#f0faf3] border border-[#b8e0c8] p-3">
                  <div className="flex-1 text-sm text-[#2a5a3a] truncate">{payment.receiptName}</div>
                  <button type="button" onClick={()=>{setP('receiptDataUrl','');setP('receiptName','');}} className="text-xs text-[#b05860]">Remove</button>
                </div>
              ):(
                <label className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#eecdd4] p-6 cursor-pointer hover:border-[#d9a0b0] transition-all">
                  <p className="text-sm font-semibold text-[#7a5460]">Tap to upload receipt</p>
                  <p className="text-xs text-[#b08090]">Image or PDF · max 5 MB</p>
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e=>handleReceipt(e.target.files?.[0])}/>
                </label>
              )}
            </div>
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
              <button type="button" onClick={genSubmit} disabled={submitting} className="btn-rose"><Send size={13}/> {submitting?'Submitting…':isReschedule?'Confirm reschedule':'Submit booking'}</button>
            </div>
          </div>
        )}

        {submitted&&<ThankYouModal booking={submitted} onClose={()=>{setSubmitted(null);setOccasion('');setStep(0);}}/>}
      </div>
    </div>
  );
}
