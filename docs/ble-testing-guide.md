# BLE Testing & Development Guide

## Overview

The nomotactic app now supports three different BLE implementations to accommodate different development and testing scenarios:

| Platform | Mode | Implementation | Use Case |
|----------|------|----------------|----------|
| **Web** | N/A | WebBleService (Web Bluetooth API) | Real pairing via browser; no mock |
| **Mobile** | Production | RealBleService (react-native-ble-plx) | Real iOS/Android BLE with provisioning |
| **Mobile** | Testing | MockBleService (mock) | Logic testing without provisioning |

## Web: Real Web Bluetooth Support

### Prerequisites

- Chrome, Brave, Edge, or other Chromium-based browser (Safari and Firefox limited support)
- nomon device already paired via OS Bluetooth settings
- HTTPS connection (required by Web Bluetooth API security policy)

### Setup

1. **Pair the device via OS settings** (macOS/Linux/Windows):
   - macOS: System Preferences → Bluetooth → Pair with nomon
   - Linux: Use `bluetoothctl` or GNOME Bluetooth
   - Windows: Settings → Devices → Bluetooth → Add device

2. **Run the web app**:
   ```bash
   npm start
   # Select "w" for web
   ```

3. **In the app**:
   - Navigate to the pairing screen
   - Click "Scan for Nearby Devices"
   - Browser shows a native device picker dialog
   - Select your paired nomon device
   - App connects and authenticates

### How It Works

- **WebBleService** uses the browser's native Web Bluetooth API
- The OS handles device discovery and pairing
- Communication occurs via GATT characteristics (NDJSON format)
- No mock data — real device commands are executed

### Limitations

- **RSSI not exposed**: Web Bluetooth API doesn't provide signal strength (shows `null` in UI)
- **Pre-pairing required**: Device must be paired via OS settings first
- **No background scanning**: Limited to foreground connections
- **Browser compatibility**: Full support in Chromium browsers; limited in Safari/Firefox

## Mobile: Production Testing (Real BLE)

### Prerequisites

**iOS**:
- Apple Developer Account ($99/year)
- Device provisioning certificate
- `EXPO_PUBLIC_PROVISIONING_PROFILE_ID` set in `.env`

**Android**:
- No special provisioning needed
- Android 5.0+ with Bluetooth 4.0 LE support

### Setup

```bash
# Production mode (uses RealBleService)
npm start
# Select "i" for iOS or "a" for Android
```

OS-level Bluetooth passkey pairing handles the initial connection. No app-layer encryption.

## Mobile: Mock Testing (No Provisioning)

### Use Case

- Test the BLE pairing and command flow without Apple Developer provisioning
- Rapid iteration on app logic
- CI/CD testing environments

### Setup

1. **Enable mock mode**:
   ```bash
   # Option A: Set environment variable
   EXPO_PUBLIC_ENABLE_BLE_MOCK_MODE=true npm start
   
   # Option B: Create .env file
   echo "EXPO_PUBLIC_ENABLE_BLE_MOCK_MODE=true" >> .env.local
   npm start
   ```

2. **Run on mobile**:
   ```bash
   # iOS
   npm start
   # Select "i" for iOS
   
   # Android
   npm start
   # Select "a" for Android
   ```

3. **In the app**:
   - Click "Scan for Nearby Devices"
   - MockBleService returns two fake devices: "nomon-alpha" and "nomon-beta"
   - Select one to connect
   - Simulated responses return for all commands

### Mock Device Responses

The `MockBleService` provides pre-configured responses for testing:

```typescript
// Example responses:
- get_battery_voltage: { voltage_v: 7.4 }
- read_ultrasonic: { distance_cm: 25.5 }
- read_grayscale: { channels: [0, 1, 2], values: [100, 200, 150] }
- health: { status: "ok", uptime_s: 3600 }
- wifi_scan: { networks: [...] }
- wifi_connect: { connected: true }
- wifi_status: { state: "connected", ssid: "HomeNetwork", signal_pct: 85 }
```

All commands resolve with a 100ms delay to simulate network latency.

## Configuration

### Config Flag: `ENABLE_BLE_MOCK_MODE`

Defined in [constants/config.ts](../constants/config.ts):

```typescript
export const ENABLE_BLE_MOCK_MODE = 
  process.env.EXPO_PUBLIC_ENABLE_BLE_MOCK_MODE === "true";
```

**How it affects BLE service selection**:
- **Web**: Always uses WebBleService (ignores flag)
- **Mobile + ENABLE_BLE_MOCK_MODE=true**: Uses MockBleService
- **Mobile + ENABLE_BLE_MOCK_MODE=false/unset**: Uses RealBleService

### Environment Variables

