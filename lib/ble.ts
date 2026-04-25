/**
 * Bluetooth Low Energy abstraction layer (ADR-004 simplified).
 *
 * Provides a clean interface for BLE communication with nomon devices.
 * - MockBleService: stub implementation for development and testing
 * - WebBleService: real BLE via Web Bluetooth API (web only)
 * - RealBleService: real BLE via react-native-ble-plx (mobile only)
 *
 * Communication uses NDJSON relay — same format as the Unix socket IPC.
 * OS-level Bluetooth passkey pairing (mobile) or Web Bluetooth pairing (web)
 * replaces the old custom pairing ceremony. No app-layer encryption.
 *
 * The factory `createBleService()` returns the correct implementation
 * based on `Platform.OS` and `ENABLE_BLE_MOCK_MODE` config flag.
 *
 * Mock mode on mobile: Set EXPO_PUBLIC_ENABLE_BLE_MOCK_MODE=true to use
 * MockBleService on mobile for testing without provisioning.
 */

import { ENABLE_BLE_MOCK_MODE } from "@/constants/config";
import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// Web Bluetooth API type declarations (extends Navigator)
// ---------------------------------------------------------------------------

declare global {
  interface Navigator {
    bluetooth?: Bluetooth;
  }
}

interface Bluetooth {
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
  getDevice?(id: string): Promise<BluetoothDevice | undefined>;
}

interface RequestDeviceOptions {
  filters?: BluetoothDeviceFilter[];
  optionalServices?: string[];
}

interface BluetoothDeviceFilter {
  services?: string[];
  name?: string;
  namePrefix?: string;
}

interface BluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
}

interface BluetoothRemoteGATTServer {
  device: BluetoothDevice;
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothRemoteGATTService extends EventTarget {
  device: BluetoothDevice;
  uuid: string;
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  service: BluetoothRemoteGATTService;
  uuid: string;
  value?: DataView;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
}

// ---------------------------------------------------------------------------
// GATT UUIDs (ADR-004 single service)
// ---------------------------------------------------------------------------

/** nomon GATT Service UUID — used for scan filtering. */
const NOMON_SERVICE_UUID = "e3a10001-7b2a-4b9c-8f5a-2b7d6e4f1a3c";

/** Command Write characteristic (write-without-response). */
const COMMAND_WRITE_CHAR_UUID = "e3a12001-7b2a-4b9c-8f5a-2b7d6e4f1a3c";

/** Response Notify characteristic (notify). */
const RESPONSE_NOTIFY_CHAR_UUID = "e3a12002-7b2a-4b9c-8f5a-2b7d6e4f1a3c";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Connection lifecycle states. */
export type ConnectionStatus =
  | "disconnected"
  | "scanning"
  | "connecting"
  | "connected";

/** Minimal representation of a discovered BLE peripheral. */
export interface BleDevice {
  id: string;
  name: string | null;
  rssi: number | null;
}

/** Callback invoked when connection status changes. */
export type StatusListener = (status: ConnectionStatus) => void;

/** WiFi network discovered during scan. */
export interface WifiNetwork {
  ssid: string;
  signal_pct: number;
  security: string;
}

/** Current WiFi connection state. */
export interface WifiStatus {
  state: string;
  ssid: string | null;
  signal_pct: number | null;
}

/**
 * NDJSON IPC request — mirrors nomopractic `ipc::schema::Request`.
 */
interface IpcRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

/**
 * NDJSON IPC response — mirrors nomopractic `ipc::schema::Response`.
 */
interface IpcResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: { code: string; message: string };
}

// ---------------------------------------------------------------------------
// BLE Service interface
// ---------------------------------------------------------------------------

/** Abstract BLE service contract (ADR-004 JSON relay). */
export interface BleService {
  /** Get paired/bonded devices from the OS. Resolves with remembered peripherals. */
  getPairedDevices(): Promise<BleDevice[]>;

  /** Scan for nearby nomon devices. Resolves with discovered peripherals. */
  scan(timeoutMs?: number): Promise<BleDevice[]>;

  /** Connect to a specific device by ID. OS handles passkey pairing. */
  connect(deviceId: string): Promise<void>;

  /** Disconnect from the currently connected device. */
  disconnect(): Promise<void>;

  /** Authenticate with the device and receive a JWT. */
  authenticate(): Promise<string>;

