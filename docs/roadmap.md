# nomotactic — Development Roadmap

## Status Summary

| Phase | Name | Status |
|-------|------|--------|
| 1.1 | Project Foundation | ✅ Complete |
| 1.2 | Auth Flow | ✅ Complete |
| 1.3 | Device Control Dashboard | ✅ Complete |
| 1.4 | Web Experience | ✅ Complete |
| 1.5 | BLE Abstraction Stubs | ✅ Complete |
| 1.6 | AI-Ready Command Input | ✅ Complete |
| 2 | BLE Integration | ✅ Complete |

---

## Current State

Phases 1 and 2 are complete. The app has:
- Expo SDK 54 with expo-router navigation
- Dark theme, typed API client with auth injection and 401 retry guard
- JWT auth flow with expo-secure-store (mobile) / localStorage (web)
- Device control dashboard with 5 expandable card components
- Web landing page for unauthenticated visitors
- BLE device discovery, pairing, and encrypted command interface
- Binary protocol codec and AES-128-CCM session encryption
- Hybrid transport layer (BLE ↔ HTTPS auto-switching)
- WiFi provisioning over BLE
- Connection state indicator with auto-reconnect
- AI-ready command input bar
- `npx expo lint` clean

### Hotfixes

- 2026-04-14: iOS logout redirect loop (`Maximum update depth exceeded`) fixed
  by keeping `/login` as the unauthenticated redirect target for `(app)` and
  centralizing post-login route transition in `login.tsx` auth-state redirect.

---

## Phase 1 — App Foundation & Auth

**Goal:** Deliver a functional cross-platform app with authentication,
device control, and a web landing page. Establish the patterns for all
future development.

**Cross-repo dependency:** Requires nomothetic Phase 13 (central mode +
JWT auth) for auth flow and fleet endpoints.

### 1.1 — Project Foundation

**Goal:** Establish theming, API client, configuration, and project structure.

- [x] `constants/config.ts` — API base URL (device and central), configurable
      per environment
- [x] `lib/theme.ts` — colour palette, spacing, typography constants (dark
      theme primary, light secondary)
- [x] `lib/api.ts` — typed API client wrapping `fetch`:
  - Base URL from config
  - Auth header injection (reads token from context)
  - Response parsing matched to nomothetic Pydantic error shapes
  - Timeout handling (10 s default)
  - 401 interception for auto-refresh
- [x] Modify `app/_layout.tsx` — set `StatusBar`, wrap in providers
- [x] Add `expo-secure-store` dependency
- [x] Remove or archive `app-example/` directory

**Exit criteria:**
- ✅ `npx expo lint` clean
- ✅ API client can be imported and instantiated in a test component
- ✅ Theme constants applied to root layout

### 1.2 — Auth Flow

**Goal:** Login and registration with secure token persistence.

**Dependency:** nomothetic Phase 13.2–13.3 (JWT auth module + user endpoints).

- [x] `lib/auth.ts` — `AuthContext` and `AuthProvider`:
  - `login(email, password)` → calls `POST /api/auth/login`, stores tokens
  - `register(email, password, displayName)` → calls `POST /api/auth/register`
  - `logout()` → clears tokens
  - `refreshToken()` → calls `POST /api/auth/refresh`, rotates tokens
  - `isAuthenticated: boolean` derived from token presence
  - Token storage: `expo-secure-store` on mobile, `localStorage` on web
- [x] `app/login.tsx` — single-screen login / register:
  - Email + password fields
  - Toggle between login and register mode (progressive disclosure)
  - Social login placeholder buttons (disabled, "Coming Soon" label)
  - Error display (inline, below form)
  - Loading state on submit
- [x] `app/_layout.tsx` — wrap children in `AuthProvider`
- [x] Tests: manual verification (login → token stored → authenticated state)

**Exit criteria:**
- ✅ Login screen renders on all platforms
- ✅ Successful login stores token and updates `isAuthenticated`
- ✅ 401 from API triggers automatic token refresh attempt
- ✅ `npx expo lint` clean

### 1.3 — Device Control Dashboard

**Goal:** Fleet-first dashboard with per-device control detail.

- [x] `app/(app)/_layout.tsx` — authenticated route group:
  - Auth guard: redirect to `/login` if not authenticated
  - Layout wrapper (safe area, content slot, command bar)
