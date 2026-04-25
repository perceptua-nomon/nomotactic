# Quick Start: BLE Testing

## 🚀 Test BLE Flow on Mobile (No Provisioning)

```bash
cd nomotactic
EXPO_PUBLIC_ENABLE_BLE_MOCK_MODE=true npm start
# Select your platform: i (iOS) or a (Android)
```

**In the app**:
1. Navigate to pairing screen
2. Click "Scan for Nearby Devices"
3. Select "nomon-alpha" or "nomon-beta" from mock list
4. Click to connect (simulated ~800ms)
5. Verify navigation to device dashboard

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

- `lib/ble.ts` — Added WebBleService + mock flag support
- `constants/config.ts` — Added ENABLE_BLE_MOCK_MODE flag
- `docs/ble-testing-guide.md` — Complete testing guide (new)