  /**
   * Send an NDJSON command and wait for the JSON response.
   * Returns the parsed IPC response.
   */
  sendJsonCommand(method: string, params?: Record<string, unknown>): Promise<IpcResponse>;

  /** Register a listener for connection status changes. Returns unsubscribe fn. */
  onStatusChange(listener: StatusListener): () => void;

  /** Current connection status. */
  readonly status: ConnectionStatus;

  /** JWT token from authenticate(), null if not authenticated. */
  readonly token: string | null;

  // -- Typed command helpers --

  /** Get battery voltage. */
  getBattery(): Promise<{ voltage_v: number }>;

  /** Send a drive command. */
  drive(speedPct: number, ttlMs?: number): Promise<void>;

  /** Send a steer command. */
  steer(angleDeg: number, ttlMs?: number): Promise<void>;

  /** Set individual motor speed. */
  setMotorSpeed(channel: number, speedPct: number, ttlMs?: number): Promise<void>;

  /** Stop all motors. */
  stopAllMotors(): Promise<void>;

  /** Set individual servo angle. */
  setServoAngle(channel: number, angleDeg: number, ttlMs?: number): Promise<void>;

  /** Read ultrasonic distance sensor. */
  readUltrasonic(): Promise<{ distance_cm: number }>;

  /** Read grayscale sensor values. */
  readGrayscale(): Promise<{ values: number[] }>;

  /** Get device health status. */
  getHealth(): Promise<IpcResponse>;

  // -- WiFi provisioning --

  /** Scan for available WiFi networks. */
  scanWifi(): Promise<WifiNetwork[]>;

  /** Connect the device to a WiFi network. */
  connectWifi(ssid: string, psk: string): Promise<boolean>;

  /** Get current WiFi connection status. */
  getWifiStatus(): Promise<WifiStatus>;
}

// ---------------------------------------------------------------------------
// Shared base class
// ---------------------------------------------------------------------------

/**
 * Abstract base class implementing the typed command wrappers.
 *
 * Subclasses only need to provide the transport-specific methods:
 * `scan`, `connect`, `disconnect`, `authenticate`, `sendJsonCommand`,
 * `scanWifi`, `connectWifi`, and `getWifiStatus`.
 */
abstract class BaseBleService implements BleService {
  protected _status: ConnectionStatus = "disconnected";
  protected _listeners: Set<StatusListener> = new Set();
  protected _token: string | null = null;

  get status(): ConnectionStatus {
    return this._status;
  }

  get token(): string | null {
    return this._token;
  }

  abstract getPairedDevices(): Promise<BleDevice[]>;
  abstract scan(timeoutMs?: number): Promise<BleDevice[]>;
  abstract connect(deviceId: string): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract authenticate(): Promise<string>;
  abstract sendJsonCommand(method: string, params?: Record<string, unknown>): Promise<IpcResponse>;

  async getBattery(): Promise<{ voltage_v: number }> {
    const resp = await this.sendJsonCommand("get_battery_voltage");
    if (!resp.ok) throw new Error(`getBattery failed: ${(resp.error as { message: string })?.message}`);
    return { voltage_v: (resp.result as { voltage_v: number }).voltage_v };
  }

  async drive(speedPct: number, ttlMs = 500): Promise<void> {
    const resp = await this.sendJsonCommand("drive", { speed_pct: speedPct, ttl_ms: ttlMs });
    if (!resp.ok) throw new Error(`drive failed: ${(resp.error as { message: string })?.message}`);
  }

  async steer(angleDeg: number, ttlMs = 500): Promise<void> {
    const resp = await this.sendJsonCommand("steer", { angle_deg: angleDeg, ttl_ms: ttlMs });
    if (!resp.ok) throw new Error(`steer failed: ${(resp.error as { message: string })?.message}`);
  }

  async setMotorSpeed(channel: number, speedPct: number, ttlMs = 500): Promise<void> {
    const resp = await this.sendJsonCommand("set_motor_speed", {
      channel,
      speed_pct: speedPct,
      ttl_ms: ttlMs,
    });
    if (!resp.ok) throw new Error(`setMotorSpeed failed: ${(resp.error as { message: string })?.message}`);
  }

  async stopAllMotors(): Promise<void> {
    const resp = await this.sendJsonCommand("stop_all_motors");
    if (!resp.ok) throw new Error(`stopAllMotors failed: ${(resp.error as { message: string })?.message}`);
  }

