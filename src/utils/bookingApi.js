const API_URL = 'https://beccastouchstudio-api.amusanolamide74.workers.dev';
async function request(payload) {
  const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const data = await res.json().catch(()=>({}));
  if (!res.ok || data.error) throw new Error(data.error || 'Something went wrong');
  return data;
}
export const bookingApi = {
  saveDraft:           (booking)                           => request({ action:'saveDraft', booking }),
  submitBooking:       (booking)                           => request({ action:'submitBooking', booking }),
  getBooking:          (bookingId)                         => request({ action:'getBooking', bookingId }),
  searchBookings:      (query)                             => request({ action:'searchBookings', ...query }),
  adminOverview:       (pin)                               => request({ action:'adminOverview', pin }),
  adminUpdateStatus:   (pin, bookingId, status, adminNote='', rejectionReason='') => request({ action:'adminUpdateStatus', pin, bookingId, status, adminNote, rejectionReason }),
  archiveBooking:      (pin, bookingId)                    => request({ action:'archiveBooking', pin, bookingId }),
  restoreBooking:      (pin, bookingId)                    => request({ action:'restoreBooking', pin, bookingId }),
  resetPin:            (currentPin, newPin)                => request({ action:'resetPin', currentPin, newPin }),
  deleteBooking:       (pin, bookingId)                    => request({ action:'deleteBooking', pin, bookingId }),
  markAttended:        (pin, bookingId)                    => request({ action:'markAttended', pin, bookingId }),
  adminGetProducts:    (pin)                               => request({ action:'adminGetProducts', pin }),
  adminSaveProduct:    (pin, product)                      => request({ action:'adminSaveProduct', pin, product }),
  adminDeleteProduct:  (pin, productId)                    => request({ action:'adminDeleteProduct', pin, productId }),
  adminGetPricing:     (pin)                               => request({ action:'adminGetPricing', pin }),
  adminSavePricing:    (pin, key, value)                   => request({ action:'adminSavePricing', pin, key, value }),
  saveAdminProfile:    (pin, name)                         => request({ action:'saveAdminProfile', pin, name }),
  getAdminProfile:     ()                                  => request({ action:'getAdminProfile' }),
  getPublicProducts:   ()                                  => request({ action:'getPublicProducts' }),
  sendReminder:        (bookingId)                          => request({ action:'sendReminder', bookingId }),
  saveShopOrder:       (order)                              => request({ action:'saveShopOrder', order }),
  adminGetShopOrders:  (pin)                                => request({ action:'adminGetShopOrders', pin }),
  adminUpdateShopOrder:(pin, orderId, status, notes)        => request({ action:'adminUpdateShopOrder', pin, orderId, status, notes }),
  adminDeleteShopOrder:(pin, orderId)                       => request({ action:'adminDeleteShopOrder', pin, orderId }),
  // Email (SMTP App Password) setup
  getSmtpStatus:       (pin)                               => request({ action:'getSmtpStatus', pin }),
  saveSmtpConfig:      (pin, smtpUser, smtpPass)           => request({ action:'saveSmtpConfig', pin, smtpUser, smtpPass }),
  disconnectSmtp:      (pin)                               => request({ action:'disconnectSmtp', pin }),
  testEmail:           (pin)                               => request({ action:'testEmail', pin }),
};
