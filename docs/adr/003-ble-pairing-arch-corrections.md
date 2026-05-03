# ADR-003: BLE Pairing Architecture Corrections

**Status:** Superseded by nomopractic [ADR-005: Wi-Fi Soft AP](../../nomopractic/docs/adr/005-wifi-soft-ap.md)  
**Date:** 2026-05-01  
**Deciders:** Perceptua  
**Addresses:** F-01 (auth guard blocks guest pairing), F-04 (BLE session loss on
navigation), F-05 (paired device absent from dashboard)

---

## Context

Three architectural bugs were identified post-Phase 2 that collectively prevent
the intended user flow — "optionally log in, then BLE-pair a device" — from
working end-to-end:

**F-01 — Auth guard blocks BLE pairing for unauthenticated users:**  
`(app)/_layout.tsx` redirects any unauthenticated visitor to `/login`. All BLE
pairing UI lives inside `(app)`. The intended flow specifies login as optional —
a user should be able to discover and pair a device without creating an account.

**F-04 — BLE session is discarded when navigating to the device page:**  
`BlePairingFlow` creates a local `bleServiceRef`, connects, and authenticates.
When it then navigates to `/(app)/device/[id]`, that page mounts a fresh
`TransportProvider` with a new `BleService` instance. The active connection is
lost and must be re-established from scratch.

**F-05 — Newly paired device doesn't appear on the dashboard:**  
`BlePairingFlow` calls the *local* nomothetic API (`/api/device/auth/pair`) to
register the device on the Pi. The dashboard's `useDevices` hook queries the
*central* fleet API (`/api/fleet/devices`). These are separate registries — a
freshly paired device never shows up in the dashboard list.

---

## Decision 1 — F-01: Guest mode with in-memory `isGuest` flag

**Chosen option: Add `isGuest` to `AuthContext` and a "Continue without account"
action to the login screen.**

### Rationale

- Requires no new route file — the login screen is already mobile's entry point.
- The `(app)` auth guard becomes a one-line change: allow entry if
  `isAuthenticated || isGuest`.
- The flag is in-memory (not persisted): a guest that restarts the app is
  prompted again, which is correct — we do not want a stale guest session
  surviving indefinitely.
- Preserves the existing authenticated flow unchanged — the guard logic only
  relaxes, never bypasses entirely.
- The top bar adapts: guests see "Sign In" instead of "Logout", guiding them
  toward account creation.

### Rejected options

- **New `/welcome` route:** Adds a screen purely for a two-button choice. The
  login screen is already the mobile entry point; adding the guest action there
  is simpler and avoids a new file.
- **Auth-guard bypass via route-specific flag:** Couples the guard logic to
  route metadata, making future changes harder to reason about.

### Implementation

| File | Change |
|------|--------|
| `lib/auth.tsx` | Add `isGuest: boolean` to `AuthState` and `AuthContextValue`. Add `continueAsGuest(): void` action — sets `isGuest: true` in state (in-memory; cleared by `logout()` and on app restart). |
| `app/login.tsx` | Add "Continue without account" `Pressable` below the form card. Calls `continueAsGuest()` + `router.replace('/(app)')`. |
| `app/index.tsx` | Change `if (isAuthenticated)` to `if (isAuthenticated \|\| isGuest)` for the `/(app)` redirect. |
| `app/(app)/_layout.tsx` | Guard: `if (!isAuthenticated && !isGuest) return <Redirect href="/login" />`. Top bar: render "Sign In" link (navigates to `/login`) for guest users instead of "Logout". |

---

## Decision 2 — F-04: Module-level BLE session registry + root-level `TransportProvider`

**Chosen option: Session registry keyed by device ID in `lib/ble.ts`;
`TransportProvider` lifted from `device/[id].tsx` to `app/_layout.tsx`.**

### Rationale

- A module-level `Map<deviceId, BleService>` outlives any React component tree —
  sessions survive navigation transitions without prop drilling or context
  gymnastics.
- Keying by device ID (not a singleton) satisfies the future multi-device
  requirement: the device page calls `activateSession(id)` and receives
  whichever session belongs to that device.
- The per-page `TransportProvider` in `device/[id].tsx` is the root cause of
  the session loss — it creates a fresh `BleService` on every mount. Lifting it
  to `app/_layout.tsx` makes it a single persistent instance.
- An `AppState` listener in `TransportProvider` ensures BLE connections are
  cleaned up when the app is backgrounded, satisfying the cleanup constraint.

### Rejected options

- **React context at root level with a single `BleService` instance:** Works
  today but hard-codes one active device; requires rework for multi-device.
- **Passing `BleService` as a navigation param:** Navigation params are
  serialised to strings; non-serialisable objects cannot be passed this way
  in expo-router.
- **Re-connecting in the device page on mount:** Causes user-visible connection
  delay and loses the already-obtained JWT, requiring re-authentication.

### Implementation

