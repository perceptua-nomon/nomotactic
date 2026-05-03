# Quick Start: BLE Testing

## 🚀 Test BLE Flow on Mobile (No Provisioning)

```bash
cd nomotactic
EXPO_PUBLIC_ENABLE_BLE_MOCK_MODE=true npm start
# Select your platform: i (iOS) or a (Android)
```

**In the app** (real device — BLE mock mode disabled):
1. On the login screen, log in **or** tap **"Continue without account"**
2. Navigate to the Devices dashboard
3. Tap **"Scan for Nearby Devices"** in the Add Device card
4. Select your nomon device from the scan results
5. Enter the 6-digit passkey shown by the OS Bluetooth dialog
6. App authenticates over BLE and registers the device locally
7. Verify device appears on the dashboard with a **"Local"** badge
8. Tap the device card — BLE session is already active, no reconnection needed

**In the app** (mock mode — `EXPO_PUBLIC_ENABLE_BLE_MOCK_MODE=true`):
1. On the login screen, log in **or** tap **"Continue without account"**
2. Navigate to the Devices dashboard
3. Tap **"Scan for Nearby Devices"**
4. Select a mock device from the list
5. Tap the device card to connect (simulated ~800 ms)
6. Verify device appears on dashboard with **"Local"** badge and device page loads with active session

## 🌐 Test BLE on Web (Real Web Bluetooth)

```bash
cd nomotactic
npm start
# Select w (web)
```

**Setup first** (one-time):
1. Pair your nomon device via OS Bluetooth settings
2. macOS: System Preferences → Bluetooth → Pair nomon
3. Linux: `bluetoothctl pair [MAC_ADDRESS]`
4. Windows: Settings → Devices → Bluetooth → Add device

**In the app**:
1. Click "Scan for Nearby Devices"
2. Browser shows native device picker
3. Select your paired device
4. App connects via real Web Bluetooth API

## 📝 Environment Variables

Create `.env.local` in the `nomotactic` folder:

```env
# Enable mock BLE on mobile
EXPO_PUBLIC_ENABLE_BLE_MOCK_MODE=true

# (Optional) Device URLs
EXPO_PUBLIC_DEVICE_API_URL=https://10.0.0.1:8443
EXPO_PUBLIC_CENTRAL_API_URL=https://nomon.example.com
```

## 🔍 Configuration Decision Tree

```
├─ Platform === "web"
│  └─ Use: WebBleService (real Web Bluetooth API)
│
├─ Platform === "mobile" AND ENABLE_BLE_MOCK_MODE
│  └─ Use: MockBleService (simulated devices & responses)
│
└─ Platform === "mobile" AND !ENABLE_BLE_MOCK_MODE
   └─ Use: RealBleService (real iOS/Android Bluetooth)
```

## 📚 Full Documentation

See [docs/ble-testing-guide.md](./docs/ble-testing-guide.md) for:
- Architecture details
- Mock device responses
- Web Bluetooth limitations
- Troubleshooting
- Advanced usage examples

## 🔧 Files Modified

- `lib/ble.ts` — BLE session registry (`registerBleSession`, `getBleSession`, `clearBleSession`)
- `lib/auth.tsx` — Guest mode: `isGuest` flag, `continueAsGuest()` action
- `lib/local-devices.ts` — Local device registry (new file)
- `lib/devices.ts` — `source: 'central' | 'local'` field; merges local registry into fleet list
- `lib/transport.tsx` — Root-level `TransportProvider`; `activateSession(deviceId)`
- `app/_layout.tsx` — `TransportProvider` lifted to root layout
- `app/login.tsx` — "Continue without account" button
- `app/index.tsx` — Guest redirect support
- `app/(app)/_layout.tsx` — Auth guard allows guests; top bar adapts
- `app/(app)/device/[id].tsx` — Calls `activateSession` on mount
- `components/BlePairingFlow.tsx` — Registers BLE session; saves local device record
- `components/AddDeviceSection.tsx` — Scanned devices are `<Pressable>` with connect handlers
- `components/RoutineCard.tsx` — Migrated to `useDeviceCommand()`
- `components/CameraCard.tsx` — Migrated to `useDeviceCommand()`
- `components/ConnectionIndicator.tsx` — Reconnect handler implemented
- `constants/config.ts` — `ENABLE_BLE_MOCK_MODE` flag
