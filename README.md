# nomotactic

User-facing application for the nomon robot fleet. Built with Expo (React Native), serving Android, iOS, and web from a single TypeScript codebase.

## Features

| Feature | Android | iOS | Web |
|---------|---------|-----|-----|
| Device control (WiFi) | ✅ | ✅ | ✅ |
| Device pairing (Soft AP) | ✅ | ✅ | ✅ |
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

## Running in Expo Go over Tailscale

The dev machine and test device must be on the same [Tailnet](https://tailscale.com/kb/1136/tailnet).
No ngrok tunnel is required or recommended.

```bash
make start-tailnet
# or:
npm run tailnet
```

This sets `REACT_NATIVE_PACKAGER_HOSTNAME` to `$(tailscale ip -4)` so Metro advertises the
Tailscale IP instead of the WSL2/LAN IP. The QR code in Expo Go will point directly to the
dev machine over the Tailnet.

**Prerequisites:**
- `tailscale` CLI must be installed and connected on the dev machine (`tailscale ip -4` must return a valid IP)
- The test device must be enrolled in the same Tailnet and have Tailscale active

`npm run start` (plain LAN mode) works when both devices share the same physical LAN segment.
Use `tailnet` when the dev machine is behind WSL2, a different subnet, or a VPN-only network.

## Project Structure

```
app/
  _layout.tsx            Root layout (AuthProvider, StatusBar)
  index.tsx              Entry routing (authenticated → /(app), mobile unauth → /login, web unauth → landing)
  login.tsx              Login & registration screen
  (app)/
    _layout.tsx          Auth guard (/login redirect) + AI command input bar
    index.tsx            Devices dashboard (fleet list + pairing)
    device/
      _layout.tsx        Device detail route group layout
      [id].tsx           Per-device control screen (cards)
components/              Reusable UI components (cards, command input, pairing flows)
constants/
  config.ts              API URLs, timeouts (env-var overridable)
lib/
  api.ts                 Typed fetch wrapper with per-URL auth injection
  auth.tsx               Auth context + secure token storage + pairing helpers
  devices.ts             Fleet device hook and mappers
  endpoints.ts           API endpoint string constants
  usePolling.ts          Reusable polling hook
  useDeviceCommand.ts    Transport-switching command hook
  theme.ts               Dark theme palette, spacing, typography
```

## Configuration

API URLs can be overridden at build time via Expo environment variables:

```bash
EXPO_PUBLIC_DEVICE_API_URL=https://10.0.0.1:8443
EXPO_PUBLIC_CENTRAL_API_URL=https://api.nomon.example.com
```

## Development

```bash
npm run lint          # ESLint (expo lint)
npm run typecheck     # tsc --noEmit
npm test              # jest unit tests (lib/ data layer)
npm run smoke         # build web export + Playwright render smoke test
```

### Testing & CI

Three layers, all run by GitHub Actions (`.github/workflows/ci.yml`) on pushes
and PRs to `main`:

- **Type check + lint** — `tsc --noEmit` and `expo lint`.
- **Unit tests** — `jest` over the `lib/` data layer (the API client and helper
  modules; React Native is stubbed, so these don't render components).
- **Web smoke** — `npm run smoke` exports the app for web (`expo export`,
  exercising every route/import) and renders it in headless Chromium via
  Playwright (`e2e/smoke.spec.ts`), asserting the app actually loads and routes.
  This is the render-level check the stubbed jest suite can't provide.

> Running the smoke test in a sandbox that ships its own Chromium? Set
> `PW_EXECUTABLE_PATH=/path/to/chrome` to point Playwright at it instead of a
> managed download.

## Architecture

See [docs/architecture.md](docs/architecture.md) for system diagrams, navigation structure, and design principles.

## Roadmap

See [docs/roadmap.md](docs/roadmap.md) for phase status and planned work.