- [x] `app/(app)/index.tsx` — dashboard with fleet list + pairing form
- [x] `app/(app)/device/[id].tsx` — per-device control page
- [x] `lib/devices.ts` — fleet hook for list/refresh + last-seen formatter
- [x] `components/StatusCard.tsx` — battery voltage, uptime, firmware version,
      connection indicator. Auto-refreshes every 5 s.
- [x] `components/MotorCard.tsx` — directional pad (forward / backward / left /
      right / stop), speed slider (0–100%). Sends `POST /api/drive` and
      `POST /api/steer`. Hidden on web (no BLE fallback).
- [x] `components/CameraCard.tsx` — capture still button, link to MJPEG stream
      URL. Shows last-captured image inline.
- [x] `components/SensorCard.tsx` — ultrasonic distance, grayscale readings
      (raw + normalized). Manual refresh button.
- [x] `components/RoutineCard.tsx` — start/stop explore routine, live status
      (elapsed time, obstacle/cliff counts). Polls `/api/routine/status`.

**Exit criteria:**
- ✅ Devices dashboard renders fleet list and pairing controls
- ✅ Device detail route renders all control cards
- ✅ Status card fetches and displays battery voltage from device API
- ✅ Motor controls send API requests and display feedback
- ✅ Platform-conditional rendering verified (web hides motor card)
- ✅ `npx expo lint` clean

### 1.4 — Web Experience

**Goal:** Landing page for unauthenticated web visitors.

- [x] Modify `app/index.tsx` — platform + auth-aware routing:
  - `Platform.OS === 'web'` + not authenticated → render landing content
  - Mobile + not authenticated → redirect to `/login`
  - Authenticated (any platform) → redirect to `/(app)/`
- [x] Landing page content:
  - Hero section with product tagline
  - Feature highlights (3–4 bullet points)
  - "Get Started" CTA button → navigates to `/login`
  - Minimal styling with theme constants, no external CSS framework

**Exit criteria:**
- ✅ Web browser shows landing page when not logged in
- ✅ CTA navigates to login
- ✅ Mobile skips landing page (goes directly to login or dashboard)
- ✅ `npx expo lint` clean

### 1.5 — BLE Abstraction Stubs

**Goal:** Define the Bluetooth Low Energy service interface for future
implementation.

- [x] `lib/ble.ts`:
  - `BleService` interface: `scan()`, `connect(deviceId)`, `disconnect()`,
    `sendCommand(method, params)`, `onStatusChange(callback)`
  - `ConnectionStatus` type: `disconnected | scanning | connecting | connected`
  - `MockBleService` class: all methods return stub/simulated data
  - `createBleService()` factory: returns `MockBleService`
- [x] No BLE library added to `package.json` — purely TypeScript interfaces

**Exit criteria:**
- ✅ `BleService` interface importable from `lib/ble`
- ✅ `MockBleService` instantiable and callable without errors
- ✅ `npx expo lint` clean

### 1.6 — AI-Ready Command Input

**Goal:** Persistent command bar for future AI interaction
(see [ADR-002](docs/adr/002-ai-ready-ux.md)).

**Dependency:** Phase 1.3 (dashboard layout exists).

- [x] `components/CommandInput.tsx`:
  - `TextInput` with submit button
  - Inline response bubble (appears below input after submission)
  - Stub handler: `async (input: string) => "Command processing coming soon"`
  - `KeyboardAvoidingView` on mobile; fixed-position on web
  - Self-contained state (no external state management)
- [x] Modify `app/(app)/_layout.tsx` — render `CommandInput` below page content

**Exit criteria:**
- ✅ Command bar visible at bottom of dashboard on all platforms
- ✅ Typing and submitting shows stub response
- ✅ Keyboard avoidance works on mobile
- ✅ `npx expo lint` clean

---

## Phase 1 Exit Criteria (aggregate)

- [x] Authenticated user can log in, see device status, control motors, and view sensors
- [x] Web visitors see a landing page; authenticated web users see the dashboard
- [x] BLE interface defined (stubs only)
- [x] Command input bar present and functional (stub response)
- [x] `npx expo lint` clean across all files
- [x] No third-party UI component libraries added

