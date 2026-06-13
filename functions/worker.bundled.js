// functions/worker.ts
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};
var j = (data, s = 200) => new Response(JSON.stringify(data), {
  status: s,
  headers: { "Content-Type": "application/json", ...CORS }
});
var STUDIO = "Beccastouch Studio";
var ADDRESS = "Total Filling Station, Oju-Irin Bodija, Ibadan, Oyo State";
var PHONE = "+234 802 327 4274";
var WHATSAPP = "+234 805 198 2695";
var RULES = [
  "Your booking is provisional until payment is verified and the studio confirms your slot.",
  "Keep your booking ID safe \u2014 use it to track status or resume your booking.",
  "Arrive at least 15 minutes before your approved session time.",
  "Request date/time changes early so the team can confirm availability.",
  "For home service bookings, your full address must be correct before confirmation.",
  "Please note: all payments are final. We do not offer refunds after payment has been made."
];
async function getFirebaseToken(env) {
  const clientEmail = "firebase-adminsdk-fbsvc@beccastouch-studio.iam.gserviceaccount.com";
  const projectId = env.FIREBASE_PROJECT_ID || "beccastouch-studio";
  const b64 = env.FIREBASE_PRIVATE_KEY_B64 || "";
  const pem = atob(b64);
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
  const pemBody = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBytes = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${unsigned}.${sig}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Firebase auth failed: " + JSON.stringify(data));
  return data.access_token;
}
function fsVal(v) {
  if (v === null || v === void 0) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsVal) } };
  if (typeof v === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, fsVal(val)])) } };
  return { stringValue: String(v) };
}
function fsToJs(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || typeof v !== "object") {
      out[k] = v;
      continue;
    }
    const fv = v;
    if ("stringValue" in fv) out[k] = fv.stringValue;
    else if ("integerValue" in fv) out[k] = Number(fv.integerValue);
    else if ("doubleValue" in fv) out[k] = fv.doubleValue;
    else if ("booleanValue" in fv) out[k] = fv.booleanValue;
    else if ("nullValue" in fv) out[k] = null;
    else if ("arrayValue" in fv) {
      const av = fv.arrayValue;
      out[k] = (av.values || []).map((x) => {
        if (x === null || typeof x !== "object") return x;
        const xf = x;
        if ("mapValue" in xf) return fsToJs(xf.mapValue.fields || {});
        if ("stringValue" in xf) return xf.stringValue;
        if ("integerValue" in xf) return Number(xf.integerValue);
        if ("doubleValue" in xf) return xf.doubleValue;
        if ("booleanValue" in xf) return xf.booleanValue;
        if ("nullValue" in xf) return null;
        return fsToJs(xf);
      });
    } else if ("mapValue" in fv) {
      const mv = fv.mapValue;
      out[k] = mv.fields ? fsToJs(mv.fields) : {};
    } else if ("timestampValue" in fv) out[k] = fv.timestampValue;
    else out[k] = null;
  }
  return out;
}
function toFsDoc(data) {
  return { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fsVal(v)])) };
}
var Firestore = class {
  token;
  base;
  constructor(token, projectId) {
    this.token = token;
    this.base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  }
  hdr() {
    return { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" };
  }
  async get(col, id) {
    const r = await fetch(`${this.base}/${col}/${id}`, { headers: this.hdr() });
    if (r.status === 404) return null;
    const d = await r.json();
    if (!d.fields) return null;
    return { id: d.name.split("/").pop(), ...fsToJs(d.fields) };
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
    const r = await fetch(`${this.base}/${col}`, { method: "POST", headers: this.hdr(), body: JSON.stringify(toFsDoc({ ...data, created_date: now, updated_date: now })) });
    const d = await r.json();
    if (!d.fields) throw new Error("Firestore create failed: " + JSON.stringify(d));
    return { id: d.name.split("/").pop(), ...fsToJs(d.fields) };
  }
  async set(col, id, data) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const r = await fetch(`${this.base}/${col}/${id}`, {
      method: "PATCH",
      headers: this.hdr(),
      body: JSON.stringify(toFsDoc({ ...data, updated_date: now }))
    });
    const d = await r.json();
    if (!d.fields) throw new Error("Firestore set failed: " + JSON.stringify(d));
    return { id, ...fsToJs(d.fields) };
  }
  async update(col, id, data) {
    const existing = await this.get(col, id);
    if (!existing) throw new Error(`Document ${col}/${id} not found`);
    const merged = { ...existing, ...data, updated_date: (/* @__PURE__ */ new Date()).toISOString() };
    delete merged._created;
    delete merged._updated;
    return this.set(col, id, merged);
  }
  async delete(col, id) {
    await fetch(`${this.base}/${col}/${id}`, { method: "DELETE", headers: this.hdr() });
  }
  async getConfig(key) {
    const doc = await this.get("config", key);
    return doc ? String(doc.value ?? "") : null;
  }
  async setConfig(key, value) {
    await this.set("config", key, { value });
  }
};
async function sendMail(env, to, subject, html, _fs) {
  console.log("[sendMail] Sending to:", to, "| subject:", subject.slice(0, 60));
  const GMAIL_RELAY_URL = "https://superagent-4cc52a5c.base44.app/functions/sendGmailEmail";
  const MAIL_SECRET = env.BECCA_MAIL_SECRET || "~mQmAT.s6BUB'L.";
  try {
    const res = await fetch(GMAIL_RELAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: MAIL_SECRET, to, subject, html })
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[sendMail] Relay error", res.status, text.slice(0, 200), "| to:", to);
    } else {
      console.log("[sendMail] Sent OK to:", to, "| resp:", text.slice(0, 120));
    }
  } catch (e) {
    console.error("[sendMail] Exception sending to:", to, "|", e.message);
  }
}
async function verifyFirebaseIdToken(token, projectId) {
  const apiKey = "AIzaSyClmvYRY8dyvabeRyCTRde4gk59rTcnBho";
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token })
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Token verification failed: ${txt}`);
  }
  const data = await res.json();
  const user = data.users?.[0];
  if (!user) throw new Error("Token verification failed: no user found");
  return { uid: user.localId, email: user.email || "" };
}
async function checkAuth(env, request) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw new Error("Unauthorized");
  const projectId = env.FIREBASE_PROJECT_ID || "beccastouch-studio";
  const { email } = await verifyFirebaseIdToken(token, projectId);
  const adminEmail = env.ADMIN_EMAIL || await fetch("").then(() => "").catch(() => "");
  return email;
}
function bid(bookingType) {
  const prefix = bookingType === "glam" ? "GLM" : bookingType === "studio" ? "STU" : "BK";
  const d = /* @__PURE__ */ new Date();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${rand}`;
}
function smry(p) {
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
}
function norm(p, id, status, ex) {
  return {
    ...ex || {},
    ...p,
    booking_id: id,
    status,
    client_summary: p.client_summary || smry(p),
    flow_status: status === "submitted" ? "submitted" : p.flow_status || "draft",
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function findBooking(fs, bookingId) {
  const r = await fs.query("bookings", [{ field: "booking_id", op: "EQUAL", value: bookingId }], void 0, 1);
  return r[0] || null;
}
function toFE(b) {
  if (!b) return b;
  return {
    ...b,
    // Booking identity
    bookingId: b.booking_id,
    bookingType: b.booking_type,
    flowStatus: b.flow_status,
    bookingStatus: b.booking_status || b.status,
    // worker stores as 'status'
    // Client
    clientName: b.client_name,
    locationType: b.location_type,
    studioUse: b.studio_use,
    sessionType: b.session_type,
    groupSize: b.group_size,
    serviceType: b.service_type,
    preferredDate: b.preferred_date,
    startTime: b.start_time,
    durationHours: b.duration_hours,
    // Payment
    totalAmount: b.total_amount,
    paymentReference: b.payment_reference,
    paymentReceiptName: b.payment_receipt_name,
    paymentReceiptUrl: b.payment_receipt_data_url,
    // Admin
    adminNote: b.admin_note,
    confirmationSent: b.confirmation_sent,
    lastEmailSentAt: b.last_email_sent_at,
    rescheduleCount: b.reschedule_count,
    isArchived: b.is_archived || b.status === "archived",
    archivedAt: b.archived_at,
    serviceAttended: b.service_attended || b.attended,
    attendedAt: b.attended_at,
    // Bridal
    bridalWeddingDate: b.bridal_wedding_date,
    bridalEventType: b.bridal_event_type,
    bridalEventLocation: b.bridal_event_location,
    bridalReadyLocation: b.bridal_ready_location,
    bridalEventStartTime: b.bridal_event_start_time,
    bridalReadyTime: b.bridal_ready_time,
    bridalBridesmaids: b.bridal_bridesmaids,
    // Special
    specialRequestText: b.special_request_text,
    specialRequestAudioUrl: b.special_request_audio_url,
    // Summary
    summary: b.client_summary,
    clientSummary: b.client_summary
  };
}
function bookingTypeLabel(b) {
  if (b.booking_type === "studio") {
    return b.studio_use === "content" ? "\u{1F3AC} Content Creation" : "\u{1F4F8} Photoshoot";
  }
  if (b.occasion === "bridal") return "\u{1F48D} Bridal Glam";
  if (b.occasion === "special") return "\u2728 Special Request";
  const svc = b.service_type === "makeup+gele" ? "Makeup + Gele" : b.service_type === "gele" ? "Gele Only" : "Makeup";
  return `\u{1F484} ${svc}`;
}
function shell(_h, _s, body) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f3eef8;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3eef8;padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(61,31,110,0.08);">
<tr><td style="background:linear-gradient(135deg,#3d1f6e,#c8788a);padding:28px 32px;">
  <p style="margin:0 0 4px;font-size:10px;letter-spacing:0.28em;color:rgba(255,255,255,0.7);text-transform:uppercase;">Beauty \xB7 Photography \xB7 Style</p>
  <h1 style="margin:0;font-size:24px;font-weight:800;color:#fff;">Beccastouch Studio</h1>
  <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.75);">\u{1F4CD} ${ADDRESS}</p>
</td></tr>
<tr><td style="padding:28px 32px;">
  ${body}
</td></tr>
<tr><td style="background:#f8f4ff;padding:16px 32px;border-top:1px solid #ede8f5;">
  <p style="margin:0;font-size:11px;color:#9a7ab0;text-align:center;">Beccastouch Studio \xB7 ${ADDRESS} \xB7 ${PHONE}</p>
</td></tr>
</table>
</td></tr></table></body></html>`;
}
function dr(label, value) {
  return `<tr>
    <td style="padding:6px 10px;font-size:12px;color:#9a7080;white-space:nowrap;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">${label}</td>
    <td style="padding:6px 10px;font-size:13px;color:#3d1f6e;font-weight:500;">${value}</td>
  </tr>`;
}
function dtable(rows) {
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fdf8ff;border-radius:12px;overflow:hidden;border:1px solid #ede0f8;">${rows}</table>`;
}
function rulesHtml() {
  return `<div style="margin-top:16px;padding:12px 18px;background:#fdf4f8;border-radius:12px;border:1px solid rgba(200,120,138,0.15);">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#8a3050;text-transform:uppercase;letter-spacing:0.15em;">Please note</p>
    <ul style="margin:0;padding-left:16px;">${RULES.map((r) => `<li style="font-size:11px;color:#6b4a52;line-height:1.7;margin-bottom:2px;">${r}</li>`).join("")}</ul>
  </div>`;
}
function tplSubmitted(b) {
  const isBridalOrSpecial = b.occasion === "bridal" || b.occasion === "special";
  const headline = isBridalOrSpecial ? b.occasion === "bridal" ? "Bridal Request Received! \u{1F48D}" : "Special Request Received! \u2728" : "Booking Received! \u{1F338}";
  const subtitle = `Hi ${b.client_name}, we got your booking request`;
  const statusMsg = isBridalOrSpecial ? `Your ${b.occasion} request has been submitted. Our team will reach out shortly to discuss details and pricing.` : `Your booking has been submitted and is under review. We'll confirm or be in touch with you shortly.`;
  const typeLabel = bookingTypeLabel(b);
  const rows = dr("Booking ID", b.booking_id) + dr("Type", typeLabel) + (b.preferred_date ? dr("Date", b.preferred_date) : "") + (b.start_time ? dr("Time", b.start_time) : "") + (b.occasion ? dr("Occasion", String(b.occasion)) : "") + (b.total_amount ? dr("Amount", (b.currency || "NGN") + " " + Number(b.total_amount).toLocaleString()) : "") + dr("Name", b.client_name) + dr("Phone", b.phone) + dr("Email", b.email);
  const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#3d1f6e;font-weight:800;">${headline}</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#9a7080;">${subtitle}</p>
    <div style="background:#f0faf3;border:1px solid #b8e0c8;border-radius:12px;padding:14px 18px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#3d7a53;font-weight:600;">\u2705 ${statusMsg}</p>
    </div>
    ${dtable(rows)}
    <p style="font-size:12px;color:#9a7090;margin-top:16px;">\u{1F4CD} <b>${ADDRESS}</b></p>
    <p style="font-size:12px;color:#9a7090;margin-top:8px;">Questions? Reply to this email or WhatsApp us on <b>${WHATSAPP}</b>.</p>`;
  return shell("", "", body);
}
function tplAdmin(b) {
  const typeLabel = bookingTypeLabel(b);
  const rows = dr("Booking ID", b.booking_id) + dr("Type", typeLabel) + (b.preferred_date ? dr("Date", b.preferred_date) : "") + (b.start_time ? dr("Time", b.start_time) : "") + (b.occasion ? dr("Occasion", String(b.occasion)) : "") + (b.total_amount ? dr("Amount", (b.currency || "NGN") + " " + Number(b.total_amount).toLocaleString()) : "") + dr("Name", b.client_name) + dr("Phone", b.phone) + dr("Email", b.email) + (b.notes ? dr("Notes", b.notes) : "") + (b.location_type ? dr("Service type", b.location_type === "home" ? "Home service" : "Studio walk-in") : "") + (b.payment_reference ? dr("Payment ref", b.payment_reference) : "");
  const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#3d1f6e;font-weight:800;">New Booking Received \u{1F4CB}</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#9a7080;">A new <b>${typeLabel}</b> booking just came in.</p>
    ${dtable(rows)}
    <div style="margin-top:20px;text-align:center;">
      <a href="https://beccastouchstudio.vercel.app/sg-bec" style="display:inline-block;background:linear-gradient(135deg,#3d1f6e,#c8788a);color:#fff;text-decoration:none;padding:12px 28px;border-radius:50px;font-weight:700;font-size:14px;">Review in Admin Panel \u2192</a>
    </div>`;
  return shell("", "", body);
}
function tplStatusUpdate(b, note) {
  const isConfirmed = b.status === "confirmed";
  const isRejected = b.status === "rejected" || b.status === "cancelled";
  const headline = isConfirmed ? "Booking Confirmed! \u{1F389}" : isRejected ? "Update on Your Booking" : "Booking Status Updated";
  const statusLabel = isConfirmed ? "\u2705 Confirmed" : isRejected ? "\u274C Not confirmed" : String(b.status || "");
  const trackUrl = `https://beccastouchstudio.vercel.app/track-booking?id=${b.booking_id}`;
  const typeLabel = bookingTypeLabel(b);
  const rows = dr("Booking ID", b.booking_id) + dr("Type", typeLabel) + (b.preferred_date ? dr("Date", b.preferred_date) : "") + (b.start_time ? dr("Time", b.start_time) : "") + dr("Status", statusLabel) + dr("Name", b.client_name) + dr("Phone", b.phone) + dr("Email", b.email);
  const noteHtml = note ? `<div style="background:#fffbf0;border-radius:12px;border:1px solid #f0e4b8;padding:14px 18px;margin:14px 0;"><p style="margin:0;font-size:13px;color:#6a5020;">${note}</p></div>` : "";
  const confirmedExtra = isConfirmed ? `
    <div style="margin-top:20px;text-align:center;">
      <a href="${trackUrl}" style="display:inline-block;background:linear-gradient(135deg,#3d1f6e,#c8788a);color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:50px;text-decoration:none;">\u2B07\uFE0F Download Your Ticket</a>
      <p style="margin:8px 0 0;font-size:11px;color:#9a7090;">Opens your booking page where you can view and download your confirmed ticket</p>
    </div>
    ${rulesHtml()}
    <div style="margin-top:16px;padding:12px 18px;background:#f0faf5;border-radius:12px;border:1px solid rgba(40,160,100,0.2);">
      <p style="margin:0;font-size:12px;color:#2a6a45;line-height:1.7;">\u{1F4CD} <b>${ADDRESS}</b><br>\u23F0 Please arrive <b>15 minutes early</b> so we can get you settled.<br>\u{1F4DE} Questions? Call us on <b>${PHONE}</b></p>
    </div>` : "";
  const rejectedExtra = isRejected ? `
    ${note ? `<div style="margin-top:16px;padding:14px 18px;background:#fff4f4;border-radius:12px;border:1px solid rgba(168,64,64,0.2);">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#a84040;font-weight:700;">Reason for rejection</p>
      <p style="margin:0;font-size:13px;color:#7a4040;line-height:1.6;">${note}</p>
    </div>` : ""}
    <div style="margin-top:16px;padding:12px 18px;background:#fff4f4;border-radius:12px;border:1px solid rgba(168,64,64,0.15);">
      <p style="margin:0;font-size:13px;color:#7a4040;line-height:1.6;">We are sorry we could not accommodate your booking this time. We would love to find another time \u2014 feel free to rebook. You can also reach us on <b>${PHONE}</b>.</p>
    </div>` : "";
  const body = `
    <h2 style="margin:0 0 4px;font-size:20px;color:#3d1f6e;font-weight:800;">${headline}</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#9a7080;">Hi ${b.client_name}, here is an update on your booking.</p>
    ${dtable(rows)}
    ${noteHtml}
    ${confirmedExtra}
    ${rejectedExtra}
    <p style="font-size:12px;color:#9a7090;margin-top:16px;">Questions? Reply to this email or WhatsApp us on <b>${WHATSAPP}</b>.</p>`;
  return shell("", "", body);
}
async function notifySubmission(fs, env, b) {
  const clientEmail = (b.email || "").trim();
  if (clientEmail) {
    const isBridalOrSpecial = b.occasion === "bridal" || b.occasion === "special";
    const isStudio = b.booking_type === "studio";
    let subject;
    if (isStudio) {
      const svcLabel = b.studio_use === "content" ? "Content Creation" : "Photoshoot";
      subject = `${svcLabel} booking received - ${b.booking_id} | ${STUDIO}`;
    } else if (isBridalOrSpecial) {
      subject = `${b.occasion === "bridal" ? "Bridal" : "Special"} request received - ${b.booking_id} | ${STUDIO}`;
    } else {
      subject = `Glam booking received - ${b.booking_id} | ${STUDIO}`;
    }
    try {
      await sendMail(env, clientEmail, subject, tplSubmitted(b), fs);
    } catch (e) {
      console.error("client email:", e);
    }
  }
  const adminEmail = await fs.getConfig("smtp_user") || await fs.getConfig("gmail_email") || env.SMTP_USER || "";
  if (adminEmail) {
    const typeLabel = b.booking_type === "studio" ? b.studio_use === "content" ? "Content Creation" : "Photoshoot" : String(b.occasion || "Glam");
    try {
      await sendMail(env, adminEmail, `[${STUDIO}] New booking - ${b.booking_id} | ${typeLabel}`, tplAdmin(b), fs);
    } catch (e) {
      console.error("admin email:", e);
    }
  }
}
var worker_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      const token = await getFirebaseToken(env);
      const projectId = env.FIREBASE_PROJECT_ID || "beccastouch-studio";
      const fs = new Firestore(token, projectId);
      const body = await request.json().catch(() => ({}));
      const action = body.action;
      if (!action) return j({ error: "action required" }, 400);
      const requireAdmin = () => checkAuth(env, request);
      if (action === "saveDraft") {
        const p = body.booking || {};
        if (!p.booking_type) return j({ error: "booking_type required" }, 400);
        const id = p.booking_id || bid(p.booking_type);
        const ex = p.booking_id ? await findBooking(fs, p.booking_id) : null;
        const saved = ex ? await fs.update("bookings", ex.id, norm(p, id, "draft", ex)) : await fs.create("bookings", norm(p, id, "draft"));
        return j({ ok: true, bookingId: id, booking: toFE(saved) });
      }
      if (action === "submitBooking") {
        const p = body.booking || {};
        if (!p.booking_type || !p.client_name || !p.email || !p.phone)
          return j({ error: "Missing required fields (booking_type, client_name, email, phone)" }, 400);
        const id = p.booking_id || bid(p.booking_type);
        const ex = p.booking_id ? await findBooking(fs, p.booking_id) : null;
        if (!ex) {
          const recent = await fs.query("bookings", [], "-created_date", 5);
          const phone = String(p.phone || "").replace(/\D/g, "");
          const dupeWindow = Date.now() - 6e4;
          const dupe = recent.find((r) => {
            const rPhone = String(r.phone || "").replace(/\D/g, "");
            const rCreated = new Date(r.created_date || r._created || 0).getTime();
            return rPhone === phone && r.booking_type === p.booking_type && r.preferred_date === p.preferred_date && rCreated > dupeWindow && r.status !== "archived";
          });
          if (dupe) {
            console.warn("Duplicate submit blocked for phone:", phone);
            return j({ ok: true, bookingId: dupe.booking_id, booking: toFE(dupe) });
          }
        }
        const saved = ex ? await fs.update("bookings", ex.id, norm(p, id, "submitted", ex)) : await fs.create("bookings", norm(p, id, "submitted"));
        await notifySubmission(fs, env, saved);
        const updated = await fs.update("bookings", saved.id, {
          last_email_sent_at: (/* @__PURE__ */ new Date()).toISOString(),
          confirmation_sent: true
        });
        return j({ ok: true, bookingId: id, booking: toFE(updated) });
      }
      if (action === "getBooking") {
        const bid2 = body.bookingId || body.booking_id;
        if (!bid2) return j({ error: "Booking ID required" }, 400);
        const b = await findBooking(fs, bid2.toUpperCase());
        if (!b) return j({ error: "Booking not found" }, 404);
        return j({ ok: true, booking: toFE(b) });
      }
      if (action === "searchBookings") {
        const q = (body.query || body.email || body.phone || body.q || "").toLowerCase().trim();
        if (!q) return j({ bookings: [] });
        const all = await fs.query("bookings", [], "-created_date");
        const hits = all.filter(
          (b) => [b.booking_id, b.client_name, b.email, b.phone, b.phone?.replace(/\D/g, "")].some((v) => String(v || "").toLowerCase().includes(q))
        ).slice(0, 20);
        return j({ ok: true, bookings: hits.map(toFE) });
      }
      if (action === "adminOverview") {
        await requireAdmin();
        const all = await fs.query("bookings", [], "-created_date");
        const profile = await fs.get("config", "admin_profile") || {};
        return j({ ok: true, bookings: all.map(toFE), total: all.length, adminProfile: profile });
      }
      if (action === "resetPin") {
        return j({ error: "PIN auth is no longer used. Use Firebase email/password auth." }, 410);
      }
      if (action === "getAdminProfile") {
        await requireAdmin();
        const profile = await fs.get("config", "admin_profile") || {};
        const smtpUser = env.SMTP_USER || await fs.getConfig("smtp_user") || "";
        return j({ ok: true, profile, smtp_configured: !!smtpUser, smtp_user: smtpUser });
      }
      if (action === "saveAdminProfile") {
        await requireAdmin();
        const name = (body.name || "").trim();
        const existing = await fs.get("config", "admin_profile") || {};
        const p = { ...existing, name };
        await fs.set("config", "admin_profile", p);
        return j({ ok: true, profile: p });
      }
      if (action === "adminUpdateStatus") {
        await requireAdmin();
        const bid_val2 = body.booking_id || body.bookingId;
        const b = await findBooking(fs, bid_val2);
        if (!b) return j({ error: "Booking not found" }, 404);
        const newStatus = body.status || body.bookingStatus;
        const note = (body.note || body.adminNote || "").trim();
        const rejectionReason = (body.rejectionReason || body.rejection_reason || "").trim();
        const updated = await fs.update("bookings", b.id, {
          status: newStatus,
          booking_status: newStatus,
          admin_note: note,
          rejection_reason: rejectionReason
        });
        const emailNote = rejectionReason ? note ? note + "\n\n" + rejectionReason : rejectionReason : note;
        if (b.email) {
          try {
            await sendMail(env, b.email, `[${STUDIO}] Booking update - ${b.booking_id}`, tplStatusUpdate(updated, emailNote), fs);
          } catch (e) {
            console.error("status update email:", e);
          }
        }
        return j({ ok: true, booking: toFE(updated) });
      }
      if (action === "archiveBooking") {
        await requireAdmin();
        const bid_val = body.booking_id || body.bookingId;
        const b = await findBooking(fs, bid_val);
        if (!b) return j({ error: "Booking not found" }, 404);
        const updated = await fs.update("bookings", b.id, {
          status: "archived",
          is_archived: true,
          archived_at: (/* @__PURE__ */ new Date()).toISOString()
        });
        return j({ ok: true, booking: toFE(updated) });
      }
      if (action === "restoreBooking") {
        await requireAdmin();
        const bid_val = body.booking_id || body.bookingId;
        const b = await findBooking(fs, bid_val);
        if (!b) return j({ error: "Booking not found" }, 404);
        const updated = await fs.update("bookings", b.id, {
          status: "submitted",
          is_archived: false,
          archived_at: ""
        });
        return j({ ok: true, booking: toFE(updated) });
      }
      if (action === "deleteBooking") {
        await requireAdmin();
        const bid_val = body.booking_id || body.bookingId;
        const b = await findBooking(fs, bid_val);
        if (!b) return j({ error: "Booking not found" }, 404);
        await fs.delete("bookings", b.id);
        return j({ ok: true, deleted: bid_val });
      }
      if (action === "markAttended") {
        await requireAdmin();
        const bid_val = body.booking_id || body.bookingId;
        const b = await findBooking(fs, bid_val);
        if (!b) return j({ error: "Booking not found" }, 404);
        const updated = await fs.update("bookings", b.id, {
          service_attended: true,
          attended: true,
          attended_at: (/* @__PURE__ */ new Date()).toISOString()
        });
        return j({ ok: true, booking: toFE(updated) });
      }
      if (action === "getPublicProducts") {
        const list = await fs.query("products", [], "-created_date");
        return j({ ok: true, products: list.filter((p) => !p.is_archived) });
      }
      if (action === "adminGetProducts") {
        await requireAdmin();
        const list = await fs.query("products", [], "-created_date");
        return j({ ok: true, products: list });
      }
      if (action === "adminSaveProduct") {
        await requireAdmin();
        const p = body.product || {};
        if (!p.name) return j({ error: "Product name required" }, 400);
        const cleanImage = (v) => {
          const s = String(v || "");
          if (s.startsWith("data:")) return "";
          return s;
        };
        if (p.image_url) p.image_url = cleanImage(p.image_url);
        if (Array.isArray(p.images)) {
          p.images = p.images.map((img) => {
            if (typeof img === "string") return cleanImage(img);
            if (img && typeof img === "object") {
              const o = img;
              if (o.url) o.url = cleanImage(o.url);
            }
            return img;
          }).filter((img) => img !== "");
        }
        const saved = p.id ? await fs.update("products", p.id, p) : await fs.create("products", p);
        return j({ ok: true, product: saved });
      }
      if (action === "adminDeleteProduct") {
        await requireAdmin();
        await fs.delete("products", body.id);
        return j({ ok: true });
      }
      if (action === "adminGetPricing") {
        await requireAdmin();
        const config = await fs.get("config", "pricing") || {};
        return j({ ok: true, pricing: config });
      }
      if (action === "adminSavePricing") {
        await requireAdmin();
        const pricing = body.pricing || {};
        await fs.set("config", "pricing", pricing);
        return j({ ok: true });
      }
      if (action === "getSmtpStatus") {
        return j({ ok: true, connected: true, configured: true, email: "beccastouchstudio@gmail.com", provider: "Base44 Gmail" });
      }
      if (action === "saveSmtpConfig") {
        return j({ ok: true, connected: true, provider: "Base44 Gmail", message: "Email is handled via Base44 Gmail relay \u2014 no configuration needed." });
      }
      if (action === "disconnectSmtp") {
        return j({ ok: true, connected: true, message: "Email uses Base44 Gmail relay." });
      }
      if (action === "testEmail") {
        await requireAdmin();
        const to = body.to || "beccastouchstudio@gmail.com";
        const override = body.templateOverride || "";
        const b = body.booking || {};
        const note = body.note || "";
        let html;
        let subject;
        if (override === "submitted") {
          html = tplSubmitted(b);
          const typeLabel = bookingTypeLabel(b);
          subject = `[TEST] ${typeLabel} booking received - ${b.booking_id || "TEST"} | ${STUDIO}`;
        } else if (override === "admin") {
          html = tplAdmin(b);
          const typeLabel = bookingTypeLabel(b);
          subject = `[TEST] New booking - ${b.booking_id || "TEST"} | ${typeLabel} | ${STUDIO}`;
        } else if (override === "statusUpdate") {
          html = tplStatusUpdate(b, note);
          subject = `[TEST] Booking update - ${b.booking_id || "TEST"} | ${STUDIO}`;
        } else {
          html = shell("", "", `
            <h2 style="margin:0 0 4px;font-size:20px;color:#3d1f6e;font-weight:800;">Email is working! \u{1F389}</h2>
            <p style="margin:0 0 16px;font-size:13px;color:#9a7080;">Hi there, this is a test email from <b>${STUDIO}</b>.</p>
            <div style="background:#f0faf3;border:1px solid #b8e0c8;border-radius:12px;padding:14px 18px;">
              <p style="margin:0;font-size:13px;color:#3d7a53;font-weight:600;">\u2705 Email delivery via Base44 Gmail is working correctly.</p>
            </div>`);
          subject = `[${STUDIO}] Test Email \u2713`;
        }
        await sendMail(env, to, subject, html, fs);
        return j({ ok: true, message: "Test email sent", email: to, template: override || "generic" });
      }
      if (action === "envCheck") {
        return j({
          project_id: env.FIREBASE_PROJECT_ID || "MISSING",
          has_b64_key: !!env.FIREBASE_PRIVATE_KEY_B64,
          b64_key_length: (env.FIREBASE_PRIVATE_KEY_B64 || "").length,
          email_provider: "Base44 Gmail relay",
          email_active: true
        });
      }
      if (action === "sendReminder") {
        const b = await findBooking(fs, body.bookingId);
        if (!b || !b.email) return j({ error: "Booking not found or no email" }, 404);
        const reminderRows = (b.preferred_date ? dr("Date", b.preferred_date) : "") + (b.start_time ? dr("Booked time", b.start_time) : "") + dr("Name", b.client_name) + dr("Phone", b.phone);
        const reminderBody = `
          <h2 style="margin:0 0 4px;font-size:20px;color:#3d1f6e;font-weight:800;">See you in 2 hours! \u23F0</h2>
          <p style="margin:0 0 20px;font-size:13px;color:#9a7080;">Hi <b>${b.client_name}</b>! Just a friendly reminder that your session is coming up in 2 hours.</p>
          ${dtable(reminderRows)}
          <p style="font-size:12px;color:#9a7090;margin-top:16px;">\u{1F4CD} <b>${ADDRESS}</b><br>\u{1F4DE} ${PHONE}<br>We cannot wait to see you! \u{1F338}</p>`;
        const reminderHtml = shell("", "", reminderBody);
        try {
          await sendMail(env, b.email, `Reminder: your session is in 2 hours - ${b.booking_id} | ${STUDIO}`, reminderHtml);
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
          client_name: o.name,
          phone: o.phone,
          email: o.email || "",
          delivery_type: o.delivery_type || "pickup",
          items: JSON.stringify(o.items || []),
          total_amount: Number(o.total_amount || 0),
          currency: "NGN",
          status: "pending",
          notes: o.notes || ""
        });
        const adminEmail = await fs.getConfig("smtp_user") || await fs.getConfig("gmail_email") || env.SMTP_USER || "";
        if (adminEmail) {
          const itemRows = (o.items || []).map((i) => dr(i.name, `x${i.qty} \u2014 NGN ${(i.price * i.qty).toLocaleString()}`)).join("");
          try {
            const shopRows = dr("Order ID", orderId) + dr("Client", String(o.name)) + dr("Phone", String(o.phone)) + (o.email ? dr("Email", String(o.email)) : "") + dr("Delivery", o.delivery_type === "home" ? "Home Delivery" : "Self Pickup") + dr("Total", "NGN " + Number(o.total_amount).toLocaleString()) + itemRows;
            const shopBody = `
              <h2 style="margin:0 0 4px;font-size:20px;color:#3d1f6e;font-weight:800;">New Shop Order \u{1F6D2}</h2>
              <p style="margin:0 0 20px;font-size:13px;color:#9a7080;">A new shop order just came in \u2014 review below.</p>
              ${dtable(shopRows)}
              <div style="margin-top:20px;text-align:center;">
                <a href="https://beccastouchstudio.vercel.app/sg-bec" style="display:inline-block;background:linear-gradient(135deg,#3d1f6e,#c8788a);color:#fff;text-decoration:none;padding:12px 28px;border-radius:50px;font-weight:700;font-size:14px;">Review in Admin Panel \u2192</a>
              </div>`;
            await sendMail(env, adminEmail, `[${STUDIO}] New shop order - ${orderId}`, shell("", "", shopBody));
          } catch (e) {
            console.error("shop order admin email:", e);
          }
        }
        return j({ ok: true, orderId, order: saved });
      }
      if (action === "adminGetShopOrders") {
        await requireAdmin();
        const orders = await fs.query("shop_orders", [], "-created_date");
        return j({ ok: true, orders });
      }
      if (action === "adminUpdateShopOrder") {
        await requireAdmin();
        const docId = body.orderId;
        const existing = await fs.get("shop_orders", docId);
        if (!existing) return j({ error: "Order not found" }, 404);
        const newOrderStatus = body.status;
        const updated = await fs.update("shop_orders", docId, {
          status: newOrderStatus,
          notes: body.notes || String(existing.notes || "")
        });
        if (newOrderStatus === "delivered" && existing.email) {
          const deliveryHtml = shell("", "", `
            <h2 style="margin:0 0 4px;font-size:20px;color:#3d1f6e;font-weight:800;">Order Delivered! \u{1F389}</h2>
            <p style="margin:0 0 20px;font-size:13px;color:#9a7080;">Hi ${String(existing.name || "there")}, your order has been delivered.</p>
            <div style="background:#f0faf3;border:1px solid #b8e0c8;border-radius:12px;padding:14px 18px;margin-bottom:20px;">
              <p style="margin:0;font-size:13px;color:#3d7a53;font-weight:600;">\u2705 Your order from ${STUDIO} is on its way or has arrived!</p>
            </div>
            ${dtable(
            dr("Order ID", String(existing.order_id || docId)) + dr("Name", String(existing.name || "")) + dr("Phone", String(existing.phone || ""))
          )}
            <div style="margin-top:20px;padding:14px 18px;background:#fdf6f9;border-radius:12px;border:1px solid #eecdd4;">
              <p style="margin:0;font-size:13px;color:#7a4060;line-height:1.7;">Thank you so much for shopping with us at <b>${STUDIO}</b>! \u{1F338}<br>We hope you absolutely love your order. We cannot wait to serve you again \u2014 see you soon! \u{1F484}</p>
            </div>
            <p style="font-size:12px;color:#9a7090;margin-top:16px;">Questions? WhatsApp us on <b>${WHATSAPP}</b></p>`);
          try {
            await sendMail(env, existing.email, `[${STUDIO}] Your order has been delivered! \u{1F389}`, deliveryHtml, fs);
          } catch (e) {
            console.error("delivery email:", e);
          }
        }
        return j({ ok: true, order: updated });
      }
      if (action === "adminDeleteShopOrder") {
        await requireAdmin();
        const docId = body.orderId;
        const existing = await fs.get("shop_orders", docId);
        if (!existing) return j({ error: "Order not found" }, 404);
        await fs.delete("shop_orders", docId);
        return j({ ok: true });
      }
      if (action === "checkUnconfirmedBookings") {
        const secret = body.secret || "";
        const EXPECTED = env.BECCA_MAIL_SECRET || "~mQmAT.s6BUB'L.";
        if (secret !== EXPECTED) return j({ error: "Unauthorized" }, 401);
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1e3).toISOString();
        const all = await fs.query("bookings", [], "-created_date", 200);
        const stale = all.filter(
          (b) => b.status === "pending" && !b.is_archived && b.created_date < twoHoursAgo && !b.reminder_sent
        );
        const allOrders = await fs.query("shop_orders", [], "-created_date", 200);
        const staleOrders = allOrders.filter(
          (o) => o.status === "pending" && o.created_date < twoHoursAgo && !o.reminder_sent
        );
        const adminEmail = await fs.getConfig("smtp_user") || await fs.getConfig("gmail_email") || env.SMTP_USER || "";
        if (!adminEmail) return j({ ok: true, reminded: 0 });
        let reminded = 0;
        for (const b of stale) {
          const html = shell("", "", `
            <h2 style="margin:0 0 4px;font-size:20px;color:#3d1f6e;font-weight:800;">\u23F0 Pending Booking Reminder</h2>
            <p style="margin:0 0 16px;font-size:13px;color:#9a7080;">A booking has been waiting over 2 hours without a response.</p>
            ${dtable(dr("Booking ID", b.booking_id) + dr("Client", b.client_name) + dr("Phone", b.phone) + dr("Type", bookingTypeLabel(b)) + (b.preferred_date ? dr("Date", b.preferred_date) : "") + dr("Submitted", new Date(b.created_date).toLocaleString("en-GB")))}
            <div style="margin-top:20px;text-align:center;"><a href="https://beccastouchstudio.vercel.app/sg-bec" style="display:inline-block;background:linear-gradient(135deg,#3d1f6e,#c8788a);color:#fff;text-decoration:none;padding:12px 28px;border-radius:50px;font-weight:700;font-size:14px;">Review in Admin Panel \u2192</a></div>`);
          try {
            await sendMail(env, adminEmail, `[${STUDIO}] \u23F0 Booking pending 2h+ - ${b.booking_id}`, html, fs);
            await fs.update("bookings", b.id, { reminder_sent: true });
            reminded++;
          } catch (e) {
            console.error("reminder failed:", e);
          }
        }
        for (const o of staleOrders) {
          const html = shell("", "", `
            <h2 style="margin:0 0 4px;font-size:20px;color:#3d1f6e;font-weight:800;">\u23F0 Pending Shop Order Reminder</h2>
            <p style="margin:0 0 16px;font-size:13px;color:#9a7080;">A shop order has been waiting over 2 hours without action.</p>
            ${dtable(dr("Order ID", String(o.order_id || o.id)) + dr("Client", o.name) + dr("Phone", o.phone) + dr("Submitted", new Date(o.created_date).toLocaleString("en-GB")))}
            <div style="margin-top:20px;text-align:center;"><a href="https://beccastouchstudio.vercel.app/sg-bec" style="display:inline-block;background:linear-gradient(135deg,#3d1f6e,#c8788a);color:#fff;text-decoration:none;padding:12px 28px;border-radius:50px;font-weight:700;font-size:14px;">Review Orders \u2192</a></div>`);
          try {
            await sendMail(env, adminEmail, `[${STUDIO}] \u23F0 Shop order pending 2h+ - ${String(o.order_id || o.id)}`, html, fs);
            await fs.update("shop_orders", o.id, { reminder_sent: true });
            reminded++;
          } catch (e) {
            console.error("order reminder failed:", e);
          }
        }
        return j({ ok: true, reminded, staleBookings: stale.length, staleOrders: staleOrders.length });
      }
      return j({ error: "Unknown action" }, 400);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Worker error:", msg);
      return j({ error: msg }, 500);
    }
  }
};
export {
  worker_default as default
};
