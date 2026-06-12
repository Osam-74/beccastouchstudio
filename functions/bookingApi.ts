/**
 * Beccastouch Studio — Backend API
 * 100% Firebase (Firestore) + Gmail OAuth2.
 * No Base44 SDK dependency.
 *
 * Firestore collections:
 *   bookings      — booking records
 *   products      — shop products
 *   config        — key/value config (pin, pricing, gmail tokens, etc.)
 *
 * Environment variables (set in Deno Deploy / hosting):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY     (raw PEM, newlines as \n)
 *   GMAIL_CLIENT_ID          (Google OAuth2 client)
 *   GMAIL_CLIENT_SECRET
 */

// ── CORS headers ──────────────────────────────────────────────────────────────
const H = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const j = (data: unknown, s = 200) =>
  new Response(JSON.stringify(data), {
    status: s,
    headers: { 'Content-Type': 'application/json', ...H },
  });

// ── Constants ─────────────────────────────────────────────────────────────────
const STUDIO  = 'Beccastouch Studio';
// Base44 Gmail OAuth email function (replaces broken SMTP/Resend)
const EMAIL_FN = 'https://superagent-36aee876.base44.app/functions/sendBookingEmail';
const ADDRESS = 'Total Filling Station, Oju-Irin Bodija, Ibadan, Oyo State';
const DEFAULT_PIN = '12345678';
const PAYMENT = { bankName: 'First Bank', accountName: 'Beccastouch Studio', accountNumber: '0123456789', currency: 'NGN' };
const PHONE = '+234 802 327 4274';
const TIKTOK = '@beccastouch';
const INSTAGRAM = 'https://www.instagram.com/beccastouch';
const RULES = [
  'Your booking is provisional until payment is verified and the studio confirms your slot.',
  'Keep your booking ID safe — use it to track status or resume your booking.',
  'Arrive at least 15 minutes before your approved session time.',
  'Request date/time changes early so the team can confirm availability.',
  'For home service bookings, your full address must be correct before confirmation.',
  'Please note: all payments are final. We do not offer refunds after payment has been made.',
];

// ── Firebase Admin JWT / Firestore REST ───────────────────────────────────────
async function getServiceAccountToken(): Promise<string> {
  const projectId  = Deno.env.get('FIREBASE_PROJECT_ID') || 'beccastouch-studio';
  // Deno Deploy UI corrupts values containing @ or .com (markdown auto-link bug)
  // Hardcode known-good values directly — these are not secrets
  const clientEmail = 'firebase-adminsdk-fbsvc@beccastouch-studio.iam.gserviceaccount.com';
  const rawKey = Deno.env.get('FIREBASE_PRIVATE_KEY') || '';
  // Support 3 formats:
  // 1. FIREBASE_PRIVATE_KEY_B64 — base64-encoded full PEM (most reliable)
  // 2. Literal \n text (from .env file upload)
  // 3. Already has real newlines
  const b64Key = Deno.env.get('FIREBASE_PRIVATE_KEY_B64') || '';
  let privateKey: string;
  if (b64Key) {
    privateKey = new TextDecoder().decode(Uint8Array.from(atob(b64Key), c => c.charCodeAt(0)));
  } else if (rawKey.includes('\\n')) {
    privateKey = rawKey.replace(/\\n/g, '\n');
  } else {
    privateKey = rawKey;
  }

  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
  };

  const enc = (obj: object) => btoa(JSON.stringify(obj)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const unsigned = `${enc(header)}.${enc(payload)}`;

  // Import RSA key
  const pemBody = privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const jwt = `${unsigned}.${sigB64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error('Firebase auth failed: ' + JSON.stringify(tokenData) + ' | email=' + clientEmail + ' | keyLen=' + privateKey.length + ' | pemOk=' + privateKey.startsWith('-----BEGIN'));
  return tokenData.access_token;
}

// ── Firestore REST helpers ────────────────────────────────────────────────────
function fsVal(v: unknown): Record<string, unknown> {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsVal) } };
  if (typeof v === 'object') {
    const fields: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) fields[k] = fsVal(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function fsToJs(fields: Record<string, unknown>): Record<string, unknown> {
  if (!fields) return {};
  const out: Record<string, unknown> = {};
  for (const [k, fv] of Object.entries(fields)) {
    const f = fv as Record<string, unknown>;
    if ('stringValue'  in f) out[k] = f.stringValue;
    else if ('integerValue'  in f) out[k] = Number(f.integerValue);
    else if ('doubleValue'   in f) out[k] = Number(f.doubleValue);
    else if ('booleanValue'  in f) out[k] = f.booleanValue;
    else if ('nullValue'     in f) out[k] = null;
    else if ('arrayValue'    in f) {
      const av = (f.arrayValue as { values?: unknown[] })?.values || [];
      out[k] = av.map((item) => {
        const itemF = item as Record<string, unknown>;
        if ('mapValue' in itemF) return fsToJs((itemF.mapValue as { fields: Record<string, unknown> }).fields);
        return Object.values(fsToJs({ _: item }))[0];
      });
    }
    else if ('mapValue' in f) out[k] = fsToJs((f.mapValue as { fields: Record<string, unknown> }).fields || {});
    else out[k] = undefined;
  }
  return out;
}

function toFsDoc(data: Record<string, unknown>): { fields: Record<string, unknown> } {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = fsVal(v);
  return { fields };
}

class Firestore {
  token: string;
  project: string;
  base: string;

  constructor(token: string) {
    this.token = token;
    this.project = Deno.env.get('FIREBASE_PROJECT_ID') || '';
    this.base = `https://firestore.googleapis.com/v1/projects/${this.project}/databases/(default)/documents`;
  }

  hdr() { return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }; }

  async get(col: string, id: string): Promise<Record<string, unknown> | null> {
    const r = await fetch(`${this.base}/${col}/${id}`, { headers: this.hdr() });
    if (r.status === 404) return null;
    const d = await r.json();
    if (!d.fields) return null;
    const name = d.name as string;
    return { id: name.split('/').pop(), ...fsToJs(d.fields), _created: d.createTime, _updated: d.updateTime };
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
    const arr = await r.json();
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((d: Record<string, unknown>) => d.document)
      .map((d: Record<string, unknown>) => {
        const doc = d.document as { name: string; fields: Record<string, unknown>; createTime: string; updateTime: string };
        return { id: doc.name.split('/').pop(), ...fsToJs(doc.fields), _created: doc.createTime, _updated: doc.updateTime };
      });
  }

  async create(col: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const now = new Date().toISOString();
    const withTs = { ...data, created_date: now, updated_date: now };
    const r = await fetch(`${this.base}/${col}`, { method: 'POST', headers: this.hdr(), body: JSON.stringify(toFsDoc(withTs)) });
    const d = await r.json();
    if (!d.fields) throw new Error('Firestore create failed: ' + JSON.stringify(d));
    return { id: (d.name as string).split('/').pop(), ...fsToJs(d.fields) };
  }

  async set(col: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const now = new Date().toISOString();
    const withTs = { ...data, updated_date: now };
    const r = await fetch(`${this.base}/${col}/${id}`, {
      method: 'PATCH', headers: this.hdr(), body: JSON.stringify(toFsDoc(withTs)),
    });
    const d = await r.json();
    if (!d.fields) throw new Error('Firestore set failed: ' + JSON.stringify(d));
    return { id, ...fsToJs(d.fields) };
  }

  async update(col: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const now = new Date().toISOString();
    const existing = await this.get(col, id);
    if (!existing) throw new Error(`Document ${col}/${id} not found`);
    const merged = { ...existing, ...data, updated_date: now };
    delete merged._created; delete merged._updated;
    return this.set(col, id, merged);
  }

  async delete(col: string, id: string): Promise<void> {
    await fetch(`${this.base}/${col}/${id}`, { method: 'DELETE', headers: this.hdr() });
  }

  // Partial field update using Firestore updateMask — no prior GET needed (faster)
  async patch(col: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const now = new Date().toISOString();
    const withTs = { ...data, updated_date: now };
    const fields = Object.keys(withTs);
    const mask = fields.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
    const url = `${this.base}/${col}/${id}?${mask}`;
    const r = await fetch(url, { method: 'PATCH', headers: this.hdr(), body: JSON.stringify(toFsDoc(withTs)) });
    const d = await r.json();
    if (!d.fields) throw new Error('Firestore patch failed: ' + JSON.stringify(d));
    return { id, ...fsToJs(d.fields) };
  }

  async getConfig(key: string): Promise<string | null> {
    const doc = await this.get('config', key);
    return doc ? String(doc.value ?? '') : null;
  }

  async setConfig(key: string, value: string): Promise<void> {
    await this.set('config', key, { value });
  }
}

