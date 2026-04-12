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

---

## Current State

Phase 1 is complete. The app has:
- Expo SDK 54 with expo-router navigation
- Dark theme, typed API client with auth injection and 401 retry guard
- JWT auth flow with expo-secure-store (mobile) / localStorage (web)
- Device control dashboard with 5 expandable card components
- Web landing page for unauthenticated visitors
- BLE service interface + mock implementation
- AI-ready command input bar
- `npx expo lint` clean

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

**Goal:** Primary device interaction screen with expandable cards.

- [x] `app/(app)/_layout.tsx` — authenticated route group:
  - Auth guard: redirect to `/login` if not authenticated
  - Layout wrapper (safe area, scroll view)
- [x] `app/(app)/index.tsx` — dashboard with expandable card sections
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
- ✅ Dashboard renders with all cards
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

- Evaluate `react-native-ble-plx` or alternative BLE library
- Implement `RealBleService` conforming to the `BleService` interface
- BLE device discovery and pairing flow
- Motor control via BLE (limited command set)
- Requires Expo development build (not Expo Go)

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
