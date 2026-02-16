# Ermine

<p align="center">
  <img src="https://github.com/FascinatingPistachio/ermine/blob/main/assets/android-chrome-512x512.png?raw=true" width="120" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Build-Experimental-8AB4F8?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Interface-Refined-9FC3E8?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Ecosystem-stoat.chat-171A21?style=for-the-badge" />
</p>

---

Ermine is a refined, Discord-inspired web client for **stoat.chat**.

It prioritizes clarity, hierarchy, and composure while preserving core Stoat/Revolt functionality.

This project is **experimental** and under active development.

---

## Interface

**Structured Layout**

- Space rail  
- Channel sidebar  
- Timeline + composer  
- Member panel  

**Interaction Model**

- Reduced visual noise  
- Sharper spacing and hierarchy  
- Controlled frost-toned color system  

**App Chrome Adjustments**

- “Preferences” instead of “User Settings”  
- “Direct” instead of “Friends”  
- “Live” instead of “Active Now”  

Familiar structure. Cleaner execution.

---

## Functionality

Core Stoat/Revolt capabilities:

- Session login (credentials or token)  
- API root configuration discovery  
- Realtime events over WebSocket  
- Message sending and timeline updates  
- Profile popout modal  
- `@me` landing experience  

---

## Configuration

Default endpoints:

```
API:        https://api.stoat.chat
WebSocket:  wss://stoat.chat/events
CDN:        https://autumn.revolt.chat
```

Overrides are available under:

**Advanced connection configuration**

---

## Local Development

Entry point:

```
src/App.jsx
```

Run using your existing React + Tailwind setup.

---

## Deployment (Vercel)

Includes `vercel.json` SPA rewrite support so deep links resolve to `/`.

Optional environment variables:

```
VITE_STOAT_API_URL
VITE_STOAT_WS_URL
VITE_STOAT_CDN_URL
```

Values are injected at build time. Manual overrides remain available from the login screen.

---

## Privacy

- Session continuity is maintained using browser cookies:
  - `ermine_session_token`
  - `ermine_user_id`
  - `ermine_api_url`
- Ermine does not store user content outside configured stoat.chat endpoints.
- Network communication is limited to selected API, WebSocket, and CDN endpoints.
- See `privacy-policy.html` for the user-facing notice.

---

## Direction

Ermine is the composed interface layer for the stoat.chat ecosystem.

**Minimal shell. Full control.**