---

## Future

### Phase 2 — BLE Integration (Planned)

**Goal:** Implement real BLE connectivity for device discovery, pairing,
and basic control commands. BLE is the primary transport on mobile when WiFi
is unavailable. When WiFi is available, all control goes over HTTPS. Web
users are HTTPS-only (no BLE).

**Architecture decisions:**
- nomopractic ADR-001: BLE GATT server in nomopractic
- nomopractic ADR-002: Binary protocol for BLE GATT
- nomopractic ADR-003: BLE security model

**Cross-repo dependencies:**
- nomopractic Phase 13: BLE GATT server (must be deployed first)
- nomothetic Phase 18: shared pairing secret, BlueZ setup

**Platform note:** BLE is mobile-only (Android / iOS via `react-native-ble-plx`).
Web users control devices over HTTPS after manual WiFi setup. This is a known
limitation documented in architecture.md.

#### 2.1 — BLE Library & Dev Build

- [x] Add `react-native-ble-plx` dependency to `package.json`
- [x] Configure Expo development build (BLE requires native modules — not
      available in Expo Go)
- [x] Android: add `ACCESS_FINE_LOCATION`, `BLUETOOTH_SCAN`,
      `BLUETOOTH_CONNECT`, `BLUETOOTH_ADVERTISE` permissions to
      `app.json` / `AndroidManifest.xml`
- [x] iOS: add `NSBluetoothAlwaysUsageDescription` to `Info.plist` via
      `app.json` `ios.infoPlist`
- [x] Verify: `react-native-ble-plx` initializes without crash on both
      platforms

#### 2.2 — BLE Discovery & Connection (`lib/ble.ts`)

- [x] `RealBleService` class implementing `BleService` interface:
  - `scan(timeoutMs)`: scan for nomon devices by Pairing Service UUID
    (`e3a10001-7b2a-4b9c-8f5a-2b7d6e4f1a3c`)
  - `connect(deviceId)`: connect, negotiate MTU (request 247)
  - `disconnect()`: clean disconnect, clear session state
  - `onStatusChange(listener)`: emit status on connection lifecycle events
- [x] Update `createBleService()` factory: return `RealBleService` on mobile,
      `MockBleService` on web
- [x] Platform guard: `Platform.OS === 'web'` returns mock; native returns real
- [x] BLE permission request flow (Android 12+ runtime permissions)

#### 2.3 — Binary Protocol Codec (`lib/ble-protocol.ts`)

- [x] `BleOpcode` enum matching nomopractic ADR-002 opcode table
- [x] `encodeCommand(opcode, payload) -> Uint8Array`: 3-byte header + payload
- [x] `decodeResponse(bytes) -> { opcode, seqNr, payload }`: parse response frame
- [x] Fixed-point helpers: `speedToX100(pct)`, `angleToX10(deg)`,
      `mvToVolts(mv)`, `x10ToCm(val)`
- [x] Little-endian read/write helpers using `DataView`
- [x] Unit tests: encode/decode round-trip for every opcode

#### 2.4 — BLE Pairing Flow

- [x] `lib/ble.ts`: `pair(secret: string) -> Promise<PairingResult>`:
  - Write secret to Pairing Secret characteristic
  - Subscribe to Auth Token notifications
  - Receive `salt (16B) || jwt_bytes`
  - Derive `session_key` via HKDF-SHA256
    (`ikm=secret, salt=received_salt, info="nomon-ble-session", len=16`)
  - Store JWT in `expo-secure-store` (same storage as HTTP tokens)
  - Return `{ jwt, sessionKey }`
- [x] Crypto: use `@noble/hashes` for HKDF-SHA256, `@noble/ciphers` for
      AES-128-CCM (pure JS, no native module needed)
- [x] `BleSession` class: holds `sessionKey`, `clientCounter`, `serverCounter`
  - `encrypt(frame) -> Uint8Array`: AES-128-CCM encrypt, increment counter
  - `decrypt(frame) -> Uint8Array`: AES-128-CCM decrypt, verify counter
- [x] Pairing UI: reuse existing pairing prompt in `app/index.tsx` — add
      BLE pairing mode when device discovered via scan

#### 2.5 — BLE Command Interface