// ── PIN helpers ───────────────────────────────────────────────────────────────
async function getPin(fs: Firestore): Promise<string> {
  return (await fs.getConfig('admin_pin')) || DEFAULT_PIN;
}
async function checkPin(fs: Firestore, pin: string): Promise<void> {
  const stored = (await getPin(fs)).trim();
  const provided = String(pin || '').trim();
  if (!provided || provided !== stored) throw new Error('Invalid PIN');
}

// ── ID generator ──────────────────────────────────────────────────────────────
function bid(bookingType?: string): string {
  const prefix = bookingType === 'glam' ? 'GLM' : bookingType === 'studio' ? 'STU' : 'BK';
  const d = new Date();
  const rand = Math.random().toString(36).slice(2,6).toUpperCase();
  return `${prefix}-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${rand}`;
}

// ── Booking helpers ───────────────────────────────────────────────────────────
const smry = (p: Record<string, unknown>) => {
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
};

const norm = (p: Record<string, unknown>, id: string, flow: string, ex?: Record<string, unknown> | null) => ({
  booking_id: id, booking_type: p.booking_type || '', flow_status: flow,
  booking_status: p.booking_status || (flow === 'submitted' ? 'pending' : (ex?.booking_status as string) || 'draft'),
  client_name: p.client_name || '', phone: p.phone || '', email: p.email || '',
  preferred_date: p.preferred_date || '', start_time: p.start_time || '',
  duration_hours: Number(p.duration_hours || 0) || 0, session_type: p.session_type || '',
  studio_use: p.studio_use || '', group_size: p.group_size ? Number(p.group_size) : 0,
  service_type: p.service_type || '', occasion: p.occasion || '', location_type: p.location_type || 'studio',
  notes: p.notes || '', bridal_wedding_date: p.bridal_wedding_date || '',
  bridal_event_type: p.bridal_event_type || '', bridal_event_location: p.bridal_event_location || '',
  bridal_ready_location: p.bridal_ready_location || '', bridal_event_start_time: p.bridal_event_start_time || '',
  bridal_ready_time: p.bridal_ready_time || '', bridal_bridesmaids: p.bridal_bridesmaids ? Number(p.bridal_bridesmaids) : 0,
  special_request_text: p.special_request_text || '', special_request_audio_url: p.special_request_audio_url || '',
  payment_reference: p.payment_reference || '', payment_receipt_name: p.payment_receipt_name || '',
  payment_receipt_data_url: p.payment_receipt_data_url || '',
  total_amount: Number(p.total_amount || 0) || 0, currency: p.currency || PAYMENT.currency,
  payment_bank_name: PAYMENT.bankName, payment_account_name: PAYMENT.accountName, payment_account_number: PAYMENT.accountNumber,
  client_summary: smry({ ...p, booking_id: id }),
  admin_note: (p.admin_note as string) ?? (ex?.admin_note as string) ?? '',
  confirmation_sent: (p.confirmation_sent as boolean) ?? (ex?.confirmation_sent as boolean) ?? false,
  last_email_sent_at: (p.last_email_sent_at as string) ?? (ex?.last_email_sent_at as string) ?? '',
  reschedule_count: Number((p.reschedule_count as number) ?? (ex?.reschedule_count as number) ?? 0) || 0,
  service_attended: (p.service_attended as boolean) ?? (ex?.service_attended as boolean) ?? false,
  attended_at: (p.attended_at as string) ?? (ex?.attended_at as string) ?? '',
  is_archived: false, archived_at: '',
});

function validate(p: Record<string, unknown>): string[] {
  const m: string[] = [];
  if (!p.booking_type) m.push('booking_type');
  if (!p.client_name)  m.push('client_name');
  if (!p.phone)        m.push('phone');
  if (!p.email)        m.push('email');
  if (p.booking_type === 'studio' && !p.session_type) m.push('session_type');
  return m;
}

async function findBooking(fs: Firestore, bookingId: string): Promise<Record<string, unknown> | null> {
  const r = await fs.query('bookings', [{ field: 'booking_id', op: 'EQUAL', value: bookingId }], '-created_date', 1);
  return r[0] || null;
}