| File | Change |
|------|--------|
| `lib/ble.ts` | Add module-level `Map<string, BleService>` registry. Export `registerBleSession(deviceId, ble)`, `getBleSession(deviceId)`, `clearBleSession(deviceId)`. |
| `lib/transport.tsx` | Add `activateSession(deviceId: string): Promise<void>` to `TransportContextValue`. Implementation: look up `getBleSession(deviceId)`, wire to `bleServiceRef.current`, check WiFi status, set mode. Add `AppState` listener that calls `disconnectDevice()` on background. `disconnectDevice()` calls `clearBleSession(deviceId)`. |
| `app/_layout.tsx` | Wrap `<Stack>` in `<TransportProvider>` (inside `<AuthProvider>`). |
| `app/(app)/device/[id].tsx` | Remove `<TransportProvider>` wrapper. Add `useEffect(() => { transport.activateSession(id); }, [id])` using the root-level transport context. |
| `components/BlePairingFlow.tsx` | After `ble.authenticate()`, call `registerBleSession(deviceId, ble)` before navigating to `register-device`. |

---

## Decision 3 — F-05: App-local device registry merged into `useDevices`

**Chosen option: Option B — persistent local device registry (`lib/local-devices.ts`)
merged with the central fleet list in `useDevices`.**

### Options considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A | Register with central fleet API during BLE pairing | Rejected — requires auth credentials; fails for guest users, contradicting the optional-login design |
| B | Local registry (AsyncStorage-style) merged into `useDevices` | **Accepted** — works for all users; clean separation of concerns |
| C | Force a central sync before displaying the dashboard | Rejected — blocked by auth; poor offline experience |

### Rationale

- **Option A** requires a logged-in user. Guest users have no central API
  credentials. This directly contradicts the "login is optional" requirement
  established by F-01.
- **Option B** works for all users — authenticated or guest. Central fleet
  devices appear when the user has an account; local-only BLE-paired devices
  always appear regardless of auth state.
- Deduplication by VIN ensures a device doesn't appear twice after it has been
  centrally registered.
- The `source: 'local' | 'central'` discriminant lets the UI apply a visual
  badge, making local vs. fleet membership legible to the user.
- No new npm dependency: the same cross-platform storage pattern already in
  `lib/auth.tsx` (`expo-secure-store` on mobile, `localStorage` on web, JSON-
  serialised) handles the device records.

### Implementation

| File | Change |
|------|--------|
| `lib/local-devices.ts` | **New file.** `LocalDevice` type: `{ id, name, pairedAt, bleDeviceId, vin: string \| null, source: 'local' }`. CRUD exports: `saveLocalDevice`, `getLocalDevices`, `updateLocalDevice`, `removeLocalDevice`. Storage key: `nomon_local_devices`. Uses the same cross-platform storage abstraction as `lib/auth.tsx`. |
| `lib/devices.ts` | Add `source: 'central' \| 'local'` to `Device`. `useDevices` loads `getLocalDevices()` in parallel with the central API call. Merges results: central entries tagged `source: 'central'`; local devices whose `vin` is not in the central list tagged `source: 'local'`. |
| `components/BlePairingFlow.tsx` | After `registerBleSession`, call `saveLocalDevice({ id: deviceId, name: device.name ?? deviceId, pairedAt: new Date().toISOString(), bleDeviceId: deviceId, vin: null, source: 'local' })`. Navigate to `/(app)/register-device?deviceId=${deviceId}`. |
| `app/(app)/register-device.tsx` | Read `deviceId` from `useLocalSearchParams()`. After successful `pairWithDevice()`: fetch `/api/status` via `deviceApi` to get the device VIN; call `updateLocalDevice(deviceId, { vin })`. Navigate to `/(app)/device/${deviceId}` instead of `/(app)`. |
| `app/(app)/index.tsx` | Render a "Local" pill badge on device cards where `device.source === 'local'`. |

---

## Consequences

- Guest users can now BLE-pair a device before creating an account (F-01 resolved).
- The BLE session established during pairing is reused when the user reaches the
  device page (F-04 resolved).
- A locally paired device appears on the dashboard immediately after pairing,
  regardless of authentication state (F-05 resolved).
- `TransportProvider` is now a single root-level instance — all per-device pages
  share the same transport context and BLE connection lifecycle.
- `lib/local-devices.ts` is a new persistent store; a future fleet sync step can
  reconcile local entries with the central registry when the user authenticates.
- The `(app)/_layout.tsx` top bar now adapts to guest vs. authenticated state.

---

## Future Work

- **Guest-to-account upgrade path:** When a guest user logs in, offer a prompt to
  promote local-only devices to the central fleet registry.
- **`pairWithDevice` VIN return:** If nomothetic's `/api/device/auth/pair` is
  updated to return the device VIN in the token response, the subsequent
  `/api/status` fetch in `register-device.tsx` can be removed.
- **Multi-device transport:** The session registry already supports concurrent
  sessions by device ID. A future `DeviceSessionContext` can expose the full map
  to components that need to interact with multiple devices simultaneously.