- [x] `lib/ble.ts`: add typed command methods:
  - `getBattery(): Promise<{ voltageMv: number }>`
  - `drive(speedPct: number, ttlMs?: number): Promise<void>`
  - `steer(angleDeg: number, ttlMs?: number): Promise<void>`
  - `setMotorSpeed(channel: number, speedPct: number, ttlMs?: number): Promise<void>`
  - `stopAllMotors(): Promise<void>`
  - `setServoAngle(channel: number, angleDeg: number, ttlMs?: number): Promise<void>`
  - `readUltrasonic(): Promise<{ distanceCm: number }>`
  - `readGrayscale(): Promise<{ values: number[] }>`
  - `getHealth(): Promise<{ status: number, uptimeS: number }>`
- [x] Each method: encode binary frame → encrypt → write to Command
      characteristic → await notification → decrypt → decode response
- [x] Sequence number management (increment per request, match on response)
- [x] Timeout handling (5 s default, configurable)
- [x] Update `MotorCard.tsx` and `SensorCard.tsx` to call BLE methods when
      BLE is the active transport (no API change to components)

#### 2.6 — WiFi Provisioning UI

- [x] `lib/ble.ts`: WiFi provisioning methods:
  - `scanWifi(): Promise<WifiNetwork[]>` — write WiFi Command `0x01`,
    read WiFi Status for results
  - `connectWifi(ssid: string, password: string): Promise<void>` — write
    SSID + Password + Command `0x02`, poll Status until connected/failed
  - `getWifiStatus(): Promise<WifiState>` — read WiFi Status characteristic
- [x] Post-pairing flow: if BLE-only, prompt user for WiFi credentials
  - Show scanned SSIDs in picker
  - Password input
  - Connection progress indicator
  - On success: switch transport to HTTPS (JWT already stored)
  - On failure: remain on BLE, show error, allow retry

#### 2.7 — Hybrid Transport Layer (`lib/transport.ts`)

- [x] New `TransportProvider` context:
  - `transport: 'https' | 'ble'` — current active transport
  - `bleService: BleService` — BLE service instance
  - `switchToHttps(deviceUrl: string)` — called after WiFi provisioning
  - Auto-detect: if HTTPS is reachable, prefer HTTPS; fall back to BLE
- [x] Component integration: `StatusCard`, `MotorCard`, `SensorCard` read
      from transport context to decide API client vs BLE service
- [x] Transparent to components — same method signatures, different underlying
      transport
- [x] Battery level: subscribe to BLE Battery Level notifications when on BLE

#### 2.8 — Connection State & Reconnection

- [x] `components/ConnectionIndicator.tsx`:
  - Shows transport mode icon (WiFi / Bluetooth / Disconnected)
  - Colour-coded: green (connected), yellow (reconnecting), red (disconnected)
  - Positioned in device detail header
- [x] BLE disconnect detection:
  - `react-native-ble-plx` emits disconnect events
  - Auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s)
  - During reconnect: show indicator, queue commands (or reject with error)
- [x] On reconnect: if session key is still valid (same power cycle),
      resume; otherwise, re-pair
- [x] Motor auto-stop: if connection lost for > `ttl_ms`, nomopractic's
      watchdog idles motors (existing safety mechanism)

#### Phase 2 Exit Criteria
- [x] BLE device discovery finds nomon devices on mobile
- [x] BLE pairing with secret exchange + session encryption works
- [x] Motor, servo, and sensor commands work over BLE
- [x] WiFi credentials exchangeable over BLE; Pi joins WiFi
- [x] Auto-switch from BLE to HTTPS when WiFi becomes available
- [x] Connection indicator shows transport state
- [x] Auto-reconnect on BLE disconnect
- [x] Web users unaffected (HTTPS only, motor controls hidden)
- [x] `npx expo lint` clean
- [x] No third-party UI component libraries added

### Phase 3 — AI Integration (Planned)

- Connect `CommandInput` to a real AI/LLM endpoint
- Rich response rendering (tables, action confirmations, device state)
- Context-aware command suggestions
- Voice input option (tap-to-speak)

### Phase 4 — Fleet Management Dashboard (Planned)

- Multi-device view (list all owned devices, status overview)
- Telemetry history charts
- Device settings and calibration (remote via central API)
- User profile management