  async setServoAngle(channel: number, angleDeg: number, ttlMs = 500): Promise<void> {
    const resp = await this.sendJsonCommand("set_servo_angle", {
      channel,
      angle_deg: angleDeg,
      ttl_ms: ttlMs,
    });
    if (!resp.ok) throw new Error(`setServoAngle failed: ${(resp.error as { message: string })?.message}`);
  }

  async readUltrasonic(): Promise<{ distance_cm: number }> {
    const resp = await this.sendJsonCommand("read_ultrasonic");
    if (!resp.ok) throw new Error(`readUltrasonic failed: ${(resp.error as { message: string })?.message}`);
    return { distance_cm: (resp.result as { distance_cm: number }).distance_cm };
  }

  async readGrayscale(): Promise<{ values: number[] }> {
    const resp = await this.sendJsonCommand("read_grayscale");
    if (!resp.ok) throw new Error(`readGrayscale failed: ${(resp.error as { message: string })?.message}`);
    return { values: (resp.result as { values: number[] }).values };
  }

  async getHealth(): Promise<IpcResponse> {
    return this.sendJsonCommand("health");
  }

  async scanWifi(): Promise<WifiNetwork[]> {
    const resp = await this.sendJsonCommand("wifi_scan");
    if (!resp.ok) throw new Error(`scanWifi failed: ${(resp.error as { message: string })?.message}`);
    return (resp.result as { networks: WifiNetwork[] }).networks;
  }

  async connectWifi(ssid: string, psk: string): Promise<boolean> {
    const resp = await this.sendJsonCommand("wifi_connect", { ssid, psk });
    if (!resp.ok) throw new Error(`connectWifi failed: ${(resp.error as { message: string })?.message}`);
    return (resp.result as { connected: boolean }).connected;
  }

  async getWifiStatus(): Promise<WifiStatus> {
    const resp = await this.sendJsonCommand("wifi_status");
    if (!resp.ok) throw new Error(`getWifiStatus failed: ${(resp.error as { message: string })?.message}`);
    const r = resp.result as { state: string; ssid: string | null; signal_pct: number | null };
    return { state: r.state, ssid: r.ssid, signal_pct: r.signal_pct };
  }

  onStatusChange(listener: StatusListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  protected _setStatus(next: ConnectionStatus): void {
    this._status = next;
    for (const listener of this._listeners) {
      listener(next);
    }
  }
}

// ---------------------------------------------------------------------------
// Mock implementation (development / web)
// ---------------------------------------------------------------------------

const MOCK_DEVICES: BleDevice[] = [
  { id: "nomon-0001", name: "nomon-alpha", rssi: -42 },
  { id: "nomon-0002", name: "nomon-beta", rssi: -68 },
];

export class MockBleService extends BaseBleService {
  private _connectedId: string | null = null;
  private _requestId = 0;

  async getPairedDevices(): Promise<BleDevice[]> {
    // Mock returns both devices as "paired"
    return [...MOCK_DEVICES];
  }

  async scan(timeoutMs = 3000): Promise<BleDevice[]> {
    this._setStatus("scanning");
    await delay(Math.min(timeoutMs, 1500));
    this._setStatus("disconnected");
    return [...MOCK_DEVICES];
  }

  async connect(deviceId: string): Promise<void> {
    const device = MOCK_DEVICES.find((d) => d.id === deviceId);
    if (!device) {
      throw new Error(`Unknown device: ${deviceId}`);
    }
    this._setStatus("connecting");
    await delay(800);
    this._connectedId = deviceId;
    this._setStatus("connected");
  }

  async disconnect(): Promise<void> {
    this._connectedId = null;
    this._token = null;
    this._setStatus("disconnected");
  }

  async authenticate(): Promise<string> {
    if (this._status !== "connected" || !this._connectedId) {
      throw new Error("Must be connected before authenticating");
    }
    await delay(300);
    this._token = "mock.jwt.token";
    return this._token;
  }

  async sendJsonCommand(method: string, params: Record<string, unknown> = {}): Promise<IpcResponse> {
    if (this._status !== "connected") {
      throw new Error("Not connected — cannot send commands");
    }
    await delay(100);
    this._requestId += 1;
    const id = `mock-${this._requestId}`;
    return this._mockResponse(id, method, params);
  }

