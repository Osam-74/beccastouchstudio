# Lumiere Studio — Website

Professional photo studio and makeup artistry booking website.

## Tech Stack
- React 18 + Vite
- Tailwind CSS v3
- React Router (HashRouter — works on GitHub Pages)
- localStorage data layer (no backend required)
- lucide-react, date-fns

## Quick Start

```bash
npm install
npm run dev
```

## Customise Your Details
Open `src/utils/store.js` and update `DEFAULT_SETTINGS`:
- studioName, email, whatsapp, momoNumber, momoName, address, adminPin

Change adminPin immediately. Default is 1234.

## Deploy to GitHub Pages

1. Update `homepage` in package.json to your GitHub Pages URL:
   `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME`

2. Run:
   `npm run deploy`

This builds and pushes to gh-pages branch automatically.

## Admin Dashboard
Visit `/#/admin` — PIN protected. Contains:
- Overview stats (pending/confirmed/rejected bookings + revenue)
- Bookings manager (confirm, reject, add notes, filter by status)
- Product manager (add/delete shop products)
- Pricing editor (update all studio and glam rates)
- Settings (contact info, MoMo details, admin PIN)

## Features
- Studio booking: calendar, session type, duration (30min multiples), start time, auto end-time, price display, lock-in, form, receipt upload, Session ID
- Glam booking: service type, occasion, bridal sub-options, bridesmaids, days, location, live pricing, form, receipt upload, Booking ID
- Shop: WhatsApp order links auto-tag product name
- All bookings start as PENDING, admin manually confirms after payment review
