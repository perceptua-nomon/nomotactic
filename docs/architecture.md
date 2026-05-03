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
│  │  ├── _layout.tsx        (root layout + AuthProvider + TransportProvider)    │     │
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
                          authenticated or guest → redirect to /(app)/
                          mobile + unauthenticated → redirect to /login
                          web + unauthenticated → landing page
  login.tsx           → Login / register (single screen, mode toggle)
                          "Continue without account" → sets isGuest, enters /(app)
  (app)/
    _layout.tsx       → Auth guard (authenticated or guest) + CommandInput bar at bottom
    index.tsx         → Devices dashboard: fleet + local device list, BLE pairing
    register-device.tsx → Local nomothetic registration after BLE connect
    device/[id].tsx   → Per-device control view with expandable cards
```

**Total screens: 4** (entry, login, devices dashboard, device detail).
Control cards live on the per-device screen, keeping the dashboard focused
on fleet discovery and pairing.

## Platform Modes

| Context | Behaviour |
|---------|-----------|
| **Web, unauthenticated** | Landing page (hero, features, CTA to login) |
| **Web, authenticated** | Fleet dashboard. No Bluetooth features. Motor controls hidden (no BLE fallback). HTTPS only. |
| **Mobile, WiFi connected** | Full device control: motors, camera, sensors, settings, calibration. HTTPS transport. |
| **Mobile, BLE only** | Basic control: motor commands, servo, battery, sensors via NDJSON over BLE (same JSON format as the HTTPS API). Camera/audio/calibration/routines unavailable (require HTTPS). |
| **Mobile, BLE → WiFi transition** | After BLE pairing, app exchanges WiFi credentials over BLE. Pi joins WiFi. App switches to HTTPS for full feature set. JWT from BLE pairing is reused. |
| **Mobile, guest (no account)** | Login skipped via "Continue without account". BLE pairing available. Dashboard shows locally-paired devices only; central fleet unavailable. |

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

### Guest Mode

Users who choose "Continue without account" on the login screen call
`continueAsGuest()` in `AuthContext`, setting an in-memory `isGuest: boolean`
flag (not persisted to storage). This flag:

- Allows the `(app)` auth guard to pass without a JWT
- Is cleared on app restart or explicit logout
- The top bar renders a "Sign In" link in place of "Logout" for guests
- Guest users can BLE-pair devices and see them on the dashboard via the
  local device registry (see [Local Device Registry](#local-device-registry))

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

`lib/ble.ts` defines a `BleService` interface for BLE communication:

```
interface BleService {
  scan(): Promise<Device[]>
  connect(deviceId: string): Promise<void>
  disconnect(): Promise<void>
  authenticate(): Promise<string>
  sendJsonCommand(method: string, params: object): Promise<object>
  drive(speedPct: number, ttlMs?: number): Promise<void>
  steer(angleDeg: number, ttlMs?: number): Promise<void>
  getBattery(): Promise<{ voltage_v: number }>
  readUltrasonic(): Promise<{ distance_cm: number }>
  onStatusChange(callback: (status: ConnectionStatus) => void): void
}
```

Phase 1 shipped `MockBleService` — all methods return stub data (web platform).
Phase 2 (complete) added `RealBleService` using `react-native-ble-plx` with:

- BLE device discovery by nomon GATT service UUID
- OS-level Bluetooth passkey pairing (6-digit code; no app-layer crypto)
- NDJSON relay over single GATT service (2 characteristics)
- `authenticate()` IPC call after bonding → JWT
- WiFi provisioning via standard IPC methods over NDJSON
- Hybrid transport layer (`lib/transport.ts`) for BLE → HTTPS switching

Web platform always receives `MockBleService` (BLE is mobile-only).

### BLE Session Registry

`lib/ble.ts` exposes a module-level session registry that survives navigation
transitions:

- `registerBleSession(deviceId, ble)` — stores an active `BleService` instance
  keyed by OS BLE device ID
- `getBleSession(deviceId)` — retrieves the session for a given device
- `clearBleSession(deviceId)` — removes the session on disconnect or cleanup

`BlePairingFlow` calls `registerBleSession` after `ble.authenticate()`. The
device page activates the session by calling `transport.activateSession(id)`,
which looks up `getBleSession(id)` and wires the result into `TransportProvider`.
Sessions are keyed by OS BLE device ID, supporting concurrent sessions for
different devices.

### BLE Transport Architecture

```
┌─────────────────────────────────────────────────────┐
│  nomotactic (mobile)                                │
│                                                     │
│  TransportProvider                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ if WiFi available:  ─── HTTPS ───▶ nomothetic  │  │
│  │ if BLE only:        ─── BLE  ───▶ nomopractic │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘

  BLE path (NDJSON chunks):                  HTTPS path (JSON):
  nomotactic                                  nomotactic
   │ BLE GATT write (NDJSON chunks)            │ fetch() + JSON
   └─▶ nomopractic BLE GATT server              └─▶ nomothetic REST API
       │ ble/bridge.rs → handler.rs                  │ HatClient → IPC
       └─▶ HAT hardware                               └─▶ nomopractic → HAT
```

BLE provides a subset of the HTTPS feature set (motor/servo/sensor commands).
Camera, audio, streaming, calibration, and routines require HTTPS.

`TransportProvider` is mounted at the root layout (`app/_layout.tsx`) — not
per-device page — so the BLE session established during pairing persists across
navigation. The device page calls `transport.activateSession(deviceId)` on
mount, which looks up the registered session and sets the transport mode.

## AI-Ready Command Input

A persistent `CommandInput` component at the bottom of the authenticated
layout (see [ADR-002](adr/002-ai-ready-ux.md)):

- Text input + submit button
- Inline response bubble
- Stub handler initially; replaced by AI endpoint in a future phase
- Keyboard-avoiding on mobile, fixed-bottom on web

## Local Device Registry

`lib/local-devices.ts` maintains a persistent list of BLE-paired devices
independently of the central fleet API, enabling the dashboard to show devices
for guest users and during offline operation.

```ts
interface LocalDevice {
  id: string;          // OS BLE device ID (stable identifier)
  name: string;        // device-announced or user-assigned name
  pairedAt: string;    // ISO 8601 timestamp
  bleDeviceId: string; // same as id initially; preserved for lookup
  vin: string | null;  // nomothetic VIN once registered, null otherwise
  source: 'local';     // discriminant
}
```

Storage: JSON-encoded array at key `nomon_local_devices`, using the same
cross-platform storage pattern as auth tokens (`expo-secure-store` on mobile,
`localStorage` on web). No additional npm dependency required.

`useDevices` loads both central and local device lists in parallel and merges
them. Deduplication: if a local device's `vin` matches a central fleet device,
the central entry takes precedence and the local entry is omitted.
`Device.source: 'central' | 'local'` distinguishes registry origin. The
dashboard renders a "Local" pill badge for source `'local'` devices.

Future: when a guest user logs in, a sync prompt will offer to promote
local-only devices to the central fleet registry.

## Dependencies

**Production (current):**
- `expo` ~54.x, `expo-router` ~6.x (framework + routing)
- `react` 19.x, `react-native` 0.81.x (UI runtime)
- `react-native-web` ~0.21.x (web platform support)
- `react-native-safe-area-context` (safe area insets)
- `react-native-screens` (native navigation)
- `react-native-gesture-handler` (gesture support)
- `react-native-ble-plx` (BLE GATT client for Android/iOS)

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