  private _mockResponse(id: string, method: string, _params: Record<string, unknown>): IpcResponse {
    switch (method) {
      case "get_battery_voltage":
        return { id, ok: true, result: { voltage_v: 7.4 } };
      case "read_ultrasonic":
        return { id, ok: true, result: { distance_cm: 25.5 } };
      case "read_grayscale":
        return { id, ok: true, result: { channels: [0, 1, 2], values: [100, 200, 150] } };
      case "health":
        return { id, ok: true, result: { status: "ok", uptime_s: 3600 } };
      case "wifi_scan":
        return { id, ok: true, result: { networks: [
          { ssid: "HomeNetwork", signal_pct: 85, security: "WPA2" },
          { ssid: "OfficeWiFi", signal_pct: 62, security: "WPA3" },
        ] } };
      case "wifi_connect":
        return { id, ok: true, result: { connected: true } };
      case "wifi_status":
        return { id, ok: true, result: { state: "connected", ssid: "HomeNetwork", signal_pct: 85 } };
      default:
        return { id, ok: true, result: {} };
    }
  }
}

// ---------------------------------------------------------------------------
// Real BLE implementation (mobile only)
// ---------------------------------------------------------------------------

/**
 * Real BLE service using react-native-ble-plx.
 *
 * Lazily imports react-native-ble-plx to avoid bundling on web.
 * OS handles Bluetooth passkey pairing. Communication uses NDJSON relay
 * over a single GATT service.
 */
export class RealBleService extends BaseBleService {
  private _requestId = 0;
  private _manager: BleManagerInstance | null = null;
  private _device: BleDeviceInstance | null = null;
  private _notifySub: { remove(): void } | null = null;
  private _pendingResponse: PendingResponse | null = null;
  private _responseBuffer = "";

  async getPairedDevices(): Promise<BleDevice[]> {
    // react-native-ble-plx doesn't provide an easy way to list bonded devices
    // from JavaScript. Users can discover devices via scan or use previously
    // saved IDs. For now, return empty array and rely on "Add New Device" scan.
    return [];
  }

  private async getManager(): Promise<BleManagerInstance> {
    if (this._manager) return this._manager;
    const blePlx = await import("react-native-ble-plx");
    this._manager = new blePlx.BleManager() as BleManagerInstance;
    return this._manager;
  }

  async scan(timeoutMs = 5000): Promise<BleDevice[]> {
    const manager = await this.getManager();
    this._setStatus("scanning");

    const devices: BleDevice[] = [];
    const seen = new Set<string>();

    return new Promise<BleDevice[]>((resolve) => {
      const timer = setTimeout(() => {
        manager.stopDeviceScan();
        this._setStatus("disconnected");
        resolve(devices);
      }, timeoutMs);

      manager.startDeviceScan(
        [NOMON_SERVICE_UUID],
        { allowDuplicates: false },
        (error: unknown, device: BleDeviceInstance | null) => {
          if (error) {
            clearTimeout(timer);
            manager.stopDeviceScan();
            this._setStatus("disconnected");
            resolve(devices);
            return;
          }
          if (device && !seen.has(device.id)) {
            seen.add(device.id);
            devices.push({
              id: device.id,
              name: device.name ?? device.localName ?? null,
              rssi: device.rssi ?? null,
            });
          }
        },
      );
    });
  }

