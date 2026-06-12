// beccastouchstudio/functions/bookingApi.ts
var H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
var j = (data, s = 200) => new Response(JSON.stringify(data), {
  status: s,
  headers: { "Content-Type": "application/json", ...H }
});
var STUDIO = "Beccastouch Studio";
var ADDRESS = "Total Filling Station, Oju-Irin Bodija, Ibadan, Oyo State";
var DEFAULT_PIN = "12345678";
var PAYMENT = { bankName: "First Bank", accountName: "Beccastouch Studio", accountNumber: "0123456789", currency: "NGN" };
var PHONE = "+234 802 327 4274";
var RULES = [
  "Your booking is provisional until payment is verified and the studio confirms your slot.",
  "Keep your booking ID safe \u2014 use it to track status or resume your booking.",
  "Arrive at least 15 minutes before your approved session time.",
  "Request date/time changes early so the team can confirm availability.",
  "For home service bookings, your full address must be correct before confirmation.",
  "Please note: all payments are final. We do not offer refunds after payment has been made."
];
async function getServiceAccountToken() {
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID") || "beccastouch-studio";
  const clientEmail = "firebase-adminsdk-fbsvc@beccastouch-studio.iam.gserviceaccount.com";
  const rawKey = Deno.env.get("FIREBASE_PRIVATE_KEY") || "";
  const b64Key = Deno.env.get("FIREBASE_PRIVATE_KEY_B64") || "";
  let privateKey;
  if (b64Key) {
    privateKey = new TextDecoder().decode(Uint8Array.from(atob(b64Key), (c) => c.charCodeAt(0)));
  } else if (rawKey.includes("\\n")) {
    privateKey = rawKey.replace(/\\n/g, "\n");
  } else {
    privateKey = rawKey;
  }
  const now = Math.floor(Date.now() / 1e3);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform"
  };
  const enc = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsigned = `${enc(header)}.${enc(payload)}`;
  const pemBody = privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, "");
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${unsigned}.${sigB64}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Firebase auth failed: " + JSON.stringify(tokenData) + " | email=" + clientEmail + " | keyLen=" + privateKey.length + " | pemOk=" + privateKey.startsWith("-----BEGIN"));
  return tokenData.access_token;
}
function fsVal(v) {
  if (v === null || v === void 0) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsVal) } };
  if (typeof v === "object") {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = fsVal(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}
function fsToJs(fields) {
  if (!fields) return {};
  const out = {};
  for (const [k, fv] of Object.entries(fields)) {
    const f = fv;
    if ("stringValue" in f) out[k] = f.stringValue;
    else if ("integerValue" in f) out[k] = Number(f.integerValue);
    else if ("doubleValue" in f) out[k] = Number(f.doubleValue);
    else if ("booleanValue" in f) out[k] = f.booleanValue;
    else if ("nullValue" in f) out[k] = null;
    else if ("arrayValue" in f) {
      const av = f.arrayValue?.values || [];
      out[k] = av.map((item) => {
        const itemF = item;
        if ("mapValue" in itemF) return fsToJs(itemF.mapValue.fields);
        return Object.values(fsToJs({ _: item }))[0];
      });
    } else if ("mapValue" in f) out[k] = fsToJs(f.mapValue.fields || {});
    else out[k] = void 0;
  }
  return out;
}
function toFsDoc(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) fields[k] = fsVal(v);
  return { fields };
}
var Firestore = class {
  token;
  project;
  base;
  constructor(token) {
    this.token = token;
    this.project = Deno.env.get("FIREBASE_PROJECT_ID") || "";
    this.base = `https://firestore.googleapis.com/v1/projects/${this.project}/databases/(default)/documents`;
  }
  hdr() {
    return { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" };
  }
  async get(col, id) {
    const r = await fetch(`${this.base}/${col}/${id}`, { headers: this.hdr() });
    if (r.status === 404) return null;
    const d = await r.json();
    if (!d.fields) return null;
    const name = d.name;
    return { id: name.split("/").pop(), ...fsToJs(d.fields), _created: d.createTime, _updated: d.updateTime };
  }
  async query(col, filters = [], orderField, limit = 500) {
    const body = {
      structuredQuery: {
        from: [{ collectionId: col }],
        ...filters.length ? {
          where: filters.length === 1 ? { fieldFilter: { field: { fieldPath: filters[0].field }, op: filters[0].op, value: fsVal(filters[0].value) } } : { compositeFilter: { op: "AND", filters: filters.map((f) => ({ fieldFilter: { field: { fieldPath: f.field }, op: f.op, value: fsVal(f.value) } })) } }
        } : {},
        ...orderField ? { orderBy: [{ field: { fieldPath: orderField.replace("-", "") }, direction: orderField.startsWith("-") ? "DESCENDING" : "ASCENDING" }] } : {},
        limit
      }
    };
    const r = await fetch(`${this.base}:runQuery`, {
      method: "POST",
      headers: this.hdr(),
      body: JSON.stringify(body)
    });
    const arr = await r.json();
    if (!Array.isArray(arr)) return [];
    return arr.filter((d) => d.document).map((d) => {
      const doc = d.document;
      return { id: doc.name.split("/").pop(), ...fsToJs(doc.fields), _created: doc.createTime, _updated: doc.updateTime };
    });
  }
  async create(col, data) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const withTs = { ...data, created_date: now, updated_date: now };
    const r = await fetch(`${this.base}/${col}`, { method: "POST", headers: this.hdr(), body: JSON.stringify(toFsDoc(withTs)) });
    const d = await r.json();
    if (!d.fields) throw new Error("Firestore create failed: " + JSON.stringify(d));
    return { id: d.name.split("/").pop(), ...fsToJs(d.fields) };
  }
  async set(col, id, data) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const withTs = { ...data, updated_date: now };
    const r = await fetch(`${this.base}/${col}/${id}`, {
      method: "PATCH",
      headers: this.hdr(),
      body: JSON.stringify(toFsDoc(withTs))
    });
    const d = await r.json();
    if (!d.fields) throw new Error("Firestore set failed: " + JSON.stringify(d));
    return { id, ...fsToJs(d.fields) };
  }
  async update(col, id, data) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = await this.get(col, id);
    if (!existing) throw new Error(`Document ${col}/${id} not found`);
    const merged = { ...existing, ...data, updated_date: now };
    delete merged._created;
    delete merged._updated;
    return this.set(col, id, merged);
  }
  async delete(col, id) {
    await fetch(`${this.base}/${col}/${id}`, { method: "DELETE", headers: this.hdr() });
  }
  // Partial field update using Firestore updateMask — no prior GET needed (faster)
  async patch(col, id, data) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const withTs = { ...data, updated_date: now };
    const fields = Object.keys(withTs);
    const mask = fields.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&");
    const url = `${this.base}/${col}/${id}?${mask}`;
    const r = await fetch(url, { method: "PATCH", headers: this.hdr(), body: JSON.stringify(toFsDoc(withTs)) });
    const d = await r.json();
    if (!d.fields) throw new Error("Firestore patch failed: " + JSON.stringify(d));
    return { id, ...fsToJs(d.fields) };
  }
  async getConfig(key) {
    const doc = await this.get("config", key);
    return doc ? String(doc.value ?? "") : null;
  }
  async setConfig(key, value) {
    await this.set("config", key, { value });
  }
};
async function getPin(fs) {
  return await fs.getConfig("admin_pin") || DEFAULT_PIN;
}
async function checkPin(fs, pin) {
  if (!pin || pin !== await getPin(fs)) throw new Error("Invalid PIN");
}
function bid(bookingType) {
  const prefix = bookingType === "glam" ? "GLM" : bookingType === "studio" ? "STU" : "BK";
  const d = /* @__PURE__ */ new Date();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${rand}`;
}
var smry = (p) => {
  if (p.booking_type === "studio") {
    const use = String(p.studio_use || "photoshoot");
    const sess = String(p.session_type || "single");
    const dur = p.duration_hours ? `${p.duration_hours}h` : "";
    return `${use === "content" ? "Content Creation" : "Photoshoot"} \xB7 ${sess === "group" ? "Group" : "Single"}${dur ? " \xB7 " + dur : ""} \xB7 ${p.preferred_date || "TBD"}`;
  }
  if (p.occasion === "bridal") return `Bridal Glam \xB7 ${p.bridal_wedding_date || p.preferred_date || "TBD"}`;
  if (p.occasion === "special") return `Special Request \xB7 ${p.preferred_date || "TBD"}`;
  const svc = p.service_type === "makeup+gele" ? "Makeup + Gele" : p.service_type === "gele" ? "Gele Only" : "Makeup Only";
  return `${svc} \xB7 General Glam \xB7 ${p.preferred_date || "TBD"}`;
};
var norm = (p, id, flow, ex) => ({
  booking_id: id,
  booking_type: p.booking_type || "",
  flow_status: flow,
  booking_status: p.booking_status || (flow === "submitted" ? "pending" : ex?.booking_status || "draft"),
  client_name: p.client_name || "",
  phone: p.phone || "",
  email: p.email || "",
  preferred_date: p.preferred_date || "",
  start_time: p.start_time || "",
  duration_hours: Number(p.duration_hours || 0) || 0,
  session_type: p.session_type || "",
  studio_use: p.studio_use || "",
  group_size: p.group_size ? Number(p.group_size) : 0,
  service_type: p.service_type || "",
  occasion: p.occasion || "",
  location_type: p.location_type || "studio",
  notes: p.notes || "",
  bridal_wedding_date: p.bridal_wedding_date || "",
  bridal_event_type: p.bridal_event_type || "",
  bridal_event_location: p.bridal_event_location || "",
  bridal_ready_location: p.bridal_ready_location || "",
  bridal_event_start_time: p.bridal_event_start_time || "",
  bridal_ready_time: p.bridal_ready_time || "",
  bridal_bridesmaids: p.bridal_bridesmaids ? Number(p.bridal_bridesmaids) : 0,
  special_request_text: p.special_request_text || "",
  special_request_audio_url: p.special_request_audio_url || "",
  payment_reference: p.payment_reference || "",
  payment_receipt_name: p.payment_receipt_name || "",
  payment_receipt_data_url: p.payment_receipt_data_url || "",
  total_amount: Number(p.total_amount || 0) || 0,
  currency: p.currency || PAYMENT.currency,
  payment_bank_name: PAYMENT.bankName,
  payment_account_name: PAYMENT.accountName,
  payment_account_number: PAYMENT.accountNumber,
  client_summary: smry({ ...p, booking_id: id }),
  admin_note: p.admin_note ?? ex?.admin_note ?? "",
  confirmation_sent: p.confirmation_sent ?? ex?.confirmation_sent ?? false,
  last_email_sent_at: p.last_email_sent_at ?? ex?.last_email_sent_at ?? "",
  reschedule_count: Number(p.reschedule_count ?? ex?.reschedule_count ?? 0) || 0,
  service_attended: p.service_attended ?? ex?.service_attended ?? false,
  attended_at: p.attended_at ?? ex?.attended_at ?? "",
  is_archived: false,
  archived_at: ""
});
function validate(p) {
  const m = [];
  if (!p.booking_type) m.push("booking_type");
  if (!p.client_name) m.push("client_name");
  if (!p.phone) m.push("phone");
  if (!p.email) m.push("email");
  if (p.booking_type === "studio" && !p.session_type) m.push("session_type");
  return m;
}
async function findBooking(fs, bookingId) {
  const r = await fs.query("bookings", [{ field: "booking_id", op: "EQUAL", value: bookingId }], "-created_date", 1);
  return r[0] || null;
}
var clean = (b) => b ? {
  id: b.id,
  bookingId: b.booking_id,
  bookingType: b.booking_type,
  flowStatus: b.flow_status,
  bookingStatus: b.booking_status,
  clientName: b.client_name,
  phone: b.phone,
  email: b.email,
  preferredDate: b.preferred_date,
  startTime: b.start_time,
  durationHours: b.duration_hours,
  sessionType: b.session_type,
  studioUse: b.studio_use,
  groupSize: b.group_size,
  serviceType: b.service_type,
  occasion: b.occasion,
  locationType: b.location_type,
  notes: b.notes,
  bridalWeddingDate: b.bridal_wedding_date,
  bridalEventType: b.bridal_event_type,
  bridalEventLocation: b.bridal_event_location,
  bridalReadyLocation: b.bridal_ready_location,
  bridalEventStartTime: b.bridal_event_start_time,
  bridalReadyTime: b.bridal_ready_time,
  bridalBridesmaids: b.bridal_bridesmaids,
  specialRequestText: b.special_request_text,
  specialRequestAudioUrl: b.special_request_audio_url,
  paymentReference: b.payment_reference,
  paymentReceiptName: b.payment_receipt_name,
  paymentReceiptUrl: b.payment_receipt_data_url,
  totalAmount: b.total_amount,
  currency: b.currency,
  summary: b.client_summary,
  adminNote: b.admin_note,
  createdAt: b.created_date,
  updatedAt: b.updated_date,
  rescheduleCount: Number(b.reschedule_count) || 0,
  isArchived: Boolean(b.is_archived),
  archivedAt: b.archived_at || "",
  serviceAttended: Boolean(b.service_attended),
  attendedAt: b.attended_at || ""
} : null;
// ── Email via Base44 Gmail OAuth relay ────────────────────────────────────────
const GMAIL_RELAY_URL = "https://api.base44.com/api/apps/6a2b0fd46df8ce19f5241af5/functions/sendGmailEmail";
const MAIL_SECRET = Deno.env.get("BECCA_MAIL_SECRET") || "beccastouch_mail_2026";

async function sendMail(_fs, to, subject, html) {
  const res = await fetch(GMAIL_RELAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: MAIL_SECRET, to, subject, html }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("Gmail relay error:", res.status, errText, "| to:", to);
    throw new Error(`Email send failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  console.log("Email sent via Gmail OAuth to:", to, "| messageId:", data.messageId);
}
var shell = (c) => `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:0;background:#f3eef8;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f3eef8;padding:32px 16px;"><tr><td align="center"><table width="100%" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;"><tr><td style="background:linear-gradient(135deg,#3d1f6e,#c8788a);padding:28px 32px;"><p style="margin:0 0 4px;font-size:10px;letter-spacing:0.28em;color:rgba(255,255,255,0.7);">BEAUTY \xB7 PHOTOGRAPHY \xB7 STYLE</p><h1 style="margin:0;font-size:24px;font-weight:800;color:#fff;">${STUDIO}</h1><p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.75);">\u{1F4CD} ${ADDRESS}</p></td></tr><tr><td style="padding:28px 32px;">${c}</td></tr><tr><td style="background:#f8f4ff;padding:16px 32px;border-top:1px solid #ede8f5;"><p style="margin:0;font-size:11px;color:#9a7ab0;text-align:center;">${STUDIO} \xB7 ${ADDRESS}</p></td></tr></table></td></tr></table></body></html>`;
var ib = (id) => `<div style="background:#f8f4ff;border-radius:12px;border:1.5px solid #ddd0f5;padding:14px 18px;margin-bottom:20px;"><p style="margin:0 0 2px;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:#9a7ab0;">Booking ID</p><p style="margin:0;font-family:monospace;font-size:18px;font-weight:700;color:#3d1f6e;">${id}</p></div>`;
var dr = (l, v) => v ? `<tr><td style="padding:4px 0;font-size:12px;color:#9a7ab0;width:130px;">${l}</td><td style="padding:4px 0;font-size:12px;color:#3d1f6e;font-weight:600;">${v}</td></tr>` : "";
var payHtml = () => `<div style="background:#f8f4ff;border-radius:12px;border:1px solid #ddd0f5;padding:16px 18px;margin-top:18px;"><p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#3d1f6e;text-transform:uppercase;letter-spacing:0.1em;">Payment details</p><table cellpadding="0" cellspacing="0">${dr("Bank", PAYMENT.bankName)}${dr("Account name", PAYMENT.accountName)}${dr("Account no.", PAYMENT.accountNumber)}</table></div>`;
var rulesHtml = () => `<div style="background:#fdf8ff;border-radius:12px;border:1px solid #ede8f5;padding:16px 18px;margin-top:18px;"><p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#3d1f6e;text-transform:uppercase;letter-spacing:0.1em;">Important notes</p>${RULES.map((r, i) => `<p style="margin:0 0 6px;font-size:12px;color:#7a5090;line-height:1.5;"><b style="color:#c8788a;">${i + 1}.</b> ${r}</p>`).join("")}</div>`;
function bookingTypeLabel(b) {
  if (b.booking_type === "studio") {
    if (b.studio_use === "content") return "\u{1F3AC} Content Creation Session";
    return "\u{1F4F8} Photography / Photoshoot";
  }
  if (b.occasion === "bridal") return "\u{1F48D} Bridal Glam";
  if (b.occasion === "special") return "\u2728 Special Request Glam";
  const svc = b.service_type === "makeup+gele" ? "Makeup + Gele" : b.service_type === "gele" ? "Gele" : "Makeup";
  return `\u{1F484} ${svc} \u2014 General Glam`;
}
function bookingGreeting(b) {
  if (b.booking_type === "studio" && b.studio_use === "content") {
    return `Hi <b>${b.client_name}</b>, your content creation session has been received! We're getting the studio ready for you.`;
  }
  if (b.booking_type === "studio") {
    return `Hi <b>${b.client_name}</b>, your photoshoot booking is in! We'll have the lights, backdrop, and good energy waiting for you.`;
  }
  if (b.occasion === "bridal") {
    return `Hi <b>${b.client_name}</b>, your bridal glam request has landed safely with us! \u{1F48D} This is a special one and we are so honoured to be part of your day.`;
  }
  if (b.occasion === "special") {
    return `Hi <b>${b.client_name}</b>, your special request has been received! \u2728 We'll review and reach out to you shortly.`;
  }
  return `Hi <b>${b.client_name}</b>, your glam booking is in and we are already excited to work on you! \u{1F484}`;
}
function confirmGreeting(b) {
  if (b.booking_type === "studio" && b.studio_use === "content") {
    return `Hi <b>${b.client_name}</b>, your content creation session is confirmed! \u{1F3AC} The studio will be set up and ready for you.`;
  }
  if (b.booking_type === "studio") {
    return `Hi <b>${b.client_name}</b>, your photoshoot is confirmed! \u{1F4F8} Get ready to look amazing \u2014 we'll have everything ready.`;
  }
  if (b.occasion === "bridal") {
    return `Hi <b>${b.client_name}</b>, your bridal booking is confirmed! \u{1F48D} We are so honoured to be part of your special day. See you soon!`;
  }
  return `Hi <b>${b.client_name}</b>, your glam session is confirmed! \u{1F484} We can't wait to meet you!`;
}
function reminderBody(b) {
  const isStudio = b.booking_type === "studio";
  const isContent = isStudio && b.studio_use === "content";
  if (isContent) {
    return `Your content creation session at ${STUDIO} is in <b>2 hours</b> \u{1F3AC}<br><br>We're setting up the studio for you. Make sure your content ideas, outfits, and props are ready. See you soon!`;
  }
  if (isStudio) {
    return `Your photoshoot session at ${STUDIO} is in <b>2 hours</b> \u{1F4F8}<br><br>We're getting the studio and equipment ready. Please arrive at least 10\u201315 minutes early so we can settle in before your slot. Looking forward to creating magic with you!`;
  }
  if (b.occasion === "bridal") {
    return `Your bridal glam session at ${STUDIO} is in <b>2 hours</b> \u{1F48D}<br><br>Our artist is already preparing for your special day. Please come with your hair prepped and a top that unbuttons (to avoid smudging your makeup). We are so excited for you!`;
  }
  return `Your glam session at ${STUDIO} is in <b>2 hours</b> \u{1F484}<br><br>Our artist will be ready and waiting. Please arrive a few minutes early and come with a clean face if possible. See you soon!`;
}
var tplReceived = (b) => shell(
  `<h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#3d1f6e;">Booking received \u2713</h2>
   <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#c8788a;text-transform:uppercase;letter-spacing:0.1em;">${bookingTypeLabel(b)}</p>
   <p style="margin:0 0 20px;font-size:13px;color:#7a5090;">${bookingGreeting(b)}</p>
   ${ib(b.booking_id)}
   <table cellpadding="0" cellspacing="0">
     ${dr("Service", bookingTypeLabel(b))}
     ${dr("Summary", b.client_summary || "\u2014")}
     ${b.preferred_date ? dr("Date", b.preferred_date) : ""}
     ${b.start_time ? dr("Time", b.start_time) : ""}
     ${b.total_amount ? dr("Amount", b.currency + " " + Number(b.total_amount).toLocaleString()) : ""}
     ${dr("Status", "\u23F3 Pending verification")}
   </table>
   ${payHtml()}${rulesHtml()}
   <p style="margin-top:18px;font-size:12px;color:#9a7090;">\u{1F4CD} <b>${ADDRESS}</b> \xB7 \u{1F4DE} ${PHONE}</p>`
);
var tplBridal = (b) => shell(
  `<h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#3d1f6e;">${b.occasion === "bridal" ? "Bridal request received \u{1F48D}" : "Special request received \u2728"}</h2>
   <p style="margin:0 0 20px;font-size:13px;color:#7a5090;">${bookingGreeting(b)}</p>
   ${ib(b.booking_id)}
   <div style="background:#f0faf5;border-radius:12px;border:1px solid rgba(40,160,100,0.2);padding:16px 18px;">
     <p style="margin:0;font-size:13px;color:#2a6a45;line-height:1.6;">Our team will reach out to you shortly to discuss your needs and confirm pricing. Keep your booking ID safe.</p>
   </div>
   <p style="margin-top:16px;font-size:12px;color:#9a7090;">\u{1F4CD} <b>${ADDRESS}</b> \xB7 \u{1F4DE} ${PHONE}</p>`
);
var tplConfirmed = (b) => shell(
  `<h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#3d1f6e;">You're confirmed! \u{1F389}</h2>
   <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#c8788a;text-transform:uppercase;letter-spacing:0.1em;">${bookingTypeLabel(b)}</p>
   <p style="margin:0 0 20px;font-size:13px;color:#7a5090;">${confirmGreeting(b)}</p>
   ${ib(b.booking_id)}
   <div style="background:#f0faf5;border-radius:12px;padding:16px 18px;margin-bottom:16px;">
     <table cellpadding="0" cellspacing="0">
       ${dr("Name", b.client_name)}
       ${b.preferred_date ? dr("Date", b.preferred_date) : ""}
       ${b.start_time ? dr("Time", b.start_time) : ""}
       ${b.total_amount ? dr("Amount", b.currency + " " + Number(b.total_amount).toLocaleString()) : ""}
       ${dr("Status", "\u2705 Confirmed")}
     </table>
   </div>
   ${b.admin_note ? '<div style="background:#fffbf0;border-radius:12px;border:1px solid #f0e4b8;padding:14px 18px;margin-bottom:14px;"><p style="margin:0;font-size:13px;color:#6a5020;">' + b.admin_note + "</p></div>" : ""}
   <div style="background:linear-gradient(135deg,#3d1f6e,#6b3fa0);border-radius:14px;padding:18px 20px;margin:16px 0;text-align:center;">
     <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.15em;">Your Booking Ticket</p>
     <p style="margin:0 0 12px;font-size:13px;color:#fff;">Download and present your ticket at the studio.</p>
     <a href="https://beccastouchstudio.vercel.app/track?id=${b.booking_id}" style="display:inline-block;background:#c8788a;color:#fff;text-decoration:none;padding:10px 24px;border-radius:30px;font-size:13px;font-weight:700;">\u{1F4E5} View &amp; Download Ticket</a>
   </div>
   <p style="font-size:12px;color:#7a5090;">\u{1F4CD} <b>${ADDRESS}</b> \u2014 please arrive 15 minutes early. Questions? Call or WhatsApp us on ${PHONE}.</p>`
);
var tplRejected = (b) => shell(
  `<h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#3d1f6e;">Update on your booking</h2>
   <p style="margin:0 0 20px;font-size:13px;color:#7a5090;">Hi <b>${b.client_name}</b>, unfortunately we are unable to confirm this booking at this time.</p>
   ${ib(b.booking_id)}
   ${b.admin_note ? '<div style="background:#fff4f4;border-radius:12px;border:1px solid #f0c8c8;padding:14px 18px;margin-bottom:16px;"><p style="margin:0;font-size:13px;color:#6a2020;">' + b.admin_note + "</p></div>" : ""}
   <div style="background:#fdf8ff;border-radius:12px;border:1px solid #ede8f5;padding:16px 18px;margin-top:14px;">
     <p style="margin:0 0 8px;font-size:13px;color:#3d1f6e;font-weight:700;">Think this is a mistake?</p>
     <p style="margin:0 0 6px;font-size:12px;color:#7a5090;">Please don't hesitate to reach out to us directly:</p>
     <p style="margin:0 0 4px;font-size:12px;color:#3d1f6e;">\u{1F4DE} Call / WhatsApp: <b>${PHONE}</b></p>
     <p style="margin:0;font-size:12px;color:#3d1f6e;">\u{1F4CD} Visit us: <b>${ADDRESS}</b></p>
   </div>
   <p style="margin-top:14px;font-size:12px;color:#9a7090;">We'd love to find another time that works \u2014 feel free to book again. \u{1F338}</p>`
);
var tplAdmin = (b) => shell(
  `<h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#3d1f6e;">New booking \u2014 action needed</h2>
   <p style="margin:0 0 16px;font-size:12px;font-weight:700;color:#c8788a;text-transform:uppercase;">${bookingTypeLabel(b)}</p>
   ${ib(b.booking_id)}
   <table cellpadding="0" cellspacing="0" style="width:100%;">
     ${dr("Client", b.client_name)}
     ${dr("Email", b.email)}
     ${dr("Phone", b.phone)}
     ${dr("Service", bookingTypeLabel(b))}
     ${dr("Summary", b.client_summary || "\u2014")}
     ${b.preferred_date ? dr("Date", b.preferred_date) : ""}
     ${b.start_time ? dr("Time", b.start_time) : ""}
     ${b.total_amount ? dr("Amount", b.currency + " " + Number(b.total_amount).toLocaleString()) : ""}
     ${b.notes ? dr("Notes", b.notes) : ""}
   </table>`
);
var tplReminder = (b) => shell(
  `<h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#3d1f6e;">See you in 2 hours! \u23F0</h2>
   <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#c8788a;text-transform:uppercase;letter-spacing:0.1em;">${bookingTypeLabel(b)}</p>
   <p style="margin:0 0 20px;font-size:13px;color:#7a5090;">Hi <b>${b.client_name}</b>! Just a friendly reminder:</p>
   <div style="background:#f8f0ff;border-radius:12px;border:1px solid #ddd0f5;padding:16px 18px;margin-bottom:16px;">
     <p style="margin:0;font-size:13px;color:#5a3090;line-height:1.7;">${reminderBody(b)}</p>
   </div>
   ${ib(b.booking_id)}
   <table cellpadding="0" cellspacing="0">
     ${b.preferred_date ? dr("Date", b.preferred_date) : ""}
     ${b.start_time ? dr("Booked time", b.start_time) : ""}
   </table>
   <p style="margin-top:16px;font-size:12px;color:#9a7090;">\u{1F4CD} <b>${ADDRESS}</b> \xB7 \u{1F4DE} ${PHONE}</p>
   <p style="margin-top:8px;font-size:12px;color:#9a7090;">Thank you for choosing ${STUDIO} \u2014 we can't wait to see you! \u{1F338}</p>`
);
async function notifySubmission(fs, b) {
  try {
    const adminEmail = await fs.getConfig("smtp_user") || await fs.getConfig("gmail_email") || "";
    if (adminEmail) await sendMail(
      fs,
      adminEmail,
      `[${STUDIO}] New booking \u2014 ${b.booking_id} | ${b.booking_type === "studio" ? b.studio_use === "content" ? "Content Creation" : "Photoshoot" : String(b.occasion || "Glam")}`,
      tplAdmin(b)
    );
  } catch (e) {
    console.error("admin notify:", e.message);
  }
  const isBridalOrSpecial = b.occasion === "bridal" || b.occasion === "special";
  const clientEmail = (b.email || "").trim();
  if (!clientEmail) {
    console.error("client notify: no email address");
    return;
  }
  try {
    let subject;
    let html;
    if (b.booking_type === "studio") {
      const svcLabel = b.studio_use === "content" ? "Content Creation" : "Photoshoot";
      subject = `${svcLabel} booking received \u2014 ${b.booking_id} | ${STUDIO}`;
      html = tplReceived(b);
    } else if (isBridalOrSpecial) {
      subject = `${b.occasion === "bridal" ? "Bridal" : "Special"} request received \u2014 ${b.booking_id} | ${STUDIO}`;
      html = tplBridal(b);
    } else {
      subject = `Glam booking received \u2014 ${b.booking_id} | ${STUDIO}`;
      html = tplReceived(b);
    }
    await sendMail(fs, clientEmail, subject, html);
  } catch (e) {
    console.error("client notify:", e.message);
  }
}
async function notifyDecision(fs, b) {
  const ok = b.booking_status === "confirmed";
  try {
    await sendMail(
      fs,
      b.email,
      ok ? `Confirmed \u2014 ${b.booking_id} \u{1F389} | ${STUDIO}` : `Update on ${b.booking_id} | ${STUDIO}`,
      ok ? tplConfirmed(b) : tplRejected(b)
    );
  } catch (e) {
    console.error("decision notify:", e.message);
  }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: H });
  try {
    const token = await getServiceAccountToken();
    const fs = new Firestore(token);
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (!action) return j({ error: "action required" }, 400);
    if (action === "saveDraft") {
      const p = body.booking || {};
      if (!p.booking_type) return j({ error: "booking_type required" }, 400);
      const id = p.booking_id || bid(p.booking_type);
      const ex = p.booking_id ? await findBooking(fs, p.booking_id) : null;
      let saved;
      if (ex) saved = await fs.update("bookings", ex.id, norm(p, id, "draft", ex));
      else saved = await fs.create("bookings", norm(p, id, "draft"));
      return j({ ok: true, booking: clean(saved), bookingId: id, rules: RULES, payment: PAYMENT });
    }
    if (action === "submitBooking") {
      const p = body.booking || {};
      const miss = validate(p);
      if (miss.length) return j({ error: `Missing: ${miss.join(", ")}` }, 400);
      const id = p.booking_id || bid(p.booking_type);
      const ex = p.booking_id ? await findBooking(fs, p.booking_id) : null;
      let saved;
      if (ex) saved = await fs.update("bookings", ex.id, norm(p, id, "submitted", ex));
      else saved = await fs.create("bookings", norm(p, id, "submitted"));
      await notifySubmission(fs, saved);
      const updated = await fs.update("bookings", saved.id, { last_email_sent_at: (/* @__PURE__ */ new Date()).toISOString() });
      return j({ ok: true, booking: clean(updated), bookingId: id, rules: RULES, payment: PAYMENT });
    }
    if (action === "getBooking") {
      if (!body.bookingId) return j({ error: "bookingId required" }, 400);
      const b = await findBooking(fs, body.bookingId);
      if (!b) return j({ error: "Booking not found" }, 404);
      return j({ ok: true, booking: clean(b) });
    }
    if (action === "searchBookings") {
      const q = (body.query || body.email || body.phone || "").toLowerCase().trim();
      if (!q) return j({ bookings: [] });
      const all = await fs.query("bookings", [], "-created_date");
      const hits = all.filter(
        (b) => [b.booking_id, b.client_name, b.email, b.phone].some((v) => String(v || "").toLowerCase().includes(q))
      ).slice(0, 20);
      return j({ ok: true, bookings: hits.map(clean) });
    }
    if (action === "adminOverview") {
      await checkPin(fs, body.pin);
      const all = await fs.query("bookings", [], "-created_date");
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
      const stats = {
        today: all.filter((b) => String(b.created_date || "").slice(0, 10) === today).length,
        thisWeek: all.filter((b) => String(b.created_date || "").slice(0, 10) >= weekAgo).length,
        pending: all.filter((b) => b.booking_status === "pending" && !b.is_archived).length
      };
      const name = await fs.getConfig("admin_name") || "Admin";
      return j({ ok: true, bookings: all.map(clean), stats, adminProfile: { name } });
    }
    if (action === "resetPin") {
      await checkPin(fs, body.currentPin);
      const newPinVal = String(body.newPin || "").trim();
      if (!newPinVal || newPinVal.length < 4) return j({ error: "New PIN must be at least 4 digits" }, 400);
      if (!/^\d+$/.test(newPinVal)) return j({ error: "PIN must contain numbers only" }, 400);
      await fs.setConfig("admin_pin", newPinVal);
      return j({ ok: true });
    }
    if (action === "getAdminProfile") {
      const name = await fs.getConfig("admin_name") || "Admin";
      return j({ ok: true, adminProfile: { name } });
    }
    if (action === "saveAdminProfile") {
      await checkPin(fs, body.pin);
      await fs.setConfig("admin_name", String(body.name || "Admin"));
      return j({ ok: true });
    }
    if (action === "adminUpdateStatus") {
      await checkPin(fs, body.pin);
      const b = await findBooking(fs, body.bookingId);
      if (!b) return j({ error: "Booking not found" }, 404);
      const patchData = { booking_status: body.status };
      if (body.adminNote !== void 0) patchData.admin_note = body.adminNote;
      const updated = await fs.patch("bookings", b.id, patchData);
      const full = { ...b, ...updated };
      await notifyDecision(fs, full);
      return j({ ok: true, booking: clean(full) });
    }
    if (action === "archiveBooking") {
      await checkPin(fs, body.pin);
      const b = await findBooking(fs, body.bookingId);
      if (!b) return j({ error: "Booking not found" }, 404);
      const updated = await fs.patch("bookings", b.id, { is_archived: true, archived_at: (/* @__PURE__ */ new Date()).toISOString() });
      return j({ ok: true, booking: clean({ ...b, ...updated }) });
    }
    if (action === "restoreBooking") {
      await checkPin(fs, body.pin);
      const b = await findBooking(fs, body.bookingId);
      if (!b) return j({ error: "Booking not found" }, 404);
      const updated = await fs.patch("bookings", b.id, { is_archived: false, archived_at: "" });
      return j({ ok: true, booking: clean({ ...b, ...updated }) });
    }
    if (action === "deleteBooking") {
      await checkPin(fs, body.pin);
      const b = await findBooking(fs, body.bookingId);
      if (!b) return j({ error: "Booking not found" }, 404);
      await fs.delete("bookings", b.id);
      return j({ ok: true });
    }
    if (action === "markAttended") {
      await checkPin(fs, body.pin);
      const b = await findBooking(fs, body.bookingId);
      if (!b) return j({ error: "Booking not found" }, 404);
      const updated = await fs.patch("bookings", b.id, { service_attended: true, attended_at: (/* @__PURE__ */ new Date()).toISOString() });
      return j({ ok: true, booking: clean({ ...b, ...updated }) });
    }
    if (action === "envCheck") {
      const proj = Deno.env.get("FIREBASE_PROJECT_ID") || "MISSING";
      const email = Deno.env.get("FIREBASE_CLIENT_EMAIL") || "MISSING";
      const rawKey = Deno.env.get("FIREBASE_PRIVATE_KEY") || "";
      const b64Key = Deno.env.get("FIREBASE_PRIVATE_KEY_B64") || "";
      return new Response(JSON.stringify({
        project_id: proj,
        client_email: email,
        has_raw_key: rawKey.length > 0,
        raw_key_length: rawKey.length,
        has_b64_key: b64Key.length > 0,
        b64_key_length: b64Key.length,
        email_provider: "Gmail OAuth (Base44)",
        mail_secret_set: !!(Deno.env.get("BECCA_MAIL_SECRET"))
      }), { headers: H });
    }
    if (action === "debugKey") {
      const raw = Deno.env.get("FIREBASE_PRIVATE_KEY") || "";
      const hasLiteralBackslashN = raw.includes("\\n");
      const hasRealNewline = raw.includes("\n");
      const length = raw.length;
      const first50 = raw.substring(0, 50);
      const last20 = raw.substring(raw.length - 20);
      return new Response(JSON.stringify({
        length,
        hasLiteralBackslashN,
        hasRealNewline,
        first50,
        last20
      }), { headers: H });
    }
    if (action === "getPublicProducts") {
      const list = await fs.query("products", [], "-created_date");
      return j({ ok: true, products: list.filter((p) => !p.is_archived) });
    }
    if (action === "adminGetProducts") {
      await checkPin(fs, body.pin);
      const list = await fs.query("products", [], "-created_date");
      return j({ ok: true, products: list });
    }
    if (action === "adminSaveProduct") {
      await checkPin(fs, body.pin);
      const p = body.product || {};
      if (!p.name) return j({ error: "Product name required" }, 400);
      const data = {
        name: p.name,
        description: p.description || "",
        price: Number(p.price || 0),
        sale_price: p.sale_price !== void 0 && p.sale_price !== null && String(p.sale_price) !== "" ? Number(p.sale_price) : null,
        category: p.category || "Other",
        in_stock: Boolean(p.in_stock !== false),
        image_url: p.image_url || "",
        images: Array.isArray(p.images) ? p.images : [],
        whatsapp_order: Boolean(p.whatsapp_order !== false),
        is_archived: Boolean(p.is_archived)
      };
      let saved;
      if (p.id) saved = await fs.update("products", p.id, data);
      else saved = await fs.create("products", data);
      return j({ ok: true, product: saved });
    }
    if (action === "adminDeleteProduct") {
      await checkPin(fs, body.pin);
      if (!body.productId) return j({ error: "productId required" }, 400);
      await fs.delete("products", body.productId);
      return j({ ok: true });
    }
    if (action === "adminGetPricing") {
      await checkPin(fs, body.pin);
      const raw = await fs.getConfig("pricing");
      const pricing = raw ? JSON.parse(raw) : {};
      return j({ ok: true, pricing });
    }
    if (action === "adminSavePricing") {
      await checkPin(fs, body.pin);
      const existing = await fs.getConfig("pricing");
      const current = existing ? JSON.parse(existing) : {};
      const updated = { ...current, [body.key]: body.value };
      await fs.setConfig("pricing", JSON.stringify(updated));
      return j({ ok: true });
    }
    if (action === "saveSmtpConfig") {
      // Email is now handled via Gmail OAuth on Base44 — no configuration needed
      return j({ ok: true, email: "beccastouchstudio@gmail.com", message: "Gmail OAuth is active" });
    }
    if (action === "getSmtpStatus") {
      await checkPin(fs, body.pin);
      const email = Deno.env.get("SMTP_USER") || await fs.getConfig("smtp_user") || "";
      const hasPass = !!(Deno.env.get("SMTP_PASS") || await fs.getConfig("smtp_pass"));
      return j({ ok: true, connected: !!(email && hasPass), email });
    }
    if (action === "disconnectSmtp") {
      await checkPin(fs, body.pin);
      await fs.setConfig("smtp_user", "");
      await fs.setConfig("smtp_pass", "");
      return j({ ok: true });
    }
    if (action === "testEmail") {
      await checkPin(fs, body.pin);
      const testTo = (body.to || "beccastouchstudio@gmail.com");
      await sendMail(
        fs,
        testTo,
        `\u2705 Test email from ${STUDIO}`,
        shell(`<h2 style="color:#3d1f6e;margin:0 0 12px;">\u2705 Email is working!</h2><p style="color:#7a5090;font-size:13px;">Your Gmail OAuth connection is active. All booking notifications will be sent from <b>beccastouchstudio@gmail.com</b> via Gmail.</p>`)
      );
      return j({ ok: true, email: "beccastouchstudio@gmail.com" });
    }
    if (action === "sendReminder") {
      const b = await findBooking(fs, body.bookingId);
      if (!b || !b.email) return j({ error: "Booking not found or no email" }, 404);
      try {
        await sendMail(
          fs,
          b.email,
          `Reminder: your session is in 2 hours \u2014 ${b.booking_id} | ${STUDIO}`,
          tplReminder(b)
        );
        return j({ ok: true });
      } catch (e) {
        return j({ error: e.message }, 500);
      }
    }
    if (action === "saveShopOrder") {
      const o = body.order || {};
      if (!o.name || !o.phone) return j({ error: "Name and phone required" }, 400);
      const orderId = "ORD-" + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 5).toUpperCase();
      const saved = await fs.create("shop_orders", {
        order_id: orderId,
        client_name: o.name || "",
        phone: o.phone || "",
        email: o.email || "",
        delivery_type: o.delivery_type || "pickup",
        items: JSON.stringify(o.items || []),
        total_amount: Number(o.total_amount || 0),
        currency: "NGN",
        status: "pending",
        notes: o.notes || ""
      });
      const adminEmail = await fs.getConfig("smtp_user") || await fs.getConfig("gmail_email") || "";
      if (adminEmail) {
        const itemRows = (o.items || []).map((i) => dr(i.name, `x${i.qty} \u2014 NGN ${(i.price * i.qty).toLocaleString()}`)).join("");
        try {
          await sendMail(
            fs,
            adminEmail,
            `[${STUDIO}] New shop order \u2014 ${orderId}`,
            shell(`<h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#3d1f6e;">New shop order \u{1F6D2}</h2>
              <table cellpadding="0" cellspacing="0" style="width:100%;">
                ${dr("Order ID", orderId)}${dr("Client", String(o.name))}${dr("Phone", String(o.phone))}
                ${o.email ? dr("Email", String(o.email)) : ""}
                ${dr("Delivery", o.delivery_type === "home" ? "Home Delivery" : "Self Pickup")}
                ${dr("Total", "NGN " + Number(o.total_amount).toLocaleString())}
              </table>
              <div style="margin-top:16px;padding:14px 18px;background:#f8f4ff;border-radius:12px;">
                <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#3d1f6e;text-transform:uppercase;">Items ordered</p>
                <table cellpadding="0" cellspacing="0">${itemRows}</table>
              </div>`)
          );
        } catch (e) {
          console.error("shop order admin email:", e.message);
        }
      }
      return j({ ok: true, orderId, order: saved });
    }
    if (action === "adminGetShopOrders") {
      await checkPin(fs, body.pin);
      const orders = await fs.query("shop_orders", [], "-created_date");
      return j({ ok: true, orders });
    }
    if (action === "adminUpdateShopOrder") {
      await checkPin(fs, body.pin);
      const docId = body.orderId;
      const existing = await fs.get("shop_orders", docId);
      if (!existing) return j({ error: "Order not found" }, 404);
      const updated = await fs.update("shop_orders", docId, { status: body.status, notes: body.notes || String(existing.notes || "") });
      return j({ ok: true, order: updated });
    }
    if (action === "adminDeleteShopOrder") {
      await checkPin(fs, body.pin);
      const docId = body.orderId;
      const existing = await fs.get("shop_orders", docId);
      if (!existing) return j({ error: "Order not found" }, 404);
      await fs.delete("shop_orders", docId);
      return j({ ok: true });
    }
    return j({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return j({ error: e.message || "Internal error" }, 500);
  }
});
