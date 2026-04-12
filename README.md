# nomotactic

User-facing application for the nomon robot fleet. Built with Expo (React Native), serving Android, iOS, and web from a single TypeScript codebase.

## Features

| Feature | Android | iOS | Web |
|---------|---------|-----|-----|
| Device control (WiFi) | ✅ | ✅ | ✅ |
| Device pairing | ✅ | ✅ | ✅ |
| Device control (BLE) | 🔲 Future | 🔲 Future | ❌ |
| Auth (login/register) | ✅ | ✅ | ✅ |
| Fleet dashboard | ✅ | ✅ | ✅ |
| Landing page | — | — | ✅ |
| AI command bar | ✅ | ✅ | ✅ |

## Quick Start

```bash
npm install
npx expo start
```

Platform-specific:

```bash
npx expo start --android
npx expo start --ios
npx expo start --web
```

## Project Structure

```
app/
  _layout.tsx         Root layout (AuthProvider, StatusBar)
  index.tsx           Smart entry (landing page / login redirect / device pairing)
  login.tsx           Login & registration screen
  (app)/
    _layout.tsx       Auth guard + AI command input bar
    index.tsx         Device dashboard with expandable cards
components/           Reusable UI components (cards, command input)
constants/
  config.ts           API URLs (DEVICE_API_URL, CENTRAL_API_URL)
lib/
  api.ts              Typed fetch wrapper with per-URL auth injection
  auth.tsx            AuthProvider — central + device token management, pairing
  auth.tsx            Auth context + secure token storage
  ble.ts              BLE service interface + mock implementation
  theme.ts            Dark theme palette, spacing, typography
constants/
  config.ts           API URLs, timeouts (env-var overridable)
```

## Configuration

API URLs can be overridden at build time via Expo environment variables:

```bash
EXPO_PUBLIC_DEVICE_API_URL=https://10.0.0.1:8443
EXPO_PUBLIC_CENTRAL_API_URL=https://api.nomon.example.com
```

## Development

```bash
npx expo lint         # ESLint
npx tsc --noEmit      # Type check
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for system diagrams, navigation structure, and design principles.

## Roadmap

See [docs/roadmap.md](docs/roadmap.md) for phase status and planned work.