const clean = (b: Record<string, unknown> | null) => b ? ({
  id: b.id, bookingId: b.booking_id, bookingType: b.booking_type, flowStatus: b.flow_status,
  bookingStatus: b.booking_status, clientName: b.client_name, phone: b.phone, email: b.email,
  preferredDate: b.preferred_date, startTime: b.start_time, durationHours: b.duration_hours,
  sessionType: b.session_type, studioUse: b.studio_use, groupSize: b.group_size,
  serviceType: b.service_type, occasion: b.occasion, locationType: b.location_type,
  notes: b.notes, bridalWeddingDate: b.bridal_wedding_date, bridalEventType: b.bridal_event_type,
  bridalEventLocation: b.bridal_event_location, bridalReadyLocation: b.bridal_ready_location,
  bridalEventStartTime: b.bridal_event_start_time, bridalReadyTime: b.bridal_ready_time,
  bridalBridesmaids: b.bridal_bridesmaids, specialRequestText: b.special_request_text,
  specialRequestAudioUrl: b.special_request_audio_url, paymentReference: b.payment_reference,
  paymentReceiptName: b.payment_receipt_name, paymentReceiptUrl: b.payment_receipt_data_url,
  totalAmount: b.total_amount, currency: b.currency, summary: b.client_summary,
  adminNote: b.admin_note, createdAt: b.created_date, updatedAt: b.updated_date,
  rescheduleCount: Number(b.reschedule_count) || 0, isArchived: Boolean(b.is_archived),
  archivedAt: b.archived_at || '', serviceAttended: Boolean(b.service_attended), attendedAt: b.attended_at || '',
}) : null;

// ── SMTP helpers (Gmail App Password) ────────────────────────────────────────
// Uses a minimal SMTP-over-TCP implementation via Deno.connect (no npm dep needed).
// Gmail SMTP: smtp.gmail.com:587 with STARTTLS.

function b64(s: string): string { return btoa(unescape(encodeURIComponent(s))); }

async function smtpSend(opts: {
  host: string; port: number; user: string; pass: string;
  from: string; fromName: string; to: string; subject: string; html: string;
}): Promise<void> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // Helper: read one SMTP response line(s) until 3-digit code without '-'
  async function readReply(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value);
      // SMTP multi-line: lines like "250-..." continue, "250 ..." ends
      const lines = buf.split('\r\n');
      for (const line of lines) {
        if (/^\d{3} /.test(line)) return line;
      }
    }
    return buf;
  }

  // Connect plain TCP first (port 587)
  const conn = await (Deno as any).connect({ hostname: opts.host, port: opts.port, transport: 'tcp' });
  const reader = conn.readable.getReader();
  const writer = conn.writable.getWriter();

  async function send(cmd: string) { await writer.write(enc.encode(cmd + '\r\n')); }
  async function cmd(c: string): Promise<string> { await send(c); return readReply(reader); }

  await readReply(reader); // server greeting
  await cmd(`EHLO client`);
  await cmd('STARTTLS');

  // Upgrade to TLS
  const tlsConn = await (Deno as any).startTls(conn, { hostname: opts.host });
  const tlsReader = tlsConn.readable.getReader();
  const tlsWriter = tlsConn.writable.getWriter();
  async function tlsSend(c: string) { await tlsWriter.write(enc.encode(c + '\r\n')); }
  async function tlsCmd(c: string): Promise<string> { await tlsSend(c); 
    let buf = '';
    while (true) {
      const { value, done } = await tlsReader.read();
      if (done) break;
      buf += dec.decode(value);
      const lines = buf.split('\r\n');
      for (const line of lines) { if (/^\d{3} /.test(line)) return line; }
    }
    return buf;
  }

  await tlsCmd('EHLO client');
  await tlsCmd('AUTH LOGIN');
  await tlsCmd(b64(opts.user));
  const authReply = await tlsCmd(b64(opts.pass));
  if (!authReply.startsWith('235')) throw new Error('SMTP auth failed — check your Gmail address and App Password.');

  await tlsCmd(`MAIL FROM:<${opts.user}>`);
  await tlsCmd(`RCPT TO:<${opts.to}>`);
  await tlsCmd('DATA');

  // Build MIME email
  const boundary = `--bnd${Date.now()}`;
  const msg = [
    `From: ${opts.fromName} <${opts.from}>`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    '',
    opts.html,
    `--${boundary}--`,
    '.',
  ].join('\r\n');

  await tlsSend(msg);
  const dataReply = await (async () => {
    let buf = '';
    while (true) {
      const { value, done } = await tlsReader.read();
      if (done) break;
      buf += dec.decode(value);
      const lines = buf.split('\r\n');
      for (const line of lines) { if (/^\d{3} /.test(line)) return line; }
    }
    return buf;
  })();
  if (!dataReply.startsWith('250')) throw new Error('SMTP send failed: ' + dataReply);

  await tlsCmd('QUIT');
  try { tlsConn.close(); } catch { /* ignore */ }
}

async function sendMail(fs: Firestore, to: string, subject: string, html: string) {
  const rawSmtpUser = Deno.env.get('SMTP_USER') || '';
  const gmailUser = rawSmtpUser.includes('[') ? 'beccastouchstudio@gmail.com' : (rawSmtpUser || await fs.getConfig('smtp_user') || 'beccastouchstudio@gmail.com');
  const appPass   = Deno.env.get('SMTP_PASS') || await fs.getConfig('smtp_pass') || '';
  if (!gmailUser || !appPass)
    throw new Error('Email not configured. Go to Admin → Settings → Email and enter your Gmail address and App Password.');
  await smtpSend({
    host: 'smtp.gmail.com', port: 587,
    user: gmailUser, pass: appPass,
    from: gmailUser, fromName: STUDIO,
    to, subject, html,
  });
}

