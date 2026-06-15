const API_URL = 'https://beccastouchstudio-api.amusanolamide74.workers.dev';

// Public request (no auth needed)
async function request(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || 'Something went wrong');
  return data;
}

// Admin request — includes Firebase ID token in Authorization header
async function adminRequest(payload, idToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || 'Something went wrong');
  return data;
}

export const bookingApi = {
  // ── Public (no auth) ────────────────────────────────────────────────────────
  saveDraft:           (booking)                => request({ action:'saveDraft', booking }),
  submitBooking:       (booking)                => request({ action:'submitBooking', booking }),
  getBooking:          (bookingId)              => request({ action:'getBooking', bookingId }),
  searchBookings:      (q)                      => request({ action:'searchBookings', q }),
  getProducts:         ()                       => request({ action:'getProducts' }),
  saveShopOrder:       (order)                  => request({ action:'saveShopOrder', order }),
  getAdminProfile:     ()                       => request({ action:'getAdminProfile', pin: '' }),
  reschedule:          (bookingId, newDate, newTime) => request({ action:'reschedule', bookingId, newDate, newTime }),

  // ── Admin (Firebase auth — pass idToken as second arg) ───────────────────
  adminOverview:       (pin, tok)               => adminRequest({ action:'adminOverview', pin }, tok),
  adminUpdateStatus:   (pin, bookingId, status, adminNote='', rejectionReason='', tok) =>
    adminRequest({ action:'adminUpdateStatus', pin, bookingId, status, adminNote, rejectionReason }, tok),
  archiveBooking:      (pin, bookingId, tok)    => adminRequest({ action:'archiveBooking', pin, bookingId }, tok),
  restoreBooking:      (pin, bookingId, tok)    => adminRequest({ action:'restoreBooking', pin, bookingId }, tok),
  markAttended:        (pin, bookingId, tok)    => adminRequest({ action:'markAttended', pin, bookingId }, tok),
  deleteBooking:       (pin, bookingId, tok)    => adminRequest({ action:'deleteBooking', pin, bookingId }, tok),
  deleteUser:          (pin, userId, tok)       => adminRequest({ action:'deleteUser', pin, userId }, tok),
  saveAdminProfile:    (pin, name, tok)         => adminRequest({ action:'saveAdminProfile', pin, name }, tok),
  sendReminder:        (pin, bookingId, tok)    => adminRequest({ action:'sendReminder', pin, bookingId }, tok),
  adminGetProducts:    (pin, tok)               => adminRequest({ action:'adminGetProducts', pin }, tok),
  adminSaveProduct:    (pin, product, tok)      => adminRequest({ action:'adminSaveProduct', pin, product }, tok),
  adminDeleteProduct:  (pin, id, tok)           => adminRequest({ action:'adminDeleteProduct', pin, id }, tok),
  adminGetPricing:     (pin, tok)               => adminRequest({ action:'adminGetPricing', pin }, tok),
  adminSavePricing:    (pin, pricing, tok)      => adminRequest({ action:'adminSavePricing', pin, pricing }, tok),
  adminGetShopOrders:  (pin, tok)               => adminRequest({ action:'adminGetShopOrders', pin }, tok),
  adminUpdateShopOrder:(pin, orderId, status, notes, tok) => adminRequest({ action:'adminUpdateShopOrder', pin, orderId, status, notes }, tok),
  adminDeleteShopOrder:(pin, orderId, tok)      => adminRequest({ action:'adminDeleteShopOrder', pin, orderId }, tok),
  adminConfigSmtp:     (pin, config, tok)       => adminRequest({ action:'saveSmtpConfig', pin, config }, tok),
  resetPin:            (pin, newPin, tok)       => adminRequest({ action:'resetPin', pin, new_pin: newPin }, tok),
  uploadImage:         (imageBase64, mimeType, tok) => adminRequest({ action:'uploadImage', imageBase64, mimeType }, tok),
};