  async connect(deviceId: string): Promise<void> {
    const manager = await this.getManager();
    this._setStatus("connecting");

    try {
      // OS-level bonding handles passkey pairing automatically.
      const device = await manager.connectToDevice(deviceId, {
        requestMTU: 247,
      });
      await device.discoverAllServicesAndCharacteristics();
      this._device = device;
      this._responseBuffer = "";

      // Subscribe to Response Notify for NDJSON responses.
      this._notifySub = device.monitorCharacteristicForService(
        NOMON_SERVICE_UUID,
        RESPONSE_NOTIFY_CHAR_UUID,
        (error: unknown, characteristic: CharacteristicInstance | null) => {
          if (error) {
            this._pendingResponse?.reject(
              new Error(
                `Response notification error: ${error instanceof Error ? error.message : String(error)}`,
              ),
            );
            return;
          }
          if (characteristic?.value) {
            const chunk = base64ToString(characteristic.value);
            const consumed = consumeNdjsonChunks(this._responseBuffer, chunk);

            for (const line of consumed.lines) {
              try {
                const resp = JSON.parse(line) as IpcResponse;
                this._pendingResponse?.resolve(resp);
              } catch {
                this._pendingResponse?.reject(new Error(`Invalid JSON response: ${line}`));
              }
            }

            this._responseBuffer = consumed.buffer;
          }
        },
      );

      this._setStatus("connected");

      manager.onDeviceDisconnected(deviceId, () => {
        this._device = null;
        this._token = null;
        this._setStatus("disconnected");
      });
    } catch (err) {
      this._setStatus("disconnected");
      throw new Error(
        `BLE connect failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async disconnect(): Promise<void> {
    this._notifySub?.remove();
    this._notifySub = null;
    if (this._device) {
      try {
        await this._device.cancelConnection();
      } catch {
        // Device may already be disconnected
      }
      this._device = null;
    }
    this._token = null;
    this._responseBuffer = "";
    this._setStatus("disconnected");
  }

  async authenticate(): Promise<string> {
    if (!this._device) {
      throw new Error("Must be connected before authenticating");
    }
    const resp = await this.sendJsonCommand("authenticate");
    if (!resp.ok) {
      throw new Error(`Authentication failed: ${(resp.error as { message: string })?.message}`);
    }
    const token = extractAuthToken(resp.result);
    if (!token) throw new Error("Authentication response missing token");
    this._token = token;
    return this._token;
  }

  async sendJsonCommand(method: string, params: Record<string, unknown> = {}): Promise<IpcResponse> {
    if (!this._device) {
      throw new Error("Not connected — cannot send commands");
    }

    this._requestId += 1;
    const id = `ble-${this._requestId}`;
    const request: IpcRequest = { id, method, params };
    const ndjson = JSON.stringify(request) + "\n";

    const responsePromise = new Promise<IpcResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingResponse = null;
        reject(new Error(`Command '${method}' timed out`));
      }, 10000);

      this._pendingResponse = {
        resolve: (resp: IpcResponse) => {
          clearTimeout(timeout);
          this._pendingResponse = null;
          resolve(resp);
        },
        reject: (err: Error) => {
          clearTimeout(timeout);
          this._pendingResponse = null;
          reject(err);
        },
      };
    });

    // Chunk the NDJSON line at MTU boundary and write to the Command char.
    const encoded = stringToBase64(ndjson);
    await this._device.writeCharacteristicWithoutResponseForService(
      NOMON_SERVICE_UUID,
      COMMAND_WRITE_CHAR_UUID,
      encoded,
    );

    return responsePromise;
  }
}

// ---------------------------------------------------------------------------
// Web Bluetooth implementation (web only)
// ---------------------------------------------------------------------------

/**
 * Real BLE service using Web Bluetooth API.
 *
 * Uses the browser's native Web Bluetooth API to scan for and connect
 * to nomon devices. Users must have already paired the device via OS
 * settings for it to appear in the selection dialog.
 *
 * Communicates via GATT characteristics using NDJSON format.
 */
export class WebBleService extends BaseBleService {
  private _requestId = 0;
  private _device: BluetoothDevice | null = null;
  private _characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private _notifySubId: number | null = null;
  private _pendingResponse: PendingResponse | null = null;
  private _responseBuffer = "";
  private static readonly PAIRED_DEVICES_KEY = "nomon-paired-devices";

  async getPairedDevices(): Promise<BleDevice[]> {
    // Web Bluetooth API doesn't provide a way to list all paired devices.
    // We store previously connected device info (id + name) in localStorage.
    try {
      const stored = localStorage.getItem(WebBleService.PAIRED_DEVICES_KEY);
      if (!stored) return [];

      const devicesData = JSON.parse(stored) as Array<{ id: string; name?: string }>;
      return devicesData.map((d) => ({
        id: d.id,
        name: d.name ?? null,
        rssi: null, // Web Bluetooth API doesn't expose RSSI
      }));
    } catch {
      return [];
    }
  }

  private _savePairedDevice(deviceId: string, deviceName?: string): void {
    try {
      const stored = localStorage.getItem(WebBleService.PAIRED_DEVICES_KEY);
      const devicesData = stored ? (JSON.parse(stored) as Array<{ id: string; name?: string }>) : [];
      
      const exists = devicesData.some((d) => d.id === deviceId);
      if (!exists) {
        devicesData.push({ id: deviceId, name: deviceName });
        localStorage.setItem(
          WebBleService.PAIRED_DEVICES_KEY,
          JSON.stringify(devicesData),
        );
      }
    } catch {
      // localStorage may be unavailable; continue without storing
    }
  }

  async scan(timeoutMs = 5000): Promise<BleDevice[]> {
    this._setStatus("scanning");
    try {
      if (!navigator.bluetooth) {
        throw new Error("Web Bluetooth API not available in this browser");
      }

      // Request device filters for nomon service UUID
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          {
            services: [NOMON_SERVICE_UUID],
          },
        ],
        optionalServices: [NOMON_SERVICE_UUID],
      });

      // Save the selected device for future reference (including name)
      this._savePairedDevice(device.id, device.name);

      // Return the single selected device
      const result: BleDevice[] = [
        {
          id: device.id,
          name: device.name ?? null,
          rssi: null, // Web Bluetooth API doesn't expose RSSI
        },
      ];

      this._setStatus("disconnected");
      return result;
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotFoundError"
          ? "No device selected"
          : err instanceof Error
            ? err.message
            : "Web Bluetooth scan failed";
      this._setStatus("disconnected");
      throw new Error(message);
    }
  }

  async connect(deviceId: string): Promise<void> {
    this._setStatus("connecting");
    try {
      if (!navigator.bluetooth) {
        throw new Error("Web Bluetooth API not available in this browser");
      }

      // Use the device ID to reconnect to previously paired device
      const device = await navigator.bluetooth.getDevice?.(deviceId);
      if (!device) {
        throw new Error(
          `Device ${deviceId} not found. Please pair it via OS settings first.`,
        );
      }

      // Connect to GATT server
      const server = await device.gatt?.connect?.();
      if (!server) throw new Error("Failed to connect to GATT server");

      // Get the nomon service
      const service = await server.getPrimaryService(NOMON_SERVICE_UUID);

      // Get response characteristic for notifications
      this._characteristic = await service.getCharacteristic(
        RESPONSE_NOTIFY_CHAR_UUID,
      );
      await this._characteristic.startNotifications();

      // Remember this device for next time (including name)
      this._savePairedDevice(deviceId, device.name);

      // Listen for notifications
      this._characteristic.addEventListener(
        "characteristicvaluechanged",
        this._handleNotification.bind(this),
      );

      this._device = device;
      this._responseBuffer = "";
      this._setStatus("connected");
    } catch (err) {
      this._setStatus("disconnected");
      throw new Error(
        `Web Bluetooth connect failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private _handleNotification(
    event: Event,
  ): void {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    const value = characteristic.value;
    if (!value) return;
    // Decode the notification data
    const chunk = new TextDecoder().decode(value);
    const consumed = consumeNdjsonChunks(this._responseBuffer, chunk);

    for (const line of consumed.lines) {
      try {
        const resp = JSON.parse(line) as IpcResponse;
        this._pendingResponse?.resolve(resp);
      } catch {
        this._pendingResponse?.reject(
          new Error(`Invalid JSON response: ${line}`),
        );
      }
    }

    this._responseBuffer = consumed.buffer;
  }

  async disconnect(): Promise<void> {
    if (this._characteristic) {
      try {
        await this._characteristic.stopNotifications();
        this._characteristic.removeEventListener(
          "characteristicvaluechanged",
          this._handleNotification.bind(this),
        );
      } catch {
        // Device may already be disconnected
      }
      this._characteristic = null;
    }
    if (this._device?.gatt?.connected) {
      try {
        this._device.gatt.disconnect();
      } catch {
        // Device may already be disconnected
      }
    }
    this._device = null;
    this._token = null;
    this._responseBuffer = "";
    this._setStatus("disconnected");
  }

  async authenticate(): Promise<string> {
    if (!this._device) {
      throw new Error("Must be connected before authenticating");
    }
    const resp = await this.sendJsonCommand("authenticate");
    if (!resp.ok) {
      throw new Error(
        `Authentication failed: ${(resp.error as { message: string })?.message}`,
      );
    }
    const token = extractAuthToken(resp.result);
    if (!token) throw new Error("Authentication response missing token");
    this._token = token;
    return this._token;
  }

  async sendJsonCommand(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<IpcResponse> {
    if (!this._device) {
      throw new Error("Not connected — cannot send commands");
    }

    this._requestId += 1;
    const id = `web-${this._requestId}`;
    const request: IpcRequest = { id, method, params };
    const ndjson = JSON.stringify(request) + "\n";

    const responsePromise = new Promise<IpcResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingResponse = null;
        reject(new Error(`Command '${method}' timed out`));
      }, 10000);

      this._pendingResponse = {
        resolve: (resp: IpcResponse) => {
          clearTimeout(timeout);
          this._pendingResponse = null;
          resolve(resp);
        },
        reject: (err: Error) => {
          clearTimeout(timeout);
          this._pendingResponse = null;
          reject(err);
        },
      };
    });

    // Get command characteristic and write the command
    this._device.gatt
      ?.connect?.()
      .then((server: BluetoothRemoteGATTServer) => server.getPrimaryService(NOMON_SERVICE_UUID))
      .then((service: BluetoothRemoteGATTService) =>
        service.getCharacteristic(COMMAND_WRITE_CHAR_UUID),
      )
      .then((char: BluetoothRemoteGATTCharacteristic) => {
        const encoded = new TextEncoder().encode(ndjson);
        return char.writeValueWithoutResponse(encoded);
      })
      .catch((err: Error) => {
        this._pendingResponse?.reject(err);
      });

    return responsePromise;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the appropriate BLE service for the current platform.
 *
 * Platform selection:
 * - Web: WebBleService (uses Web Bluetooth API for real device pairing)
 * - Mobile with ENABLE_BLE_MOCK_MODE=true: MockBleService (for testing)
 * - Mobile: RealBleService (uses react-native-ble-plx)
 */
export function createBleService(): BleService {
  if (Platform.OS === "web") {
    return new WebBleService();
  }
  if (ENABLE_BLE_MOCK_MODE) {
    return new MockBleService();
  }
  return new RealBleService();
}

// ---------------------------------------------------------------------------
// Internal types for react-native-ble-plx (avoid importing on web)
// ---------------------------------------------------------------------------

interface BleManagerInstance {
  startDeviceScan(
    uuids: string[] | null,
    options: { allowDuplicates: boolean },
    callback: (error: unknown, device: BleDeviceInstance | null) => void,
  ): void;
  stopDeviceScan(): void;
  connectToDevice(
    id: string,
    options?: { requestMTU?: number },
  ): Promise<BleDeviceInstance>;
  onDeviceDisconnected(
    id: string,
    callback: (error: unknown, device: BleDeviceInstance | null) => void,
  ): void;
}

interface BleDeviceInstance {
  id: string;
  name: string | null;
  localName: string | null;
  rssi: number | null;
  discoverAllServicesAndCharacteristics(): Promise<BleDeviceInstance>;
  cancelConnection(): Promise<BleDeviceInstance>;
  writeCharacteristicWithoutResponseForService(
    serviceUUID: string,
    characteristicUUID: string,
    valueBase64: string,
  ): Promise<CharacteristicInstance>;
  monitorCharacteristicForService(
    serviceUUID: string,
    characteristicUUID: string,
    callback: (error: unknown, characteristic: CharacteristicInstance | null) => void,
  ): { remove: () => void };
}

interface CharacteristicInstance {
  value: string | null;
  uuid: string;
}

interface PendingResponse {
  resolve: (resp: IpcResponse) => void;
  reject: (err: Error) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Consume NDJSON chunks: append a chunk to an existing buffer and extract
 * complete lines (without trailing newline). Returns parsed lines and the
 * remaining buffer.
 */
export function consumeNdjsonChunks(
  buffer: string,
  chunk: string,
): { lines: string[]; buffer: string } {
  buffer += chunk;
  const lines: string[] = [];
  let newlinePos: number;
  while ((newlinePos = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newlinePos).trim();
    buffer = buffer.slice(newlinePos + 1);
    if (line.length > 0) lines.push(line);
  }
  return { lines, buffer };
}

/**
 * Extract an authentication token from an `authenticate` IPC response `result`.
 * Tolerant to both `token` and `jwt` field names (and `access_token`).
 */
export function extractAuthToken(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  if (typeof r.token === "string" && r.token.length > 0) return r.token;
  if (typeof r.jwt === "string" && r.jwt.length > 0) return r.jwt;
  if (typeof r.access_token === "string" && r.access_token.length > 0) return r.access_token;
  return null;
}

/** Decode base64 string to UTF-8 string. */
function base64ToString(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/** Encode UTF-8 string to base64 string. */
function stringToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