```bash
# Enable mock mode on mobile
EXPO_PUBLIC_ENABLE_BLE_MOCK_MODE=true

# (Optional) Device API URL
EXPO_PUBLIC_DEVICE_API_URL=https://10.0.0.1:8443

# (Optional) Central API URL
EXPO_PUBLIC_CENTRAL_API_URL=https://nomon.example.com
```

## Architecture

### BLE Service Factory

```typescript
// lib/ble.ts
export function createBleService(): BleService {
  if (Platform.OS === "web") {
    // Web: Always real Web Bluetooth API
    return new WebBleService();
  }
  if (ENABLE_BLE_MOCK_MODE) {
    // Mobile: Mock if flag enabled
    return new MockBleService();
  }
  // Mobile: Production
  return new RealBleService();
}
```

### Service Implementations

**BaseBleService** (abstract base)
- Common typed command wrappers: `getBattery()`, `drive()`, `steer()`, etc.
- Status change listeners
- Token management

**MockBleService**
- Simulated device discovery (2 fake devices)
- Simulated connection with delays
- Pre-configured command responses
- No real Bluetooth required

**WebBleService**
- Uses Web Bluetooth API
- Requires browser support and OS pairing
- Real GATT communication
- NDJSON relay over characteristics

**RealBleService**
- Uses react-native-ble-plx
- Real iOS/Android Bluetooth stack
- Requires provisioning credentials
- OS-level passkey pairing

## Testing Workflow

### Test Pairing Flow (Mobile)

```bash
# Mock mode enabled
EXPO_PUBLIC_ENABLE_BLE_MOCK_MODE=true npm start
# Select Android/iOS
# In app: "Scan" → Select device → Connect → Authenticate
# Verify UI updates and navigation
```

### Test Command Responses (Mobile)

```typescript
// Component tests can use MockBleService directly
const bleService = new MockBleService();
await bleService.connect("nomon-0001");
const battery = await bleService.getBattery(); // { voltage_v: 7.4 }
```

### Test Web Bluetooth (Web)

```bash
npm start
# Select "w" for web
# Pair device via OS settings first
# In app: "Scan" → Select device → Connect
# Monitor browser console for Web Bluetooth API logs
```

## Troubleshooting

### "Web Bluetooth API not available in this browser"

**Solution**: Use a Chromium-based browser (Chrome, Brave, Edge). Safari and Firefox have limited or no Web Bluetooth support.

### "Device not found. Please pair it via OS settings first."

**Solution**:
1. Open OS Bluetooth settings
2. Ensure nomon device is discoverable
3. Complete the pairing process
4. Refresh the app

### Mock mode not enabling on mobile

**Solution**: Check the environment variable is set correctly:
```bash
echo $EXPO_PUBLIC_ENABLE_BLE_MOCK_MODE  # Should output "true"
npm start
```

### Errors in react-native-ble-plx on web

**Solution**: Web builds use MockBleService by default. If you see ble-plx errors, the factory function may not be properly selecting WebBleService. Check the build output.

## Advanced Usage

### Programmatic Mock Testing

```typescript
// In your component or test
import { createBleService } from "@/lib/ble";

const ble = createBleService();  // Respects ENABLE_BLE_MOCK_MODE flag

// Mock mode workflow
await ble.scan(5000);              // Returns 2 mock devices
await ble.connect("nomon-0001");   // Simulates connection
const jwt = await ble.authenticate(); // Returns mock JWT
const battery = await ble.getBattery(); // Returns mock voltage
```

### Custom Mock Responses

Edit `MockBleService._mockResponse()` in [lib/ble.ts](../lib/ble.ts) to return custom test data:

```typescript
private _mockResponse(id: string, method: string, params: Record<string, unknown>): IpcResponse {
  switch (method) {
    case "custom_command":
      return { id, ok: true, result: { custom_data: "test" } };
    // ...
  }
}
```

### GATT Service UUIDs

If you need to change the service UUIDs (defined in [lib/ble.ts](../lib/ble.ts)):

```typescript
// Service UUID
const NOMON_SERVICE_UUID = "e3a10001-7b2a-4b9c-8f5a-2b7d6e4f1a3c";

// Command Write characteristic (write-without-response)
const COMMAND_WRITE_CHAR_UUID = "e3a12001-7b2a-4b9c-8f5a-2b7d6e4f1a3c";

// Response Notify characteristic (notify)
const RESPONSE_NOTIFY_CHAR_UUID = "e3a12002-7b2a-4b9c-8f5a-2b7d6e4f1a3c";
```

## References

- [Web Bluetooth API Specification](https://webbluetoothcg.github.io/web-bluetooth/)
- [react-native-ble-plx Documentation](https://dotintent.github.io/react-native-ble-plx/)
- [ADR-004: BLE Pairing Design](../docs/adr/004-ble-pairing.md)
- [BLE Service Implementation](../lib/ble.ts)
- [BlePairingFlow Component](../components/BlePairingFlow.tsx)