// ── Email templates ───────────────────────────────────────────────────────────
const shell = (c: string) => `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:0;background:#f3eef8;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f3eef8;padding:32px 16px;"><tr><td align="center"><table width="100%" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;"><tr><td style="background:linear-gradient(135deg,#3d1f6e,#c8788a);padding:28px 32px;"><p style="margin:0 0 4px;font-size:10px;letter-spacing:0.28em;color:rgba(255,255,255,0.7);">BEAUTY · PHOTOGRAPHY · STYLE</p><h1 style="margin:0;font-size:24px;font-weight:800;color:#fff;">${STUDIO}</h1><p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.75);">📍 ${ADDRESS}</p></td></tr><tr><td style="padding:28px 32px;">${c}</td></tr><tr><td style="background:#f8f4ff;padding:16px 32px;border-top:1px solid #ede8f5;"><p style="margin:0;font-size:11px;color:#9a7ab0;text-align:center;">${STUDIO} · ${ADDRESS}</p></td></tr></table></td></tr></table></body></html>`;
const ib  = (id: string) => `<div style="background:#f8f4ff;border-radius:12px;border:1.5px solid #ddd0f5;padding:14px 18px;margin-bottom:20px;"><p style="margin:0 0 2px;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:#9a7ab0;">Booking ID</p><p style="margin:0;font-family:monospace;font-size:18px;font-weight:700;color:#3d1f6e;">${id}</p></div>`;
const dr  = (l: string, v: string) => v ? `<tr><td style="padding:4px 0;font-size:12px;color:#9a7ab0;width:130px;">${l}</td><td style="padding:4px 0;font-size:12px;color:#3d1f6e;font-weight:600;">${v}</td></tr>` : '';
const payHtml   = () => `<div style="background:#f8f4ff;border-radius:12px;border:1px solid #ddd0f5;padding:16px 18px;margin-top:18px;"><p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#3d1f6e;text-transform:uppercase;letter-spacing:0.1em;">Payment details</p><table cellpadding="0" cellspacing="0">${dr('Bank', PAYMENT.bankName)}${dr('Account name', PAYMENT.accountName)}${dr('Account no.', PAYMENT.accountNumber)}</table></div>`;
const rulesHtml = () => `<div style="background:#fdf8ff;border-radius:12px;border:1px solid #ede8f5;padding:16px 18px;margin-top:18px;"><p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#3d1f6e;text-transform:uppercase;letter-spacing:0.1em;">Important notes</p>${RULES.map((r, i) => `<p style="margin:0 0 6px;font-size:12px;color:#7a5090;line-height:1.5;"><b style="color:#c8788a;">${i+1}.</b> ${r}</p>`).join('')}</div>`;

// ── Personalised email templates per booking type ────────────────────────────
function bookingTypeLabel(b: Record<string, unknown>): string {
  if (b.booking_type === 'studio') {
    if (b.studio_use === 'content') return '🎬 Content Creation Session';
    return '📸 Photography / Photoshoot';
  }
  if (b.occasion === 'bridal') return '💍 Bridal Glam';
  if (b.occasion === 'special') return '✨ Special Request Glam';
  const svc = b.service_type === 'makeup+gele' ? 'Makeup + Gele' : b.service_type === 'gele' ? 'Gele' : 'Makeup';
  return `💄 ${svc} — General Glam`;
}

function bookingGreeting(b: Record<string, unknown>): string {
  if (b.booking_type === 'studio' && b.studio_use === 'content') {
    return `Hi <b>${b.client_name}</b>, your content creation session has been received! We're getting the studio ready for you.`;
  }
  if (b.booking_type === 'studio') {
    return `Hi <b>${b.client_name}</b>, your photoshoot booking is in! We'll have the lights, backdrop, and good energy waiting for you.`;
  }
  if (b.occasion === 'bridal') {
    return `Hi <b>${b.client_name}</b>, your bridal glam request has landed safely with us! 💍 This is a special one and we are so honoured to be part of your day.`;
  }
  if (b.occasion === 'special') {
    return `Hi <b>${b.client_name}</b>, your special request has been received! ✨ We'll review and reach out to you shortly.`;
  }
  return `Hi <b>${b.client_name}</b>, your glam booking is in and we are already excited to work on you! 💄`;
}

function confirmGreeting(b: Record<string, unknown>): string {
  if (b.booking_type === 'studio' && b.studio_use === 'content') {
    return `Hi <b>${b.client_name}</b>, your content creation session is confirmed! 🎬 The studio will be set up and ready for you.`;
  }
  if (b.booking_type === 'studio') {
    return `Hi <b>${b.client_name}</b>, your photoshoot is confirmed! 📸 Get ready to look amazing — we'll have everything ready.`;
  }
  if (b.occasion === 'bridal') {
    return `Hi <b>${b.client_name}</b>, your bridal booking is confirmed! 💍 We are so honoured to be part of your special day. See you soon!`;
  }
  return `Hi <b>${b.client_name}</b>, your glam session is confirmed! 💄 We can't wait to meet you!`;
}

function reminderBody(b: Record<string, unknown>): string {
  const isStudio = b.booking_type === 'studio';
  const isContent = isStudio && b.studio_use === 'content';
  if (isContent) {
    return `Your content creation session at ${STUDIO} is in <b>2 hours</b> 🎬<br><br>We're setting up the studio for you. Make sure your content ideas, outfits, and props are ready. See you soon!`;
  }
  if (isStudio) {
    return `Your photoshoot session at ${STUDIO} is in <b>2 hours</b> 📸<br><br>We're getting the studio and equipment ready. Please arrive at least 10–15 minutes early so we can settle in before your slot. Looking forward to creating magic with you!`;
  }
  if (b.occasion === 'bridal') {
    return `Your bridal glam session at ${STUDIO} is in <b>2 hours</b> 💍<br><br>Our artist is already preparing for your special day. Please come with your hair prepped and a top that unbuttons (to avoid smudging your makeup). We are so excited for you!`;
  }
  return `Your glam session at ${STUDIO} is in <b>2 hours</b> 💄<br><br>Our artist will be ready and waiting. Please arrive a few minutes early and come with a clean face if possible. See you soon!`;
}

const tplReceived = (b: Record<string, unknown>) => shell(
  `<h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#3d1f6e;">Booking received ✓</h2>
   <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#c8788a;text-transform:uppercase;letter-spacing:0.1em;">${bookingTypeLabel(b)}</p>
   <p style="margin:0 0 20px;font-size:13px;color:#7a5090;">${bookingGreeting(b)}</p>
   ${ib(b.booking_id as string)}
   <table cellpadding="0" cellspacing="0">
     ${dr('Service', bookingTypeLabel(b))}
     ${dr('Summary', b.client_summary as string || '—')}
     ${b.preferred_date ? dr('Date', b.preferred_date as string) : ''}
     ${b.start_time ? dr('Time', b.start_time as string) : ''}
     ${b.total_amount ? dr('Amount', b.currency + ' ' + Number(b.total_amount).toLocaleString()) : ''}
     ${dr('Status', '⏳ Pending verification')}
   </table>
   ${payHtml()}${rulesHtml()}
   <p style="margin-top:18px;font-size:12px;color:#9a7090;">📍 <b>${ADDRESS}</b> · 📞 ${PHONE}</p>`
);

