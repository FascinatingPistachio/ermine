# Ermine

Ermine is a Discord-inspired web client for **stoat.chat** with custom branding, a cleaner layout, and a more polished day-to-day chat experience.

## Highlights

- **Discord-like shell layout**
  - Server rail on the left
  - Channel list sidebar
  - Main chat timeline + composer
  - Member list on the right
- **Ermine branding**
  - Updated login screen branding and copy
  - Ermine references in app chrome
- **Better UX defaults**
  - Improved spacing, hierarchy, and color consistency
  - Friend list landing experience for `@me`
  - Profile popout modal for users/members
- **Core Stoat/Revolt functionality preserved**
  - Session login (credentials or token)
  - Config discovery from API root
  - Realtime events over websocket
  - Message sending and timeline updates

## Configuration

The client defaults to:

- API: `https://api.stoat.chat`
- WebSocket: `wss://stoat.chat/events`
- CDN: `https://autumn.revolt.chat`

You can override these in **Advanced connection settings** on the login screen.

## Local development

This repository currently contains the main app component at:

- `src/App.jsx`

Use your existing React/Tailwind host setup to run it locally.

## Brand direction

This app is intentionally branded as **Ermine**, designed for the **stoat.chat** ecosystem while keeping a familiar Discord-like interaction model.


## Deploying on Vercel

This project includes a `vercel.json` SPA rewrite so deep links resolve correctly to `/` (framework entrypoint) on Vercel, which avoids hard-coding an `index.html` file.

For environment-specific endpoints, set these Vercel environment variables:

- `VITE_STOAT_API_URL`
- `VITE_STOAT_WS_URL`
- `VITE_STOAT_CDN_URL`

The app will use those values at build time, while still allowing manual overrides from **Advanced connection settings** on the login screen.
