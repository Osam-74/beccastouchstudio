export const SITE = {
  name: 'Beccastouch Studio',
  location: 'Total Filling Station, Oju-Irin Bodija, Ibadan, Oyo State',
  email: 'hello@beccastouchstudio.com',
  phone: '08023274274',
  whatsapp: '2348051982695',
  instagram: 'https://www.instagram.com/beccastouch?igsh=NG0zNmkxeWFzdjV6',
  tiktok: 'https://www.tiktok.com/@beccastouch',
  bankName: 'First Bank',
  accountName: 'Beccastouch Studio',
  accountNumber: '0123456789',
  currency: 'NGN',
};

export const OPENING_HOURS = {
  weekdays: { label: 'Monday – Saturday', hours: '8:00 AM – 6:00 PM' },
  sunday:   { label: 'Sunday', hours: 'Special home-service requests only' },
};

export const BOOKING_RULES = [
  'Your booking is provisional until payment is verified and the studio confirms your slot.',
  'Please keep your booking ID safe. You can use it to track your status or continue a saved booking later.',
  'If you are visiting the studio, arrive at least 15 minutes before your approved session time.',
  'Request date/time changes early so the team can confirm availability.',
  'For home service bookings, your full address and contact number must stay reachable before confirmation.',
  'Please note, no refunds after payment.',
];

export const STUDIO_HOURS = [
  '08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00',
];

export const STUDIO_PRICING = {
  single_half: 10000,
  single:      15000,
  group:       25000,
};

export const GLAM_WALKIN = {
  makeup:        40000,
  gele:          10000,
  'makeup+gele': 45000,
};

export const GLAM_BASE_PRICING = {
  makeup:        { general: { studio: 40000, home: 50000 }, bridal: { studio: 0, home: 0 } },
  gele:          { general: { studio: 10000, home: 15000 }, bridal: { studio: 0, home: 0 } },
  'makeup+gele': { general: { studio: 45000, home: 55000 }, bridal: { studio: 0, home: 0 } },
};

export const GLAM_EXTRAS = {
  bridesmaidMakeup:  12000,
  bridesmaidGele:     8000,
  extraDayMultiplier: 0.65,
};