const tplBridal = (b: Record<string, unknown>) => shell(
  `<h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#3d1f6e;">${b.occasion === 'bridal' ? 'Bridal request received 💍' : 'Special request received ✨'}</h2>
   <p style="margin:0 0 20px;font-size:13px;color:#7a5090;">${bookingGreeting(b)}</p>
   ${ib(b.booking_id as string)}
   <div style="background:#f0faf5;border-radius:12px;border:1px solid rgba(40,160,100,0.2);padding:16px 18px;">
     <p style="margin:0;font-size:13px;color:#2a6a45;line-height:1.6;">Our team will reach out to you shortly to discuss your needs and confirm pricing. Keep your booking ID safe.</p>
   </div>
   <p style="margin-top:16px;font-size:12px;color:#9a7090;">📍 <b>${ADDRESS}</b> · 📞 ${PHONE}</p>`
);

const tplConfirmed = (b: Record<string, unknown>) => shell(
  `<h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#3d1f6e;">You're confirmed! 🎉</h2>
   <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#c8788a;text-transform:uppercase;letter-spacing:0.1em;">${bookingTypeLabel(b)}</p>
   <p style="margin:0 0 20px;font-size:13px;color:#7a5090;">${confirmGreeting(b)}</p>
   ${ib(b.booking_id as string)}
   <div style="background:#f0faf5;border-radius:12px;padding:16px 18px;margin-bottom:16px;">
     <table cellpadding="0" cellspacing="0">
       ${dr('Name', b.client_name as string)}
       ${b.preferred_date ? dr('Date', b.preferred_date as string) : ''}
       ${b.start_time ? dr('Time', b.start_time as string) : ''}
       ${b.total_amount ? dr('Amount', b.currency + ' ' + Number(b.total_amount).toLocaleString()) : ''}
       ${dr('Status', '✅ Confirmed')}
     </table>
   </div>
   ${b.admin_note ? '<div style="background:#fffbf0;border-radius:12px;border:1px solid #f0e4b8;padding:14px 18px;margin-bottom:14px;"><p style="margin:0;font-size:13px;color:#6a5020;">' + b.admin_note + '</p></div>' : ''}
   <div style="background:linear-gradient(135deg,#3d1f6e,#6b3fa0);border-radius:14px;padding:18px 20px;margin:16px 0;text-align:center;">
     <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.15em;">Your Booking Ticket</p>
     <p style="margin:0 0 12px;font-size:13px;color:#fff;">Download and present your ticket at the studio.</p>
     <a href="https://beccastouchstudio.vercel.app/track?id=${b.booking_id}" style="display:inline-block;background:#c8788a;color:#fff;text-decoration:none;padding:10px 24px;border-radius:30px;font-size:13px;font-weight:700;">📥 View &amp; Download Ticket</a>
   </div>
   <p style="font-size:12px;color:#7a5090;">📍 <b>${ADDRESS}</b> — please arrive 15 minutes early. Questions? Call or WhatsApp us on ${PHONE}.</p>`
);

const tplRejected = (b: Record<string, unknown>) => shell(
  `<h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#3d1f6e;">Update on your booking</h2>
   <p style="margin:0 0 20px;font-size:13px;color:#7a5090;">Hi <b>${b.client_name}</b>, unfortunately we are unable to confirm this booking at this time.</p>
   ${ib(b.booking_id as string)}
   ${b.admin_note ? '<div style="background:#fff4f4;border-radius:12px;border:1px solid #f0c8c8;padding:14px 18px;margin-bottom:16px;"><p style="margin:0;font-size:13px;color:#6a2020;">' + b.admin_note + '</p></div>' : ''}
   <div style="background:#fdf8ff;border-radius:12px;border:1px solid #ede8f5;padding:16px 18px;margin-top:14px;">
     <p style="margin:0 0 8px;font-size:13px;color:#3d1f6e;font-weight:700;">Think this is a mistake?</p>
     <p style="margin:0 0 6px;font-size:12px;color:#7a5090;">Please don't hesitate to reach out to us directly:</p>
     <p style="margin:0 0 4px;font-size:12px;color:#3d1f6e;">📞 Call / WhatsApp: <b>${PHONE}</b></p>
     <p style="margin:0;font-size:12px;color:#3d1f6e;">📍 Visit us: <b>${ADDRESS}</b></p>
   </div>
   <p style="margin-top:14px;font-size:12px;color:#9a7090;">We'd love to find another time that works — feel free to book again. 🌸</p>`
);

const tplAdmin = (b: Record<string, unknown>) => shell(
  `<h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#3d1f6e;">New booking — action needed</h2>
   <p style="margin:0 0 16px;font-size:12px;font-weight:700;color:#c8788a;text-transform:uppercase;">${bookingTypeLabel(b)}</p>
   ${ib(b.booking_id as string)}
   <table cellpadding="0" cellspacing="0" style="width:100%;">
     ${dr('Client', b.client_name as string)}
     ${dr('Email', b.email as string)}
     ${dr('Phone', b.phone as string)}
     ${dr('Service', bookingTypeLabel(b))}
     ${dr('Summary', b.client_summary as string || '—')}
     ${b.preferred_date ? dr('Date', b.preferred_date as string) : ''}
     ${b.start_time ? dr('Time', b.start_time as string) : ''}
     ${b.total_amount ? dr('Amount', b.currency + ' ' + Number(b.total_amount).toLocaleString()) : ''}
     ${b.notes ? dr('Notes', b.notes as string) : ''}
   </table>`
);

