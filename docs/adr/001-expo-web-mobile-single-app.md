# ADR-001: Expo Web + Mobile Single-App Approach

**Status:** Accepted  
**Date:** 2026-04-10  
**Deciders:** Perceptua  

---

## Context

The nomon fleet needs user-facing applications on three platforms:

1. **Android** — primary mobile platform for robot control
2. **iOS** — secondary mobile platform (same feature set as Android)
3. **Web** — marketing landing page (unauthenticated) and fleet management
   dashboard (authenticated); no Bluetooth features

Options evaluated:

1. **Separate native apps + separate web app** — Swift/Kotlin + React/Next.js.
   Three codebases, three CI pipelines, maximum platform fidelity.
2. **React Native (bare) + separate web app** — one mobile codebase, separate
   web app. Two codebases.
3. **Expo (managed) with web platform support** — single codebase for all
   three platforms. Expo SDK 54 provides mature web support via
   `react-native-web`. One CI pipeline, one component library.
4. **Flutter** — single codebase, Dart language. Strong cross-platform, but
   introduces a new language and build toolchain to the project.

## Decision

Use **Expo (managed workflow) with web platform support** — a single
`nomotactic` repository serving Android, iOS, and web from one TypeScript
codebase.

## Rationale

- **One codebase, three platforms.** Expo SDK 54 + `react-native-web` renders
  the same components on web with no separate project. File-based routing
  (`expo-router`) works identically on all platforms.
- **Minimal build complexity.** `expo start --web`, `expo start --android`,
  `expo start --ios` — no Xcode or Android Studio required for development.
  EAS Build handles production builds.
- **TypeScript.** The project already uses TypeScript. No new language to learn.
- **Lightweight ecosystem.** Expo's SDK provides camera, secure storage,
  haptics, and linking out of the box — no need for large third-party UI
  libraries.
- **Platform-conditional rendering.** `Platform.OS` and `Platform.select()`
  allow hiding features (e.g., Bluetooth controls) on web while keeping one
  component tree.

## Trade-offs

- **Web is not a first-class web framework.** `react-native-web` has
  limitations compared to Next.js or Remix (no SSR, no server components, no
  built-in SEO). Acceptable since the web surface is a dashboard, not a
  content site.
- **Bluetooth requires native modules.** `react-native-ble-plx` or similar
  libraries require Expo development builds (not Expo Go). Planned for a
  future phase; stubs are defined now.
- **Bundle size.** React Native + Expo adds baseline overhead (~1 MB+).
  Mitigated by Expo's tree-shaking and the hermes engine on mobile.
- **Expo SDK version coupling.** Upgrading Expo can be disruptive. Mitigated
  by pinning SDK version and upgrading deliberately.

## Platform Feature Matrix

| Feature | Android | iOS | Web |
|---------|---------|-----|-----|
| Device control (WiFi) | ✅ | ✅ | ✅ |
| Device control (BLE) | ✅ Implemented (Phase 2) | ✅ Implemented (Phase 2) | ❌ |
| Camera feed (MJPEG) | ✅ | ✅ | ✅ |
| Auth (login/register) | ✅ | ✅ | ✅ |
| Fleet dashboard | ✅ | ✅ | ✅ |
| Landing page | ❌ | ❌ | ✅ |
| Secure token storage | Keystore | Keychain | localStorage |
| Haptic feedback | ✅ | ✅ | ❌ |

## Consequences

- Single `nomotactic` repo with Expo SDK 54
- `expo-router` for file-based routing (already configured)
- `expo-secure-store` added for credential persistence on mobile
- `Platform.OS` used for platform-conditional rendering
- Web output is static (`app.json` → `web.output: "static"`)
- No server-side rendering; web app is a client-side SPA
