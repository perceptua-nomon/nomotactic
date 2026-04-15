# nomotactic — Architecture

## System Overview

nomotactic is the user-facing application for the nomon fleet. Built with
Expo (React Native), it serves Android, iOS, and web from a single TypeScript
codebase (see [ADR-001](adr/001-expo-web-mobile-single-app.md)).

```
┌──────────────────────────────────────────────────────────────────┐
│  nomotactic (Expo / React Native)                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  app/                                                    │     │
│  │  ├── _layout.tsx        (root layout + AuthProvider)    │     │
│  │  ├── index.tsx           (entry: landing / redirect)     │     │
│  │  ├── login.tsx           (login / register screen)       │     │
│  │  └── (app)/                                              │     │
│  │      ├── _layout.tsx     (auth guard + command bar)      │     │
│  │      ├── index.tsx       (devices dashboard + pairing)   │     │
│  │      └── device/[id].tsx (per-device control cards)      │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  lib/api.ts  │  │ lib/auth.ts  │  │lib/devices.ts│           │
│  │  (API client)│  │(auth context)│  │ (fleet hook) │           │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘           │
│         │                 │                                       │
└─────────┼─────────────────┼───────────────────────────────────────┘
          │ HTTPS           │ HTTPS
          ▼                 ▼
  ┌───────────────┐  ┌───────────────┐
  │  nomothetic   │  │  nomothetic   │
  │ (device mode) │  │(central mode) │
  │   Pi :8443    │  │  server :443  │
  └───────────────┘  └───────────────┘
```

## Design Principles

1. **Lightweight over feature-rich.** Single-screen UIs. Minimal navigation.
2. **Speed is UX.** Small bundle. Few renders. Minimal network round-trips.
3. **Simple state.** React context + local `useState`. No Redux/MobX/Zustand.
4. **Progressive disclosure.** Show what's needed now. Expand inline.
5. **Platform-native feel.** Safe areas, gestures, haptics — not custom chrome.

## Navigation Structure

File-based routing via `expo-router`. Minimal page count.

```
app/
  _layout.tsx         → Root layout: wraps app in AuthProvider, sets StatusBar
  index.tsx           → Entry point:
                          authenticated → redirect to /(app)/
                          mobile + unauthenticated → redirect to /login
                          web + unauthenticated → landing page
  login.tsx           → Login / register (single screen, mode toggle)
  (app)/
    _layout.tsx       → Auth guard (/login redirect) + CommandInput bar at bottom
    index.tsx         → Devices dashboard: fleet list + pairing form
    device/[id].tsx   → Per-device control view with expandable cards
```

**Total screens: 4** (entry, login, devices dashboard, device detail).
Control cards live on the per-device screen, keeping the dashboard focused
on fleet discovery and pairing.

## Platform Modes

| Context | Behaviour |
|---------|-----------|
| **Web, unauthenticated** | Landing page (hero, features, CTA to login) |
| **Web, authenticated** | Fleet dashboard. No Bluetooth features. Motor controls hidden (no BLE fallback). |
| **Mobile, WiFi connected** | Full device control: motors, camera, sensors, settings, calibration |
| **Mobile, BLE only** | (Future) Limited control: motor commands, device status via BLE |

Platform detection uses `Platform.OS` from React Native. Feature visibility
is conditional, not page-based.

## Authentication Flow

```
┌────────────┐     POST /api/auth/login      ┌────────────────┐
│  login.tsx │  ──────────────────────────▶  │  nomothetic    │
│            │  ◀──────────────────────────  │  (central mode)│
│            │  { access_token,              │                │
│            │    refresh_token }            └────────────────┘
└─────┬──────┘
      │ store tokens
      ▼
┌────────────────────────┐
│  expo-secure-store     │  (mobile: OS keychain)
│  localStorage          │  (web: browser storage)
└────────────────────────┘
      │                        ┌────────────────┐
      │  Authorization: Bearer │  nomothetic    │
      └──────────────────────▶ │  (any mode)    │
                               └────────────────┘
```

- `AuthContext` provides `login()`, `logout()`, `register()`, `isAuthenticated`
- Login screen is the single redirect authority after submit: success updates
  auth state, and route transition is handled by one auth-state effect
- API client injects `Authorization: Bearer <token>` on every request
- On 401 response, client attempts automatic refresh via `/api/auth/refresh`
- If refresh fails, user is redirected to login
- `expo-secure-store` on mobile (OS keychain); `localStorage` on web

## API Client

`lib/api.ts` exports a typed client that wraps `fetch`:

- Base URL configurable per environment (device IP or central server URL)
- Automatic auth header injection from `AuthContext`
- Timeout handling (default 10 s for control commands, 30 s for data queries)
- Error response parsing (matches nomothetic Pydantic error shapes)
- No external HTTP library dependency — uses built-in `fetch`

## Component Architecture

Devices dashboard and detail view split responsibilities:

- `app/(app)/index.tsx` shows fleet list cards and pairing UI.
- `app/(app)/device/[id].tsx` renders the expandable control cards.

Per-device control uses **expandable card components** for progressive disclosure:

| Card | Content | Default state |
|------|---------|---------------|
| **Status** | Battery, uptime, firmware, connection | Expanded (always visible) |
| **Motor Control** | D-pad, speed slider, stop button | Collapsed |
| **Camera** | Capture button, stream link | Collapsed |
| **Sensors** | Ultrasonic, grayscale readings | Collapsed |
| **Routine** | Start/stop explore, status display | Collapsed |

Each card is a self-contained component managing its own state. Cards
fetch data independently and handle their own error states.

## BLE Abstraction

`lib/ble.ts` defines a `BleService` interface:

```
interface BleService {
  scan(): Promise<Device[]>
  connect(deviceId: string): Promise<void>
  disconnect(): Promise<void>
  sendCommand(method: string, params: object): Promise<object>
  onStatusChange(callback: (status: ConnectionStatus) => void): void
}
```

Phase 1 ships with `MockBleService` — all methods return stub data.
A future phase will add `RealBleService` using a BLE library.

## AI-Ready Command Input

A persistent `CommandInput` component at the bottom of the authenticated
layout (see [ADR-002](adr/002-ai-ready-ux.md)):

- Text input + submit button
- Inline response bubble
- Stub handler initially; replaced by AI endpoint in a future phase
- Keyboard-avoiding on mobile, fixed-bottom on web

## Dependencies

**Production (current):**
- `expo` ~54.x, `expo-router` ~6.x (framework + routing)
- `react` 19.x, `react-native` 0.81.x (UI runtime)
- `react-native-web` ~0.21.x (web platform support)
- `react-native-safe-area-context` (safe area insets)
- `react-native-screens` (native navigation)
- `react-native-gesture-handler` (gesture support)

**To add in Phase 1:**
- `expo-secure-store` (credential storage on mobile)

**No additional UI libraries.** All components built with core RN primitives
(`View`, `Text`, `TextInput`, `Pressable`, `ScrollView`, `Platform`).

## Build & Deploy

| Platform | Build | Output |
|----------|-------|--------|
| Android | EAS Build | `.apk` / `.aab` |
| iOS | EAS Build | `.ipa` |
| Web | `expo export --platform web` | Static files (SPA) |

Web output is deployed to a CDN or served by nginx alongside the central
nomothetic API.

## Security

- Tokens stored in OS keychain on mobile (`expo-secure-store`)
- Web uses `localStorage` — acceptable for development; flag for production
  security review (consider `httpOnly` cookies if SSR is added)
- No secrets in source — API URLs from environment/config
- HTTPS enforced for all API communication
- Self-signed cert acceptance documented for device-mode connections