// ── Reminder template (2 hours before session) ────────────────────────────────
const tplReminder = (b: Record<string, unknown>) => shell(
  `<h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#3d1f6e;">See you in 2 hours! ⏰</h2>
   <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#c8788a;text-transform:uppercase;letter-spacing:0.1em;">${bookingTypeLabel(b)}</p>
   <p style="margin:0 0 20px;font-size:13px;color:#7a5090;">Hi <b>${b.client_name}</b>! Just a friendly reminder:</p>
   <div style="background:#f8f0ff;border-radius:12px;border:1px solid #ddd0f5;padding:16px 18px;margin-bottom:16px;">
     <p style="margin:0;font-size:13px;color:#5a3090;line-height:1.7;">${reminderBody(b)}</p>
   </div>
   ${ib(b.booking_id as string)}
   <table cellpadding="0" cellspacing="0">
     ${b.preferred_date ? dr('Date', b.preferred_date as string) : ''}
     ${b.start_time ? dr('Booked time', b.start_time as string) : ''}
   </table>
   <p style="margin-top:16px;font-size:12px;color:#9a7090;">📍 <b>${ADDRESS}</b> · 📞 ${PHONE}</p>
   <p style="margin-top:8px;font-size:12px;color:#9a7090;">Thank you for choosing ${STUDIO} — we can't wait to see you! 🌸</p>`
);

async function notifySubmission(_fs: Firestore, b: Record<string, unknown>) {
  try {
    const res = await fetch(EMAIL_FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'submitted', booking: b }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) console.log('notifySubmission OK:', JSON.stringify(data));
    else console.error('notifySubmission failed:', res.status, JSON.stringify(data));
  } catch (e: unknown) { console.error('notifySubmission error:', (e as Error).message); }
}

