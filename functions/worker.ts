/**
 * Beccastouch Studio — Cloudflare Worker Backend
 * Firebase Firestore (REST) + Base44 Gmail relay (email)
 *
 * Environment variables (Cloudflare Dashboard → Worker → Settings → Variables):
 *   FIREBASE_PROJECT_ID       e.g. beccastouch-studio
 *   FIREBASE_CLIENT_EMAIL     e.g. firebase-adminsdk-fbsvc@beccastouch-studio.iam.gserviceaccount.com
 *   FIREBASE_PRIVATE_KEY_B64  base64-encoded PEM private key
 *   BECCA_MAIL_SECRET         optional override for Base44 relay secret (default: beccastouch_mail_2026)
 *   ADMIN_PIN                 optional override for admin PIN (default: 12345678)
 */

export interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY_B64: string;
  ADMIN_PIN?: string;
  BECCA_MAIL_SECRET?: string;
}

// ── CORS ─────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
const j = (data: unknown, s = 200) =>
  new Response(JSON.stringify(data), {
    status: s,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

// ── Constants ─────────────────────────────────────────────────────────────────
const STUDIO   = 'Beccastouch Studio';
const ADDRESS  = 'Total Filling Station, Oju-Irin Bodija, Ibadan, Oyo State';
const DEFAULT_PIN = '12345678';
const PAYMENT  = { bankName: 'First Bank', accountName: 'Beccastouch Studio', accountNumber: '0123456789', currency: 'NGN' };
const PHONE    = '+234 802 327 4274';
const TIKTOK   = '@beccastouch';
const RULES = [
  'Your booking is provisional until payment is verified and the studio confirms your slot.',
  'Keep your booking ID safe — use it to track status or resume your booking.',
  'Arrive at least 15 minutes before your approved session time.',
  'Request date/time changes early so the team can confirm availability.',
  'For home service bookings, your full address must be correct before confirmation.',
  'Please note: all payments are final. We do not offer refunds after payment has been made.',
];

// ── Firebase JWT ──────────────────────────────────────────────────────────────
async function getFirebaseToken(env: Env): Promise<string> {
  const clientEmail = 'firebase-adminsdk-fbsvc@beccastouch-studio.iam.gserviceaccount.com';
  const projectId   = env.FIREBASE_PROJECT_ID || 'beccastouch-studio';

  // Decode base64 PEM
  const b64 = env.FIREBASE_PRIVATE_KEY_B64 || '';
  const pem = atob(b64);

  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail, sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
  };

  const enc = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsigned = `${enc(header)}.${enc(payload)}`;

  // Import PEM key
  const pemBody = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const sigBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${unsigned}.${sig}`;

  // Exchange for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json() as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) throw new Error('Firebase auth failed: ' + JSON.stringify(data));
  return data.access_token;
}

// ── Firestore helpers ─────────────────────────────────────────────────────────
function fsVal(v: unknown): unknown {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean')  return { booleanValue: v };
  if (typeof v === 'number')   return { doubleValue: v };
  if (typeof v === 'string')   return { stringValue: v };
  if (Array.isArray(v))        return { arrayValue: { values: v.map(fsVal) } };
  if (typeof v === 'object')   return { mapValue: { fields: Object.fromEntries(Object.entries(v as Record<string,unknown>).map(([k,val]) => [k, fsVal(val)])) } };
  return { stringValue: String(v) };
}

function fsToJs(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    // Guard: Firestore values are always objects like { stringValue: "..." }
    // If it's not an object (shouldn't happen but safety first), skip
    if (v === null || typeof v !== 'object') { out[k] = v; continue; }
    const fv = v as Record<string, unknown>;
    if ('stringValue'  in fv) out[k] = fv.stringValue;
    else if ('integerValue'  in fv) out[k] = Number(fv.integerValue);
    else if ('doubleValue'   in fv) out[k] = fv.doubleValue;
    else if ('booleanValue'  in fv) out[k] = fv.booleanValue;
    else if ('nullValue'     in fv) out[k] = null;
    else if ('arrayValue'    in fv) {
      const av = fv.arrayValue as { values?: unknown[] };
      out[k] = (av.values || []).map((x) => {
        if (x === null || typeof x !== 'object') return x;
        const xf = x as Record<string, unknown>;
        if ('mapValue' in xf) return fsToJs((xf.mapValue as { fields: Record<string,unknown> }).fields || {});
        if ('stringValue' in xf) return xf.stringValue;
        if ('integerValue' in xf) return Number(xf.integerValue);
        if ('doubleValue' in xf) return xf.doubleValue;
        if ('booleanValue' in xf) return xf.booleanValue;
        if ('nullValue' in xf) return null;
        return fsToJs(xf as Record<string, unknown>);
      });
    }
    else if ('mapValue' in fv) {
      const mv = fv.mapValue as { fields?: Record<string,unknown> };
      out[k] = mv.fields ? fsToJs(mv.fields) : {};
    }
    else if ('timestampValue' in fv) out[k] = fv.timestampValue;
    else out[k] = null;
  }
  return out;
}

function toFsDoc(data: Record<string, unknown>) {
  return { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fsVal(v)])) };
}

class Firestore {
  token: string;
  base: string;
  constructor(token: string, projectId: string) {
    this.token = token;
    this.base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  }
  hdr() { return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }; }

  async get(col: string, id: string): Promise<Record<string, unknown> | null> {
    const r = await fetch(`${this.base}/${col}/${id}`, { headers: this.hdr() });
    if (r.status === 404) return null;
    const d = await r.json() as Record<string, unknown>;
    if (!d.fields) return null;
    return { id: (d.name as string).split('/').pop(), ...fsToJs(d.fields as Record<string,unknown>) };
  }

  async query(col: string, filters: Array<{ field: string; op: string; value: unknown }> = [], orderField?: string, limit = 500): Promise<Record<string, unknown>[]> {
    const body: Record<string, unknown> = {
      structuredQuery: {
        from: [{ collectionId: col }],
        ...(filters.length ? { where: filters.length === 1
          ? { fieldFilter: { field: { fieldPath: filters[0].field }, op: filters[0].op, value: fsVal(filters[0].value) } }
          : { compositeFilter: { op: 'AND', filters: filters.map(f => ({ fieldFilter: { field: { fieldPath: f.field }, op: f.op, value: fsVal(f.value) } })) } }
        } : {}),
        ...(orderField ? { orderBy: [{ field: { fieldPath: orderField.replace('-','') }, direction: orderField.startsWith('-') ? 'DESCENDING' : 'ASCENDING' }] } : {}),
        limit,
      }
    };
    const r = await fetch(`${this.base}:runQuery`, {
      method: 'POST', headers: this.hdr(), body: JSON.stringify(body),
    });
    const arr = await r.json() as Array<Record<string,unknown>>;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(d => d.document)
      .map(d => {
        const doc = d.document as { name: string; fields: Record<string,unknown>; createTime: string; updateTime: string };
        return { id: doc.name.split('/').pop(), ...fsToJs(doc.fields), _created: doc.createTime, _updated: doc.updateTime };
      });
  }

  async create(col: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const now = new Date().toISOString();
    const r = await fetch(`${this.base}/${col}`, { method: 'POST', headers: this.hdr(), body: JSON.stringify(toFsDoc({ ...data, created_date: now, updated_date: now })) });
    const d = await r.json() as Record<string, unknown>;
    if (!d.fields) throw new Error('Firestore create failed: ' + JSON.stringify(d));
    return { id: (d.name as string).split('/').pop(), ...fsToJs(d.fields as Record<string,unknown>) };
  }

  async set(col: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const now = new Date().toISOString();
    const r = await fetch(`${this.base}/${col}/${id}`, {
      method: 'PATCH', headers: this.hdr(), body: JSON.stringify(toFsDoc({ ...data, updated_date: now })),
    });
    const d = await r.json() as Record<string, unknown>;
    if (!d.fields) throw new Error('Firestore set failed: ' + JSON.stringify(d));
    return { id, ...fsToJs(d.fields as Record<string,unknown>) };
  }

  async update(col: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = await this.get(col, id);
    if (!existing) throw new Error(`Document ${col}/${id} not found`);
    const merged = { ...existing, ...data, updated_date: new Date().toISOString() };
    delete merged._created; delete merged._updated;
    return this.set(col, id, merged);
  }

  async delete(col: string, id: string): Promise<void> {
    await fetch(`${this.base}/${col}/${id}`, { method: 'DELETE', headers: this.hdr() });
  }

  async getConfig(key: string): Promise<string | null> {
    const doc = await this.get('config', key);
    return doc ? String(doc.value ?? '') : null;
  }

  async setConfig(key: string, value: string): Promise<void> {
    await this.set('config', key, { value });
  }
}

// ── Email via Base44 Gmail relay (sole provider) ─────────────────────────────
async function sendMail(
  env: Env,
  to: string,
  subject: string,
  html: string,
  _fs?: Firestore,
): Promise<void> {
  console.log('[sendMail] Sending to:', to, '| subject:', subject.slice(0, 60));
  const GMAIL_RELAY_URL = 'https://api.base44.com/api/apps/6a2b0fd46df8ce19f5241af5/functions/sendGmailEmail';
  const MAIL_SECRET = (env as any).BECCA_MAIL_SECRET || "~mQmAT.s6BUB'L.";
  try {
    const res = await fetch(GMAIL_RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: MAIL_SECRET, to, subject, html }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('[sendMail] Relay error', res.status, text.slice(0, 200), '| to:', to);
    } else {
      console.log('[sendMail] Sent OK to:', to, '| resp:', text.slice(0, 120));
    }
  } catch (e) {
    console.error('[sendMail] Exception sending to:', to, '|', (e as Error).message);
  }
}


// ── PIN helpers ───────────────────────────────────────────────────────────────
async function getPin(fs: Firestore, env: Env): Promise<string> {
  return (await fs.getConfig('admin_pin')) || env.ADMIN_PIN || DEFAULT_PIN;
}
async function checkPin(fs: Firestore, env: Env, pin: string): Promise<void> {
  if (!pin || pin !== await getPin(fs, env)) throw new Error('Invalid PIN');
}

// ── Booking helpers ───────────────────────────────────────────────────────────
function bid(bookingType?: string): string {
  const prefix = bookingType === 'glam' ? 'GLM' : bookingType === 'studio' ? 'STU' : 'BK';
  const d = new Date();
  const rand = Math.random().toString(36).slice(2,6).toUpperCase();
  return `${prefix}-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${rand}`;
}
function smry(p: Record<string,unknown>): string {
  if (p.booking_type === 'studio') {
    const use = String(p.studio_use || 'photoshoot');
    const sess = String(p.session_type || 'single');
    const dur = p.duration_hours ? `${p.duration_hours}h` : '';
    return `${use === 'content' ? 'Content Creation' : 'Photoshoot'} · ${sess === 'group' ? 'Group' : 'Single'}${dur ? ' · ' + dur : ''} · ${p.preferred_date || 'TBD'}`;
  }
  if (p.occasion === 'bridal')  return `Bridal Glam · ${p.bridal_wedding_date || p.preferred_date || 'TBD'}`;
  if (p.occasion === 'special') return `Special Request · ${p.preferred_date || 'TBD'}`;
  const svc = p.service_type === 'makeup+gele' ? 'Makeup + Gele' : p.service_type === 'gele' ? 'Gele Only' : 'Makeup Only';
  return `${svc} · General Glam · ${p.preferred_date || 'TBD'}`;
}
function norm(p: Record<string,unknown>, id: string, status: string, ex?: Record<string,unknown> | null) {
  return {
    ...(ex || {}), ...p,
    booking_id: id,
    status,
    client_summary: (p.client_summary as string) || smry(p),
    flow_status: status === 'submitted' ? 'submitted' : (p.flow_status as string) || 'draft',
    updated_at: new Date().toISOString(),
  };
}
async function findBooking(fs: Firestore, bookingId: string) {
  // No orderField here — ordering+filtering together requires a Firestore composite index.
  // Since booking_id is unique, order doesn't matter; query without order to avoid index error.
  const r = await fs.query('bookings', [{ field: 'booking_id', op: 'EQUAL', value: bookingId }], undefined, 1);
  return r[0] || null;
}

// ── snake_case → camelCase mapper for frontend ────────────────────────────────
function toFE(b: Record<string,unknown>): Record<string,unknown> {
  if (!b) return b;
  return {
    ...b,
    // Booking identity
    bookingId:          b.booking_id,
    bookingType:        b.booking_type,
    flowStatus:         b.flow_status,
    bookingStatus:      b.booking_status || b.status,   // worker stores as 'status'
    // Client
    clientName:         b.client_name,
    locationType:       b.location_type,
    studioUse:          b.studio_use,
    sessionType:        b.session_type,
    groupSize:          b.group_size,
    serviceType:        b.service_type,
    preferredDate:      b.preferred_date,
    startTime:          b.start_time,
    durationHours:      b.duration_hours,
    // Payment
    totalAmount:        b.total_amount,
    paymentReference:   b.payment_reference,
    paymentReceiptName: b.payment_receipt_name,
    paymentReceiptUrl:  b.payment_receipt_data_url,
    // Admin
    adminNote:          b.admin_note,
    confirmationSent:   b.confirmation_sent,
    lastEmailSentAt:    b.last_email_sent_at,
    rescheduleCount:    b.reschedule_count,
    isArchived:         b.is_archived || b.status === 'archived',
    archivedAt:         b.archived_at,
    serviceAttended:    b.service_attended || b.attended,
    attendedAt:         b.attended_at,
    // Bridal
    bridalWeddingDate:  b.bridal_wedding_date,
    bridalEventType:    b.bridal_event_type,
    bridalEventLocation:b.bridal_event_location,
    bridalReadyLocation:b.bridal_ready_location,
    bridalEventStartTime:b.bridal_event_start_time,
    bridalReadyTime:    b.bridal_ready_time,
    bridalBridesmaids:  b.bridal_bridesmaids,
    // Special
    specialRequestText: b.special_request_text,
    specialRequestAudioUrl: b.special_request_audio_url,
    // Summary
    summary:            b.client_summary,
    clientSummary:      b.client_summary,
  };
}


// ── Booking type helpers ───────────────────────────────────────────────────────
function bookingTypeLabel(b: Record<string,unknown>): string {
  if (b.booking_type === 'studio') {
    return b.studio_use === 'content' ? '🎬 Content Creation' : '📸 Photoshoot';
  }
  if (b.occasion === 'bridal') return '💍 Bridal Glam';
  if (b.occasion === 'special') return '✨ Special Request';
  const svc = b.service_type === 'makeup+gele' ? 'Makeup + Gele' : b.service_type === 'gele' ? 'Gele Only' : 'Makeup';
  return `💄 ${svc}`;
}
function bookingGreeting(b: Record<string,unknown>): string {
  if (b.booking_type === 'studio' && b.studio_use === 'content')
    return `Hi <b>${b.client_name}</b>, your content creation session has been received! 🎬 We are getting the studio ready for you.`;
  if (b.booking_type === 'studio')
    return `Hi <b>${b.client_name}</b>, your photoshoot booking is in! 📸 We will have the lights, backdrop, and good energy waiting for you.`;
  if (b.occasion === 'bridal')
    return `Hi <b>${b.client_name}</b>, your bridal glam request has landed safely with us! 💍 We are so honoured to be part of your special day.`;
  if (b.occasion === 'special')
    return `Hi <b>${b.client_name}</b>, your special request has been received! ✨ We will review and reach out to you shortly.`;
  return `Hi <b>${b.client_name}</b>, your glam booking is in and we are already excited to work on you! 💄`;
}

// ── Shared email helpers (exact Client_template.md / admin_template.md layout) ──

// Outer shell: purple/pink gradient header, white card, lavender footer
function shell(_h: string, _s: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f3eef8;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3eef8;padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(61,31,110,0.08);">
<tr><td style="background:linear-gradient(135deg,#3d1f6e,#c8788a);padding:28px 32px;">
  <p style="margin:0 0 4px;font-size:10px;letter-spacing:0.28em;color:rgba(255,255,255,0.7);text-transform:uppercase;">Beauty · Photography · Style</p>
  <h1 style="margin:0;font-size:24px;font-weight:800;color:#fff;">Beccastouch Studio</h1>
  <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.75);">📍 ${ADDRESS}</p>
</td></tr>
<tr><td style="padding:28px 32px;">
  ${body}
</td></tr>
<tr><td style="background:#f8f4ff;padding:16px 32px;border-top:1px solid #ede8f5;">
  <p style="margin:0;font-size:11px;color:#9a7ab0;text-align:center;">Beccastouch Studio · ${ADDRESS} · ${PHONE}</p>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

// Label | value table row
function dr(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 10px;font-size:12px;color:#9a7080;white-space:nowrap;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">${label}</td>
    <td style="padding:6px 10px;font-size:13px;color:#3d1f6e;font-weight:500;">${value}</td>
  </tr>`;
}

// Wrap rows in the purple-bordered table
function dtable(rows: string): string {
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fdf8ff;border-radius:12px;overflow:hidden;border:1px solid #ede0f8;">${rows}</table>`;
}

// Booking rules block
function rulesHtml(): string {
  return `<div style="margin-top:16px;padding:12px 18px;background:#fdf4f8;border-radius:12px;border:1px solid rgba(200,120,138,0.15);">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#8a3050;text-transform:uppercase;letter-spacing:0.15em;">Please note</p>
    <ul style="margin:0;padding-left:16px;">${RULES.map(r => `<li style="font-size:11px;color:#6b4a52;line-height:1.7;margin-bottom:2px;">${r}</li>`).join('')}</ul>
  </div>`;
}

// ── Email templates ───────────────────────────────────────────────────────────

// CLIENT confirmation — matches Client_template.md
function tplSubmitted(b: Record<string,unknown>) {
  const isBridalOrSpecial = b.occasion === 'bridal' || b.occasion === 'special';
  const headline = isBridalOrSpecial
    ? (b.occasion === 'bridal' ? 'Bridal Request Received! 💍' : 'Special Request Received! ✨')
    : 'Booking Received! 🌸';
  const subtitle = `Hi ${b.client_name}, we got your booking request`;
  const statusMsg = isBridalOrSpecial
    ? `Your ${b.occasion} request has been submitted. Our team will reach out shortly to discuss details and pricing.`
    : `Your booking has been submitted and is under review. We'll confirm or be in touch with you shortly.`;
  const typeLabel = bookingTypeLabel(b);

  const rows =
    dr('Booking ID', b.booking_id as string) +
    dr('Type', typeLabel) +
    (b.preferred_date ? dr('Date', b.preferred_date as string) : '') +
    (b.start_time ? dr('Time', b.start_time as string) : '') +
    (b.occasion ? dr('Occasion', String(b.occasion)) : '') +
    (b.total_amount ? dr('Amount', (b.currency as string || 'NGN') + ' ' + Number(b.total_amount).toLocaleString()) : '') +
    dr('Name', b.client_name as string) +
    dr('Phone', b.phone as string) +
    dr('Email', b.email as string);

  const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#3d1f6e;font-weight:800;">${headline}</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#9a7080;">${subtitle}</p>
    <div style="background:#f0faf3;border:1px solid #b8e0c8;border-radius:12px;padding:14px 18px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#3d7a53;font-weight:600;">✅ ${statusMsg}</p>
    </div>
    ${dtable(rows)}
    <p style="font-size:12px;color:#9a7090;margin-top:16px;">📍 <b>${ADDRESS}</b></p>
    <p style="font-size:12px;color:#9a7090;margin-top:8px;">Questions? Reply to this email or WhatsApp us on <b>${PHONE}</b>.</p>`;

  return shell('', '', body);
}

// ADMIN notification — matches admin_template.md
function tplAdmin(b: Record<string,unknown>) {
  const typeLabel = bookingTypeLabel(b);
  const rows =
    dr('Booking ID', b.booking_id as string) +
    dr('Type', typeLabel) +
    (b.preferred_date ? dr('Date', b.preferred_date as string) : '') +
    (b.start_time ? dr('Time', b.start_time as string) : '') +
    (b.occasion ? dr('Occasion', String(b.occasion)) : '') +
    (b.total_amount ? dr('Amount', (b.currency as string || 'NGN') + ' ' + Number(b.total_amount).toLocaleString()) : '') +
    dr('Name', b.client_name as string) +
    dr('Phone', b.phone as string) +
    dr('Email', b.email as string) +
    (b.notes ? dr('Notes', b.notes as string) : '') +
    (b.location_type ? dr('Service type', b.location_type === 'home' ? 'Home service' : 'Studio walk-in') : '') +
    (b.payment_reference ? dr('Payment ref', b.payment_reference as string) : '');

  const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#3d1f6e;font-weight:800;">New Booking Received 📋</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#9a7080;">A new <b>${typeLabel}</b> booking just came in.</p>
    ${dtable(rows)}
    <div style="margin-top:20px;text-align:center;">
      <a href="https://beccastouchstudio.vercel.app/admin" style="display:inline-block;background:linear-gradient(135deg,#3d1f6e,#c8788a);color:#fff;text-decoration:none;padding:12px 28px;border-radius:50px;font-weight:700;font-size:14px;">Review in Admin Panel →</a>
    </div>`;

  return shell('', '', body);
}

// Status update (confirmed / rejected / other)
function tplStatusUpdate(b: Record<string,unknown>, note: string) {
  const isConfirmed = (b.status as string) === 'confirmed';
  const isRejected  = (b.status as string) === 'rejected' || (b.status as string) === 'cancelled';
  const headline = isConfirmed ? 'Booking Confirmed! 🎉' : isRejected ? 'Update on Your Booking' : 'Booking Status Updated';
  const statusLabel = isConfirmed ? '✅ Confirmed' : isRejected ? '❌ Not confirmed' : String(b.status || '');
  const trackUrl = `https://osam-74.github.io/beccastouchstudio/track?id=${b.booking_id}`;
  const typeLabel = bookingTypeLabel(b);

  const rows =
    dr('Booking ID', b.booking_id as string) +
    dr('Type', typeLabel) +
    (b.preferred_date ? dr('Date', b.preferred_date as string) : '') +
    (b.start_time ? dr('Time', b.start_time as string) : '') +
    dr('Status', statusLabel) +
    dr('Name', b.client_name as string) +
    dr('Phone', b.phone as string) +
    dr('Email', b.email as string);

  const noteHtml = note ? `<div style="background:#fffbf0;border-radius:12px;border:1px solid #f0e4b8;padding:14px 18px;margin:14px 0;"><p style="margin:0;font-size:13px;color:#6a5020;">${note}</p></div>` : '';

  const confirmedExtra = isConfirmed ? `
    <div style="margin-top:20px;text-align:center;">
      <a href="${trackUrl}" style="display:inline-block;background:linear-gradient(135deg,#3d1f6e,#c8788a);color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:50px;text-decoration:none;">⬇️ Download Your Ticket</a>
      <p style="margin:8px 0 0;font-size:11px;color:#9a7090;">Opens your booking page where you can view and download your confirmed ticket</p>
    </div>
    ${rulesHtml()}
    <div style="margin-top:16px;padding:12px 18px;background:#f0faf5;border-radius:12px;border:1px solid rgba(40,160,100,0.2);">
      <p style="margin:0;font-size:12px;color:#2a6a45;line-height:1.7;">📍 <b>${ADDRESS}</b><br>⏰ Please arrive <b>15 minutes early</b> so we can get you settled.<br>📞 Questions? Call us on <b>${PHONE}</b></p>
    </div>` : '';

  const rejectedExtra = isRejected ? `
    <div style="margin-top:16px;padding:12px 18px;background:#fff4f4;border-radius:12px;border:1px solid rgba(168,64,64,0.15);">
      <p style="margin:0;font-size:13px;color:#7a4040;line-height:1.6;">We are sorry we could not accommodate your booking this time. We would love to find another time — feel free to rebook. You can also reach us on <b>${PHONE}</b>.</p>
    </div>` : '';

  const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#3d1f6e;font-weight:800;">${headline}</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#9a7080;">Hi ${b.client_name}, here is an update on your booking.</p>
    ${dtable(rows)}
    ${noteHtml}
    ${confirmedExtra}
    ${rejectedExtra}
    <p style="font-size:12px;color:#9a7090;margin-top:16px;">Questions? Reply to this email or WhatsApp us on <b>${PHONE}</b>.</p>`;

  return shell('', '', body);
}

async function notifySubmission(fs: Firestore, env: Env, b: Record<string,unknown>): Promise<void> {
  // Pass fs so sendMail can read Brevo config from Firestore
  // Client email
  const clientEmail = (b.email as string || '').trim();
  if (clientEmail) {
    const isBridalOrSpecial = b.occasion === 'bridal' || b.occasion === 'special';
    const isStudio = b.booking_type === 'studio';
    let subject: string;
    if (isStudio) {
      const svcLabel = b.studio_use === 'content' ? 'Content Creation' : 'Photoshoot';
      subject = `${svcLabel} booking received — ${b.booking_id} | ${STUDIO}`;
    } else if (isBridalOrSpecial) {
      subject = `${b.occasion === 'bridal' ? 'Bridal' : 'Special'} request received — ${b.booking_id} | ${STUDIO}`;
    } else {
      subject = `Glam booking received — ${b.booking_id} | ${STUDIO}`;
    }
    try { await sendMail(env, clientEmail, subject, tplSubmitted(b), fs); } catch(e) { console.error('client email:', e); }
  }
  // Admin email
  const adminEmail = await fs.getConfig('smtp_user') || await fs.getConfig('gmail_email') || env.SMTP_USER || '';
  if (adminEmail) {
    const typeLabel = b.booking_type === 'studio' ? (b.studio_use === 'content' ? 'Content Creation' : 'Photoshoot') : String(b.occasion || 'Glam');
    try { await sendMail(env, adminEmail, `[${STUDIO}] New booking — ${b.booking_id} | ${typeLabel}`, tplAdmin(b), fs); } catch(e) { console.error('admin email:', e); }
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {
      const token = await getFirebaseToken(env);
      const projectId = env.FIREBASE_PROJECT_ID || 'beccastouch-studio';
      const fs = new Firestore(token, projectId);
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const action = body.action as string;
      if (!action) return j({ error: 'action required' }, 400);

      // ── saveDraft ───────────────────────────────────────────────────────────
      if (action === 'saveDraft') {
        const p = (body.booking || {}) as Record<string, unknown>;
        if (!p.booking_type) return j({ error: 'booking_type required' }, 400);
        const id = (p.booking_id as string) || bid(p.booking_type as string);
        const ex = p.booking_id ? await findBooking(fs, p.booking_id as string) : null;
        const saved = ex
          ? await fs.update('bookings', ex.id as string, norm(p, id, 'draft', ex))
          : await fs.create('bookings', norm(p, id, 'draft'));
        return j({ ok: true, bookingId: id, booking: toFE(saved) });
      }

      // ── submitBooking ───────────────────────────────────────────────────────
      if (action === 'submitBooking') {
        const p = (body.booking || {}) as Record<string, unknown>;
        if (!p.booking_type || !p.client_name || !p.email || !p.phone)
          return j({ error: 'Missing required fields (booking_type, client_name, email, phone)' }, 400);
        const id = (p.booking_id as string) || bid(p.booking_type as string);
        const ex = p.booking_id ? await findBooking(fs, p.booking_id as string) : null;

        // ── Duplicate guard: prevent double-submit within 60 seconds ──────────
        if (!ex) {
          const recent = await fs.query('bookings', [], '-created_date', 5);
          const phone = String(p.phone || '').replace(/\D/g, '');
          const dupeWindow = Date.now() - 60_000;
          const dupe = recent.find(r => {
            const rPhone = String(r.phone || '').replace(/\D/g, '');
            const rCreated = new Date(r.created_date as string || r._created as string || 0).getTime();
            return rPhone === phone
              && r.booking_type === p.booking_type
              && r.preferred_date === p.preferred_date
              && rCreated > dupeWindow
              && r.status !== 'archived';
          });
          if (dupe) {
            // Return the existing booking instead of creating a duplicate
            console.warn('Duplicate submit blocked for phone:', phone);
            return j({ ok: true, bookingId: dupe.booking_id, booking: toFE(dupe) });
          }
        }

        const saved = ex
          ? await fs.update('bookings', ex.id as string, norm(p, id, 'submitted', ex))
          : await fs.create('bookings', norm(p, id, 'submitted'));
        await notifySubmission(fs, env, saved);
        const updated = await fs.update('bookings', saved.id as string, {
          last_email_sent_at: new Date().toISOString(),
          confirmation_sent: true,
        });
        return j({ ok: true, bookingId: id, booking: toFE(updated) });
      }

      // ── getBooking ──────────────────────────────────────────────────────────
      if (action === 'getBooking') {
        const bid = (body.bookingId || body.booking_id) as string;
        if (!bid) return j({ error: 'Booking ID required' }, 400);
        const b = await findBooking(fs, bid.toUpperCase());
        if (!b) return j({ error: 'Booking not found' }, 404);
        return j({ ok: true, booking: toFE(b) });
      }

      // ── searchBookings ──────────────────────────────────────────────────────
      if (action === 'searchBookings') {
        // No PIN required for client track-booking search
        const q = (
          (body.query as string) || (body.email as string) || (body.phone as string) || (body.q as string) || ''
        ).toLowerCase().trim();
        if (!q) return j({ bookings: [] });
        const all = await fs.query('bookings', [], '-created_date');
        const hits = all.filter(b =>
          [b.booking_id, b.client_name, b.email, b.phone, b.phone?.replace(/\D/g,'')].some(v => String(v || '').toLowerCase().includes(q))
        ).slice(0, 20);
        return j({ ok: true, bookings: hits.map(toFE) });
      }

      // ── adminOverview ───────────────────────────────────────────────────────
      if (action === 'adminOverview') {
        await checkPin(fs, env, body.pin as string);
        const all = await fs.query('bookings', [], '-created_date');
        // Return ALL bookings — frontend filters by tab (archived/active)
        return j({ ok: true, bookings: all.map(toFE), total: all.length });
      }

      // ── resetPin ────────────────────────────────────────────────────────────
      if (action === 'resetPin') {
        await checkPin(fs, env, body.old_pin as string);
        const np = body.new_pin as string;
        if (!np || np.length < 6) return j({ error: 'PIN must be at least 6 characters' }, 400);
        await fs.setConfig('admin_pin', np);
        return j({ ok: true });
      }

      // ── getAdminProfile ─────────────────────────────────────────────────────
      if (action === 'getAdminProfile') {
        await checkPin(fs, env, body.pin as string);
        const profile = await fs.get('config', 'admin_profile') || {};
        const smtpUser = env.SMTP_USER || await fs.getConfig('smtp_user') || '';
        return j({ ok: true, profile, smtp_configured: !!smtpUser, smtp_user: smtpUser });
      }

      // ── saveAdminProfile ────────────────────────────────────────────────────
      if (action === 'saveAdminProfile') {
        await checkPin(fs, env, body.pin as string);
        const p = (body.profile || {}) as Record<string, unknown>;
        await fs.set('config', 'admin_profile', p);
        return j({ ok: true });
      }

      // ── adminUpdateStatus ───────────────────────────────────────────────────
      if (action === 'adminUpdateStatus') {
        await checkPin(fs, env, body.pin as string);
        const bid_val2 = (body.booking_id || body.bookingId) as string;
        const b = await findBooking(fs, bid_val2);
        if (!b) return j({ error: 'Booking not found' }, 404);
        const newStatus = (body.status || body.bookingStatus) as string;
        const updated = await fs.update('bookings', b.id as string, { status: newStatus, booking_status: newStatus, admin_note: (body.note || body.adminNote || '') as string });
        const note = (body.note as string) || '';
        if (b.email) { try { await sendMail(env, b.email as string, `[${STUDIO}] Booking update — ${b.booking_id}`, tplStatusUpdate(updated, note), fs); } catch(e) { console.error('status update email:', e); } }
        return j({ ok: true, booking: toFE(updated) });
      }

      // ── archiveBooking ──────────────────────────────────────────────────────
      if (action === 'archiveBooking') {
        await checkPin(fs, env, body.pin as string);
        const bid_val = (body.booking_id || body.bookingId) as string;
        const b = await findBooking(fs, bid_val);
        if (!b) return j({ error: 'Booking not found' }, 404);
        const updated = await fs.update('bookings', b.id as string, {
          status: 'archived', is_archived: true, archived_at: new Date().toISOString(),
        });
        return j({ ok: true, booking: toFE(updated) });
      }

      // ── restoreBooking ──────────────────────────────────────────────────────
      if (action === 'restoreBooking') {
        await checkPin(fs, env, body.pin as string);
        const bid_val = (body.booking_id || body.bookingId) as string;
        const b = await findBooking(fs, bid_val);
        if (!b) return j({ error: 'Booking not found' }, 404);
        const updated = await fs.update('bookings', b.id as string, {
          status: 'submitted', is_archived: false, archived_at: '',
        });
        return j({ ok: true, booking: toFE(updated) });
      }

      // ── deleteBooking ───────────────────────────────────────────────────────
      if (action === 'deleteBooking') {
        await checkPin(fs, env, body.pin as string);
        const bid_val = (body.booking_id || body.bookingId) as string;
        const b = await findBooking(fs, bid_val);
        if (!b) return j({ error: 'Booking not found' }, 404);
        await fs.delete('bookings', b.id as string);
        return j({ ok: true, deleted: bid_val });
      }

      // ── markAttended ────────────────────────────────────────────────────────
      if (action === 'markAttended') {
        await checkPin(fs, env, body.pin as string);
        const bid_val = (body.booking_id || body.bookingId) as string;
        const b = await findBooking(fs, bid_val);
        if (!b) return j({ error: 'Booking not found' }, 404);
        const updated = await fs.update('bookings', b.id as string, {
          service_attended: true, attended: true, attended_at: new Date().toISOString(),
        });
        return j({ ok: true, booking: toFE(updated) });
      }

      // ── getPublicProducts ───────────────────────────────────────────────────
      if (action === 'getPublicProducts') {
        const list = await fs.query('products', [], '-created_date');
        return j({ ok: true, products: list.filter(p => !p.is_archived) });
      }

      // ── adminGetProducts ────────────────────────────────────────────────────
      if (action === 'adminGetProducts') {
        await checkPin(fs, env, body.pin as string);
        const list = await fs.query('products', [], '-created_date');
        return j({ ok: true, products: list });
      }

      // ── adminSaveProduct ────────────────────────────────────────────────────
      if (action === 'adminSaveProduct') {
        await checkPin(fs, env, body.pin as string);
        const p = (body.product || {}) as Record<string, unknown>;
        if (!p.name) return j({ error: 'Product name required' }, 400);

        // Strip base64 image data — only store URLs (http/https or empty)
        const cleanImage = (v: unknown): string => {
          const s = String(v || '');
          if (s.startsWith('data:')) return ''; // reject base64
          return s;
        };
        if (p.image_url) p.image_url = cleanImage(p.image_url);
        if (Array.isArray(p.images)) {
          p.images = (p.images as unknown[]).map(img => {
            if (typeof img === 'string') return cleanImage(img);
            if (img && typeof img === 'object') {
              const o = img as Record<string,unknown>;
              if (o.url) o.url = cleanImage(o.url);
            }
            return img;
          }).filter(img => img !== '');
        }

        const saved = p.id
          ? await fs.update('products', p.id as string, p)
          : await fs.create('products', p);
        return j({ ok: true, product: saved });
      }

      // ── adminDeleteProduct ──────────────────────────────────────────────────
      if (action === 'adminDeleteProduct') {
        await checkPin(fs, env, body.pin as string);
        await fs.delete('products', body.id as string);
        return j({ ok: true });
      }

      // ── adminGetPricing ─────────────────────────────────────────────────────
      if (action === 'adminGetPricing') {
        await checkPin(fs, env, body.pin as string);
        const config = await fs.get('config', 'pricing') || {};
        return j({ ok: true, pricing: config });
      }

      // ── adminSavePricing ────────────────────────────────────────────────────
      if (action === 'adminSavePricing') {
        await checkPin(fs, env, body.pin as string);
        const pricing = (body.pricing || {}) as Record<string, unknown>;
        await fs.set('config', 'pricing', pricing);
        return j({ ok: true });
      }

      // ── getSmtpStatus ───────────────────────────────────────────────────────
      if (action === 'getSmtpStatus') {
        return j({ ok: true, connected: true, configured: true, email: 'beccastouchstudio@gmail.com', provider: 'Base44 Gmail' });
      }

      // ── saveSmtpConfig — no-op (email via Base44 relay) ────────────────────
      if (action === 'saveSmtpConfig') {
        return j({ ok: true, connected: true, provider: 'Base44 Gmail', message: 'Email is handled via Base44 Gmail relay — no configuration needed.' });
      }

      // ── disconnectSmtp — no-op ────────────────────────────────────────────────
      if (action === 'disconnectSmtp') {
        return j({ ok: true, connected: true, message: 'Email uses Base44 Gmail relay.' });
      }

      // ── testEmail ───────────────────────────────────────────────────────────
      if (action === 'testEmail') {
        await checkPin(fs, env, body.pin as string);
        const to = (body.to as string) || 'beccastouchstudio@gmail.com';
        const override = (body.templateOverride as string) || '';
        const b = (body.booking as Record<string,unknown>) || {};
        const note = (body.note as string) || '';
        let html: string;
        let subject: string;
        if (override === 'submitted') {
          html = tplSubmitted(b);
          const typeLabel = bookingTypeLabel(b);
          subject = `[TEST] ${typeLabel} booking received — ${b.booking_id || 'TEST'} | ${STUDIO}`;
        } else if (override === 'admin') {
          html = tplAdmin(b);
          const typeLabel = bookingTypeLabel(b);
          subject = `[TEST] New booking — ${b.booking_id || 'TEST'} | ${typeLabel} | ${STUDIO}`;
        } else if (override === 'statusUpdate') {
          html = tplStatusUpdate(b, note);
          subject = `[TEST] Booking update — ${b.booking_id || 'TEST'} | ${STUDIO}`;
        } else {
          html = shell('', '', `
            <h2 style="margin:0 0 4px;font-size:20px;color:#3d1f6e;font-weight:800;">Email is working! 🎉</h2>
            <p style="margin:0 0 16px;font-size:13px;color:#9a7080;">Hi there, this is a test email from <b>${STUDIO}</b>.</p>
            <div style="background:#f0faf3;border:1px solid #b8e0c8;border-radius:12px;padding:14px 18px;">
              <p style="margin:0;font-size:13px;color:#3d7a53;font-weight:600;">✅ Email delivery via Base44 Gmail is working correctly.</p>
            </div>`);
          subject = `[${STUDIO}] Test Email ✓`;
        }
        await sendMail(env, to, subject, html, fs);
        return j({ ok: true, message: 'Test email sent', email: to, template: override || 'generic' });
      }

      // ── envCheck ────────────────────────────────────────────────────────────
      if (action === 'envCheck') {
        return j({
          project_id: env.FIREBASE_PROJECT_ID || 'MISSING',
          has_b64_key: !!(env.FIREBASE_PRIVATE_KEY_B64),
          b64_key_length: (env.FIREBASE_PRIVATE_KEY_B64 || '').length,
          email_provider: 'Base44 Gmail relay',
          email_active: true,
        });
      }

      // ── sendReminder ────────────────────────────────────────────────────────
      if (action === 'sendReminder') {
        const b = await findBooking(fs, body.bookingId as string);
        if (!b || !b.email) return j({ error: 'Booking not found or no email' }, 404);
        const reminderRows =
          (b.preferred_date ? dr('Date', b.preferred_date as string) : '') +
          (b.start_time ? dr('Booked time', b.start_time as string) : '') +
          dr('Name', b.client_name as string) +
          dr('Phone', b.phone as string);
        const reminderBody = `
          <h2 style="margin:0 0 4px;font-size:20px;color:#3d1f6e;font-weight:800;">See you in 2 hours! ⏰</h2>
          <p style="margin:0 0 20px;font-size:13px;color:#9a7080;">Hi <b>${b.client_name}</b>! Just a friendly reminder that your session is coming up in 2 hours.</p>
          ${dtable(reminderRows)}
          <p style="font-size:12px;color:#9a7090;margin-top:16px;">📍 <b>${ADDRESS}</b><br>📞 ${PHONE}<br>We cannot wait to see you! 🌸</p>`;
        const reminderHtml = shell('', '', reminderBody);
        try {
          await sendMail(env, b.email as string, `Reminder: your session is in 2 hours — ${b.booking_id} | ${STUDIO}`, reminderHtml);
          return j({ ok: true });
        } catch(e: unknown) { return j({ error: (e as Error).message }, 500); }
      }

      // ── saveShopOrder ────────────────────────────────────────────────────────
      if (action === 'saveShopOrder') {
        const o = (body.order || {}) as Record<string, unknown>;
        if (!o.name || !o.phone) return j({ error: 'Name and phone required' }, 400);
        const orderId = 'ORD-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.random().toString(36).slice(2,5).toUpperCase();
        const saved = await fs.create('shop_orders', {
          order_id: orderId, client_name: o.name, phone: o.phone, email: o.email || '',
          delivery_type: o.delivery_type || 'pickup',
          items: JSON.stringify(o.items || []),
          total_amount: Number(o.total_amount || 0), currency: 'NGN',
          status: 'pending', notes: o.notes || '',
        });
        const adminEmail = await fs.getConfig('smtp_user') || await fs.getConfig('gmail_email') || env.SMTP_USER || '';
        if (adminEmail) {
          const itemRows = ((o.items as Array<{name:string;qty:number;price:number}>) || [])
            .map(i => dr(i.name, `x${i.qty} — NGN ${(i.price*i.qty).toLocaleString()}`)).join('');
          try {
            const shopRows =
              dr('Order ID', orderId) +
              dr('Client', String(o.name)) +
              dr('Phone', String(o.phone)) +
              (o.email ? dr('Email', String(o.email)) : '') +
              dr('Delivery', o.delivery_type === 'home' ? 'Home Delivery' : 'Self Pickup') +
              dr('Total', 'NGN ' + Number(o.total_amount).toLocaleString()) +
              itemRows;
            const shopBody = `
              <h2 style="margin:0 0 4px;font-size:20px;color:#3d1f6e;font-weight:800;">New Shop Order 🛒</h2>
              <p style="margin:0 0 20px;font-size:13px;color:#9a7080;">A new shop order just came in — review below.</p>
              ${dtable(shopRows)}
              <div style="margin-top:20px;text-align:center;">
                <a href="https://beccastouchstudio.vercel.app/admin" style="display:inline-block;background:linear-gradient(135deg,#3d1f6e,#c8788a);color:#fff;text-decoration:none;padding:12px 28px;border-radius:50px;font-weight:700;font-size:14px;">Review in Admin Panel →</a>
              </div>`;
            await sendMail(env, adminEmail, `[${STUDIO}] New shop order — ${orderId}`, shell('', '', shopBody));
          } catch(e) { console.error('shop order admin email:', e); }
        }
        return j({ ok: true, orderId, order: saved });
      }

      // ── adminGetShopOrders ────────────────────────────────────────────────────
      if (action === 'adminGetShopOrders') {
        await checkPin(fs, env, body.pin as string);
        const orders = await fs.query('shop_orders', [], '-created_date');
        return j({ ok: true, orders });
      }

      // ── adminUpdateShopOrder ──────────────────────────────────────────────────
      if (action === 'adminUpdateShopOrder') {
        await checkPin(fs, env, body.pin as string);
        // Use Firestore doc ID directly — avoids composite index requirement
        const docId = body.orderId as string;
        const existing = await fs.get('shop_orders', docId);
        if (!existing) return j({ error: 'Order not found' }, 404);
        const updated = await fs.update('shop_orders', docId, {
          status: body.status as string,
          notes: (body.notes as string) || String(existing.notes || ''),
        });
        return j({ ok: true, order: updated });
      }

      // ── adminDeleteShopOrder ──────────────────────────────────────────────────
      if (action === 'adminDeleteShopOrder') {
        await checkPin(fs, env, body.pin as string);
        // Use Firestore doc ID directly — avoids composite index requirement
        const docId = body.orderId as string;
        const existing = await fs.get('shop_orders', docId);
        if (!existing) return j({ error: 'Order not found' }, 404);
        await fs.delete('shop_orders', docId);
        return j({ ok: true });
      }

      return j({ error: 'Unknown action' }, 400);

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Worker error:', msg);
      return j({ error: msg }, 500);
    }
  }
};