async function notifyDecision(_fs: Firestore, b: Record<string, unknown>) {
  const type = b.booking_status === 'confirmed' ? 'confirmed' : 'rejected';
  try {
    const res = await fetch(EMAIL_FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, booking: b }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) console.log('notifyDecision OK:', JSON.stringify(data));
    else console.error('notifyDecision failed:', res.status, JSON.stringify(data));
  } catch (e: unknown) { console.error('notifyDecision error:', (e as Error).message); }
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: H });
  try {
    const token = await getServiceAccountToken();
    const fs = new Firestore(token);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = body.action as string;
    if (!action) return j({ error: 'action required' }, 400);

    // ── saveDraft ─────────────────────────────────────────────────────────────
    if (action === 'saveDraft') {
      const p = (body.booking || {}) as Record<string, unknown>;
      if (!p.booking_type) return j({ error: 'booking_type required' }, 400);
      const id = (p.booking_id as string) || bid(p.booking_type as string);
      const ex = p.booking_id ? await findBooking(fs, p.booking_id as string) : null;
      let saved: Record<string, unknown>;
      if (ex) saved = await fs.update('bookings', ex.id as string, norm(p, id, 'draft', ex));
      else    saved = await fs.create('bookings', norm(p, id, 'draft'));
      return j({ ok: true, booking: clean(saved), bookingId: id, rules: RULES, payment: PAYMENT });
    }

    // ── submitBooking ─────────────────────────────────────────────────────────
    if (action === 'submitBooking') {
      const p = (body.booking || {}) as Record<string, unknown>;
      const miss = validate(p);
      if (miss.length) return j({ error: `Missing: ${miss.join(', ')}` }, 400);
      const id = (p.booking_id as string) || bid(p.booking_type as string);
      const ex = p.booking_id ? await findBooking(fs, p.booking_id as string) : null;
      let saved: Record<string, unknown>;
      if (ex) saved = await fs.update('bookings', ex.id as string, norm(p, id, 'submitted', ex));
      else    saved = await fs.create('bookings', norm(p, id, 'submitted'));
      await notifySubmission(fs, saved);
      const updated = await fs.update('bookings', saved.id as string, { last_email_sent_at: new Date().toISOString() });
      return j({ ok: true, booking: clean(updated), bookingId: id, rules: RULES, payment: PAYMENT });
    }

    // ── getBooking ────────────────────────────────────────────────────────────
    if (action === 'getBooking') {
      if (!body.bookingId) return j({ error: 'bookingId required' }, 400);
      const b = await findBooking(fs, body.bookingId as string);
      if (!b) return j({ error: 'Booking not found' }, 404);
      return j({ ok: true, booking: clean(b) });
    }

    // ── searchBookings ────────────────────────────────────────────────────────
    if (action === 'searchBookings') {
      // Accept body.query OR body.email OR body.phone (frontend may send either form)
      const q = (
        (body.query as string) || (body.email as string) || (body.phone as string) || ''
      ).toLowerCase().trim();
      if (!q) return j({ bookings: [] });
      const all = await fs.query('bookings', [], '-created_date');
      const hits = all.filter(b =>
        [b.booking_id, b.client_name, b.email, b.phone].some(v => String(v || '').toLowerCase().includes(q))
      ).slice(0, 20);
      return j({ ok: true, bookings: hits.map(clean) });
    }

    // ── adminOverview ─────────────────────────────────────────────────────────
    if (action === 'adminOverview') {
      await checkPin(fs, body.pin as string);
      const all = await fs.query('bookings', [], '-created_date');
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
      const stats = {
        today:    all.filter(b => String(b.created_date || '').slice(0, 10) === today).length,
        thisWeek: all.filter(b => String(b.created_date || '').slice(0, 10) >= weekAgo).length,
        pending:  all.filter(b => b.booking_status === 'pending' && !b.is_archived).length,
      };
      const name = (await fs.getConfig('admin_name')) || 'Admin';
      return j({ ok: true, bookings: all.map(clean), stats, adminProfile: { name } });
    }

    // ── resetPin ──────────────────────────────────────────────────────────────
    if (action === 'resetPin') {
      await checkPin(fs, body.currentPin as string);
      const newPinVal = String(body.newPin || '').trim();
      if (!newPinVal || newPinVal.length < 4) return j({ error: 'New PIN must be at least 4 digits' }, 400);
      if (!/^\d+$/.test(newPinVal)) return j({ error: 'PIN must contain numbers only' }, 400);
      await fs.setConfig('admin_pin', newPinVal);
      return j({ ok: true });
    }

    // ── getAdminProfile ───────────────────────────────────────────────────────
    if (action === 'getAdminProfile') {
      const name = (await fs.getConfig('admin_name')) || 'Admin';
      return j({ ok: true, adminProfile: { name } });
    }

    // ── saveAdminProfile ──────────────────────────────────────────────────────
    if (action === 'saveAdminProfile') {
      await checkPin(fs, body.pin as string);
      await fs.setConfig('admin_name', String(body.name || 'Admin'));
      return j({ ok: true });
    }

    // ── adminUpdateStatus ─────────────────────────────────────────────────────
    if (action === 'adminUpdateStatus') {
      await checkPin(fs, body.pin as string);
      const b = await findBooking(fs, body.bookingId as string);
      if (!b) return j({ error: 'Booking not found' }, 404);
      const patchData: Record<string, unknown> = { booking_status: body.status };
      if (body.adminNote !== undefined) patchData.admin_note = body.adminNote;
      const updated = await fs.patch('bookings', b.id as string, patchData);
      // Merge with existing data for email template
      const full = { ...b, ...updated };
      await notifyDecision(fs, full);
      return j({ ok: true, booking: clean(full) });
    }

    // ── archiveBooking ────────────────────────────────────────────────────────
    if (action === 'archiveBooking') {
      await checkPin(fs, body.pin as string);
      const b = await findBooking(fs, body.bookingId as string);
      if (!b) return j({ error: 'Booking not found' }, 404);
      const updated = await fs.patch('bookings', b.id as string, { is_archived: true, archived_at: new Date().toISOString() });
      return j({ ok: true, booking: clean({ ...b, ...updated }) });
    }

    // ── restoreBooking ────────────────────────────────────────────────────────
    if (action === 'restoreBooking') {
      await checkPin(fs, body.pin as string);
      const b = await findBooking(fs, body.bookingId as string);
      if (!b) return j({ error: 'Booking not found' }, 404);
      const updated = await fs.patch('bookings', b.id as string, { is_archived: false, archived_at: '' });
      return j({ ok: true, booking: clean({ ...b, ...updated }) });
    }

    // ── deleteBooking ─────────────────────────────────────────────────────────
    if (action === 'deleteBooking') {
      await checkPin(fs, body.pin as string);
      const b = await findBooking(fs, body.bookingId as string);
      if (!b) return j({ error: 'Booking not found' }, 404);
      await fs.delete('bookings', b.id as string);
      return j({ ok: true });
    }

    // ── markAttended ──────────────────────────────────────────────────────────
    if (action === 'markAttended') {
      await checkPin(fs, body.pin as string);
      const b = await findBooking(fs, body.bookingId as string);
      if (!b) return j({ error: 'Booking not found' }, 404);
      const updated = await fs.patch('bookings', b.id as string, { service_attended: true, attended_at: new Date().toISOString() });
      return j({ ok: true, booking: clean({ ...b, ...updated }) });
    }

    // ── getPublicProducts ─────────────────────────────────────────────────────
  
  if (action === 'envCheck') {
    const proj = Deno.env.get('FIREBASE_PROJECT_ID') || 'MISSING';
    const email = Deno.env.get('FIREBASE_CLIENT_EMAIL') || 'MISSING';
    const rawKey = Deno.env.get('FIREBASE_PRIVATE_KEY') || '';
    const b64Key = Deno.env.get('FIREBASE_PRIVATE_KEY_B64') || '';
    return new Response(JSON.stringify({
      project_id: proj,
      client_email: email,
      has_raw_key: rawKey.length > 0,
      raw_key_length: rawKey.length,
      has_b64_key: b64Key.length > 0,
      b64_key_length: b64Key.length,
      smtp_user: Deno.env.get('SMTP_USER') || 'MISSING',
      smtp_pass_set: (Deno.env.get('SMTP_PASS') || '').length > 0,
    }), { headers: H });
  }

  if (action === 'debugKey') {
    const raw = Deno.env.get('FIREBASE_PRIVATE_KEY') || '';
    const hasLiteralBackslashN = raw.includes('\\n');
    const hasRealNewline = raw.includes('\n');
    const length = raw.length;
    const first50 = raw.substring(0, 50);
    const last20 = raw.substring(raw.length - 20);
    return new Response(JSON.stringify({
      length, hasLiteralBackslashN, hasRealNewline, first50, last20
    }), { headers: H });
  }

  if (action === 'getPublicProducts') {
      const list = await fs.query('products', [], '-created_date');
      return j({ ok: true, products: list.filter((p) => !p.is_archived) });
    }

    // ── adminGetProducts ──────────────────────────────────────────────────────
    if (action === 'adminGetProducts') {
      await checkPin(fs, body.pin as string);
      const list = await fs.query('products', [], '-created_date');
      return j({ ok: true, products: list });
    }

    // ── adminSaveProduct ──────────────────────────────────────────────────────
    if (action === 'adminSaveProduct') {
      await checkPin(fs, body.pin as string);
      const p = (body.product || {}) as Record<string, unknown>;
      if (!p.name) return j({ error: 'Product name required' }, 400);
      const data = {
        name: p.name, description: p.description || '', price: Number(p.price || 0),
        sale_price: (p.sale_price !== undefined && p.sale_price !== null && String(p.sale_price) !== '') ? Number(p.sale_price) : null,
        category: p.category || 'Other', in_stock: Boolean(p.in_stock !== false),
        image_url: p.image_url || '', images: Array.isArray(p.images) ? p.images : [],
        whatsapp_order: Boolean(p.whatsapp_order !== false), is_archived: Boolean(p.is_archived),
      };
      let saved: Record<string, unknown>;
      if (p.id) saved = await fs.update('products', p.id as string, data);
      else      saved = await fs.create('products', data);
      return j({ ok: true, product: saved });
    }

    // ── adminDeleteProduct ────────────────────────────────────────────────────
    if (action === 'adminDeleteProduct') {
      await checkPin(fs, body.pin as string);
      if (!body.productId) return j({ error: 'productId required' }, 400);
      await fs.delete('products', body.productId as string);
      return j({ ok: true });
    }

    // ── adminGetPricing ───────────────────────────────────────────────────────
    if (action === 'adminGetPricing') {
      await checkPin(fs, body.pin as string);
      const raw = await fs.getConfig('pricing');
      const pricing = raw ? JSON.parse(raw) : {};
      return j({ ok: true, pricing });
    }

    // ── adminSavePricing ──────────────────────────────────────────────────────
    if (action === 'adminSavePricing') {
      await checkPin(fs, body.pin as string);
      const existing = await fs.getConfig('pricing');
      const current = existing ? JSON.parse(existing) : {};
      const updated = { ...current, [body.key as string]: body.value };
      await fs.setConfig('pricing', JSON.stringify(updated));
      return j({ ok: true });
    }

    // ── Email (SMTP/App Password) setup actions ──────────────────────────────
    // saveSmtpConfig: store Gmail address + App Password in Firestore
    if (action === 'saveSmtpConfig') {
      await checkPin(fs, body.pin as string);
      const smtpUser = (body.smtpUser as string || '').trim();
      const smtpPass = (body.smtpPass as string || '').trim();
      if (!smtpUser || !smtpPass) return j({ error: 'Gmail address and App Password are required' }, 400);
      if (!smtpUser.includes('@')) return j({ error: 'Enter a valid Gmail address' }, 400);
      if (smtpPass.replace(/\s/g,'').length !== 16) return j({ error: 'App Password must be 16 characters (no spaces)' }, 400);
      await fs.setConfig('smtp_user', smtpUser);
      await fs.setConfig('smtp_pass', smtpPass.replace(/\s/g,''));
      return j({ ok: true, email: smtpUser });
    }

    // getSmtpStatus: returns connection status (never exposes the password)
    if (action === 'getSmtpStatus') {
      await checkPin(fs, body.pin as string);
      const email   = Deno.env.get('SMTP_USER') || await fs.getConfig('smtp_user') || '';
      const hasPass = !!(Deno.env.get('SMTP_PASS') || await fs.getConfig('smtp_pass'));
      return j({ ok: true, connected: !!(email && hasPass), email });
    }

    // disconnectSmtp: clear stored credentials
    if (action === 'disconnectSmtp') {
      await checkPin(fs, body.pin as string);
      await fs.setConfig('smtp_user', '');
      await fs.setConfig('smtp_pass', '');
      return j({ ok: true });
    }

    // testEmail: send a test email to the admin
    if (action === 'testEmail') {
      await checkPin(fs, body.pin as string);
      const email = Deno.env.get('SMTP_USER') || await fs.getConfig('smtp_user') || '';
      if (!email) return j({ error: 'Email not configured yet.' }, 400);
      await sendMail(fs, email,
        `Test email from ${STUDIO}`,
        shell(`<h2 style="color:#3d1f6e;margin:0 0 12px;">✅ Email is working!</h2><p style="color:#7a5090;font-size:13px;">Your Gmail App Password is configured correctly. All booking notifications will send from <b>${email}</b>.</p>`)
      );
      return j({ ok: true, email });
    }

    // ── sendReminder ──────────────────────────────────────────────────────────
    if (action === 'sendReminder') {
      const b = await findBooking(fs, body.bookingId as string);
      if (!b || !b.email) return j({ error: 'Booking not found or no email' }, 404);
      try {
        await sendMail(fs, b.email as string,
          `Reminder: your session is in 2 hours — ${b.booking_id} | ${STUDIO}`,
          tplReminder(b));
        return j({ ok: true });
      } catch(e: unknown) { return j({ error: (e as Error).message }, 500); }
    }

    // ── saveShopOrder ─────────────────────────────────────────────────────────
    if (action === 'saveShopOrder') {
      const o = (body.order || {}) as Record<string, unknown>;
      if (!o.name || !o.phone) return j({ error: 'Name and phone required' }, 400);
      const orderId = 'ORD-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.random().toString(36).slice(2,5).toUpperCase();
      const saved = await fs.create('shop_orders', {
        order_id: orderId, client_name: o.name || '', phone: o.phone || '',
        email: o.email || '', delivery_type: o.delivery_type || 'pickup',
        items: JSON.stringify(o.items || []), total_amount: Number(o.total_amount || 0),
        currency: 'NGN', status: 'pending', notes: o.notes || '',
      });
      const adminEmail = await fs.getConfig('smtp_user') || await fs.getConfig('gmail_email') || '';
      if (adminEmail) {
        const itemRows = (o.items as Array<{name:string;qty:number;price:number}> || [])
          .map(i => dr(i.name, `x${i.qty} — NGN ${(i.price*i.qty).toLocaleString()}`)).join('');
        try {
          await sendMail(fs, adminEmail, `[${STUDIO}] New shop order — ${orderId}`,
            shell(`<h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#3d1f6e;">New shop order 🛒</h2>
              <table cellpadding="0" cellspacing="0" style="width:100%;">
                ${dr('Order ID', orderId)}${dr('Client', String(o.name))}${dr('Phone', String(o.phone))}
                ${o.email ? dr('Email', String(o.email)) : ''}
                ${dr('Delivery', o.delivery_type === 'home' ? 'Home Delivery' : 'Self Pickup')}
                ${dr('Total', 'NGN ' + Number(o.total_amount).toLocaleString())}
              </table>
              <div style="margin-top:16px;padding:14px 18px;background:#f8f4ff;border-radius:12px;">
                <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#3d1f6e;text-transform:uppercase;">Items ordered</p>
                <table cellpadding="0" cellspacing="0">${itemRows}</table>
              </div>`));
        } catch(e: unknown) { console.error('shop order admin email:', (e as Error).message); }
      }
      return j({ ok: true, orderId, order: saved });
    }

    // ── adminGetShopOrders ────────────────────────────────────────────────────
    if (action === 'adminGetShopOrders') {
      await checkPin(fs, body.pin as string);
      const orders = await fs.query('shop_orders', [], '-created_date');
      return j({ ok: true, orders });
    }

    // ── adminUpdateShopOrder ──────────────────────────────────────────────────
    if (action === 'adminUpdateShopOrder') {
      await checkPin(fs, body.pin as string);
      // Use Firestore doc ID directly to avoid composite index requirement
      const docId = body.orderId as string;
      const existing = await fs.get('shop_orders', docId);
      if (!existing) return j({ error: 'Order not found' }, 404);
      const updated = await fs.update('shop_orders', docId, { status: body.status as string, notes: (body.notes as string) || String(existing.notes || '') });
      return j({ ok: true, order: updated });
    }

    // ── adminDeleteShopOrder ──────────────────────────────────────────────────
    if (action === 'adminDeleteShopOrder') {
      await checkPin(fs, body.pin as string);
      // Use Firestore doc ID directly to avoid composite index requirement
      const docId = body.orderId as string;
      const existing = await fs.get('shop_orders', docId);
      if (!existing) return j({ error: 'Order not found' }, 404);
      await fs.delete('shop_orders', docId);
      return j({ ok: true });
    }

    return j({ error: 'Unknown action' }, 400);
  } catch (e: unknown) {
    console.error(e);
    return j({ error: (e as Error).message || 'Internal error' }, 500);
  }
});
