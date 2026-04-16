/**
 * Bluetooth Low Energy abstraction layer.
 *
 * Provides a clean interface for BLE communication with nomon devices.
 * - MockBleService: stub implementation for web and testing
 * - RealBleService: real BLE via react-native-ble-plx (mobile only)
 *
 * The factory `createBleService()` returns the correct implementation
 * based on `Platform.OS`.
 */

import { Platform } from "react-native";

import {
    type BleFrame,
    Opcode,
    ResponseOpcode,
    WifiCommand,
    WifiState,
    decodeBatteryResult,
    decodeError,
    decodeGrayscaleResult,
    decodeHealthResult,
    decodeResponse,
    decodeUltrasonicResult,
    encodeDrivePayload,
    encodeRequest,
    encodeSetMotorSpeedPayload,
    encodeSetServoAnglePayload,
    encodeSteerPayload,
    mvToVoltage,
} from "@/lib/ble-protocol";
import { BleSession, deriveSessionKey } from "@/lib/ble-session";

// ---------------------------------------------------------------------------
// GATT UUIDs (from nomopractic services.rs / project-context.md)
// ---------------------------------------------------------------------------

/** Pairing Service UUID — used for scan filtering. */
const PAIRING_SERVICE_UUID = "e3a10001-7b2a-4b9c-8f5a-2b7d6e4f1a3c";

/** Pairing Secret characteristic (write). */
const PAIRING_SECRET_CHAR_UUID = "e3a11001-7b2a-4b9c-8f5a-2b7d6e4f1a3c";
/** Auth Token characteristic (notify — salt + JWT). */
const AUTH_TOKEN_CHAR_UUID = "e3a11002-7b2a-4b9c-8f5a-2b7d6e4f1a3c";

/** Command Service UUID. */
const COMMAND_SERVICE_UUID = "e3a10002-7b2a-4b9c-8f5a-2b7d6e4f1a3c";
/** Command Write characteristic (write). */
const COMMAND_WRITE_CHAR_UUID = "e3a12001-7b2a-4b9c-8f5a-2b7d6e4f1a3c";
/** Command Response characteristic (notify). */
const COMMAND_RESPONSE_CHAR_UUID = "e3a12002-7b2a-4b9c-8f5a-2b7d6e4f1a3c";

/** WiFi Provisioning Service UUID. */
const WIFI_SERVICE_UUID = "e3a10003-7b2a-4b9c-8f5a-2b7d6e4f1a3c";
/** WiFi Command characteristic (write). */
const WIFI_COMMAND_CHAR_UUID = "e3a13001-7b2a-4b9c-8f5a-2b7d6e4f1a3c";
/** WiFi Result characteristic (notify). */
const WIFI_RESULT_CHAR_UUID = "e3a13002-7b2a-4b9c-8f5a-2b7d6e4f1a3c";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Connection lifecycle states. */
export type ConnectionStatus =
  | "disconnected"
  | "scanning"
  | "connecting"
  | "connected"
  | "paired";

/** Minimal representation of a discovered BLE peripheral. */
export interface BleDevice {
  id: string;
  name: string | null;
  rssi: number | null;
}

/** Callback invoked when connection status changes. */
export type StatusListener = (status: ConnectionStatus) => void;

/** Result returned after a successful BLE pairing. */
export interface PairingResult {
  jwt: string;
  salt: Uint8Array;
}

/** WiFi network discovered during scan. */
export interface WifiNetwork {
  ssid: string;
  signalStrength: number;
}

/** Current WiFi connection state. */
export interface WifiStatus {
  connected: boolean;
  ssid: string | null;
  signalStrength: number | null;
}

// ---------------------------------------------------------------------------
// BLE Service interface
// ---------------------------------------------------------------------------

/** Abstract BLE service contract. */
export interface BleService {
  /** Scan for nearby nomon devices. Resolves with discovered peripherals. */
  scan(timeoutMs?: number): Promise<BleDevice[]>;

  /** Connect to a specific device by ID. */
  connect(deviceId: string): Promise<void>;

  /** Disconnect from the currently connected device. */
  disconnect(): Promise<void>;

  /** Pair with the connected device using a shared secret. */
  pair(secret: string): Promise<PairingResult>;

  /**
   * Send an encrypted binary command and wait for the response.
   * Returns the decoded response frame.
   */
  sendCommand(opcode: Opcode, payload: Uint8Array): Promise<BleFrame>;

  /** Register a listener for connection status changes. Returns unsubscribe fn. */
  onStatusChange(listener: StatusListener): () => void;

  /** Current connection status. */
  readonly status: ConnectionStatus;

  /** The active BLE session (null if not paired). */
  readonly session: BleSession | null;

  // -- Typed command helpers --

  /** Get battery voltage. */
  getBattery(): Promise<{ voltageMv: number; voltageV: number }>;

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
  readUltrasonic(): Promise<{ distanceCm: number }>;

  /** Read grayscale sensor values. */
  readGrayscale(): Promise<{ values: number[] }>;

  /** Get device health status. */
  getHealth(): Promise<{ status: number; uptimeS: number }>;

  // -- WiFi provisioning --

  /** Scan for available WiFi networks. */
  scanWifi(): Promise<WifiNetwork[]>;

  /** Connect the device to a WiFi network. */
  connectWifi(ssid: string, password: string): Promise<boolean>;

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
 * `scan`, `connect`, `disconnect`, `pair`, `sendCommand`,
 * `scanWifi`, `connectWifi`, and `getWifiStatus`.
 */
abstract class BaseBleService implements BleService {
  protected _status: ConnectionStatus = "disconnected";
  protected _listeners: Set<StatusListener> = new Set();
  protected _session: BleSession | null = null;

  get status(): ConnectionStatus {
    return this._status;
  }

  get session(): BleSession | null {
    return this._session;
  }

  abstract scan(timeoutMs?: number): Promise<BleDevice[]>;
  abstract connect(deviceId: string): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract pair(secret: string): Promise<PairingResult>;
  abstract sendCommand(opcode: Opcode, payload: Uint8Array): Promise<BleFrame>;
  abstract scanWifi(): Promise<WifiNetwork[]>;
  abstract connectWifi(ssid: string, password: string): Promise<boolean>;
  abstract getWifiStatus(): Promise<WifiStatus>;

  async getBattery(): Promise<{ voltageMv: number; voltageV: number }> {
    const frame = await this.sendCommand(Opcode.GetBattery, new Uint8Array(0));
    const result = decodeBatteryResult(frame.payload);
    return { voltageMv: result.voltageMv, voltageV: mvToVoltage(result.voltageMv) };
  }

  async drive(speedPct: number, ttlMs = 500): Promise<void> {
    await this.sendCommand(Opcode.Drive, encodeDrivePayload(speedPct, ttlMs));
  }

  async steer(angleDeg: number, ttlMs = 500): Promise<void> {
    await this.sendCommand(Opcode.Steer, encodeSteerPayload(angleDeg, ttlMs));
  }

  async setMotorSpeed(channel: number, speedPct: number, ttlMs = 500): Promise<void> {
    await this.sendCommand(
      Opcode.SetMotorSpeed,
      encodeSetMotorSpeedPayload(channel, speedPct, ttlMs),
    );
  }

  async stopAllMotors(): Promise<void> {
    await this.sendCommand(Opcode.StopAllMotors, new Uint8Array(0));
  }

  async setServoAngle(channel: number, angleDeg: number, ttlMs = 500): Promise<void> {
    await this.sendCommand(
      Opcode.SetServoAngle,
      encodeSetServoAnglePayload(channel, angleDeg, ttlMs),
    );
  }

  async readUltrasonic(): Promise<{ distanceCm: number }> {
    const frame = await this.sendCommand(Opcode.ReadUltrasonic, new Uint8Array(0));
    const result = decodeUltrasonicResult(frame.payload);
    return { distanceCm: result.distanceX10 / 10 };
  }

  async readGrayscale(): Promise<{ values: number[] }> {
    const frame = await this.sendCommand(Opcode.ReadGrayscale, new Uint8Array(0));
    const result = decodeGrayscaleResult(frame.payload);
    return { values: [result.v0, result.v1, result.v2] };
  }

  async getHealth(): Promise<{ status: number; uptimeS: number }> {
    const frame = await this.sendCommand(Opcode.GetHealth, new Uint8Array(0));
    return decodeHealthResult(frame.payload);
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
  private _seqNr = 0;

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
    this._session = null;
    this._setStatus("disconnected");
  }

  async pair(secret: string): Promise<PairingResult> {
    if (this._status !== "connected" || !this._connectedId) {
      throw new Error("Must be connected before pairing");
    }
    await delay(500);
    const salt = new Uint8Array(16);
    for (let i = 0; i < 16; i++) salt[i] = i;
    const sessionKey = deriveSessionKey(secret, salt);
    const jwt = "mock.jwt.token";
    this._session = new BleSession(sessionKey, jwt);
    this._setStatus("paired");
    return { jwt, salt };
  }

  async sendCommand(opcode: Opcode, payload: Uint8Array): Promise<BleFrame> {
    if (this._status !== "paired") {
      throw new Error("Not paired — cannot send commands");
    }
    await delay(100);
    this._seqNr = (this._seqNr + 1) & 0xff;
    const responseOpcode = opcode | 0x80;
    const mockPayload = this._mockResponsePayload(opcode);
    return { opcode: responseOpcode, seqNr: this._seqNr, payload: mockPayload };
  }

  async scanWifi(): Promise<WifiNetwork[]> {
    await delay(1000);
    return [
      { ssid: "HomeNetwork", signalStrength: -45 },
      { ssid: "OfficeWiFi", signalStrength: -62 },
    ];
  }

  async connectWifi(_ssid: string, _password: string): Promise<boolean> {
    await delay(2000);
    return true;
  }

  async getWifiStatus(): Promise<WifiStatus> {
    await delay(200);
    return { connected: true, ssid: "HomeNetwork", signalStrength: -45 };
  }

  private _mockResponsePayload(opcode: Opcode): Uint8Array {
    switch (opcode) {
      case Opcode.GetBattery: {
        const buf = new Uint8Array(4);
        const view = new DataView(buf.buffer);
        view.setUint16(0, 7400, true);
        view.setUint16(2, 2048, true);
        return buf;
      }
      case Opcode.ReadUltrasonic: {
        const buf = new Uint8Array(2);
        new DataView(buf.buffer).setUint16(0, 255, true);
        return buf;
      }
      case Opcode.ReadGrayscale: {
        const buf = new Uint8Array(6);
        const view = new DataView(buf.buffer);
        view.setUint16(0, 100, true);
        view.setUint16(2, 200, true);
        view.setUint16(4, 150, true);
        return buf;
      }
      case Opcode.GetHealth: {
        const buf = new Uint8Array(5);
        const view = new DataView(buf.buffer);
        buf[0] = 0;
        view.setUint32(1, 3600, true);
        return buf;
      }
      case Opcode.Drive: {
        const buf = new Uint8Array(3);
        const view = new DataView(buf.buffer);
        view.setInt16(0, 5000, true);
        buf[2] = 2;
        return buf;
      }
      case Opcode.Steer: {
        const buf = new Uint8Array(3);
        const view = new DataView(buf.buffer);
        view.setUint16(0, 900, true);
        buf[2] = 0;
        return buf;
      }
      default: {
        return new Uint8Array([0x01]);
      }
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
 * All BLE operations go through the BleManager instance.
 */
export class RealBleService extends BaseBleService {
  private _seqNr = 0;
  private _manager: BleManagerInstance | null = null;
  private _device: BleDeviceInstance | null = null;
  private _commandResponsePromise: CommandResponseState | null = null;

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
        [PAIRING_SERVICE_UUID],
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
      const device = await manager.connectToDevice(deviceId, {
        requestMTU: 247,
      });
      await device.discoverAllServicesAndCharacteristics();
      this._device = device;
      this._setStatus("connected");

      manager.onDeviceDisconnected(deviceId, () => {
        this._device = null;
        this._session = null;
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
    if (this._device) {
      try {
        await this._device.cancelConnection();
      } catch {
        // Device may already be disconnected
      }
      this._device = null;
    }
    this._session = null;
    this._setStatus("disconnected");
  }

  async pair(secret: string): Promise<PairingResult> {
    if (!this._device) {
      throw new Error("Must be connected before pairing");
    }

    const device = this._device;

    let authSubscription: { remove: () => void } | null = null;
    const authResult = await new Promise<{ salt: Uint8Array; jwt: string }>(
      (resolve, reject) => {
        const timeout = setTimeout(() => {
          authSubscription?.remove();
          reject(new Error("Pairing timed out waiting for auth token"));
        }, 10000);

        authSubscription = device.monitorCharacteristicForService(
          PAIRING_SERVICE_UUID,
          AUTH_TOKEN_CHAR_UUID,
          (error: unknown, characteristic: CharacteristicInstance | null) => {
            if (error) {
              clearTimeout(timeout);
              authSubscription?.remove();
              reject(
                new Error(
                  `Auth notification error: ${error instanceof Error ? error.message : String(error)}`,
                ),
              );
              return;
            }
            if (characteristic?.value) {
              clearTimeout(timeout);
              authSubscription?.remove();
              const raw = base64ToBytes(characteristic.value);
              const salt = raw.slice(0, 16);
              const jwtBytes = raw.slice(16);
              const jwt = new TextDecoder().decode(jwtBytes);
              resolve({ salt, jwt });
            }
          },
        );

        const secretBytes = new TextEncoder().encode(secret);
        const secretB64 = bytesToBase64(secretBytes);
        device
          .writeCharacteristicWithResponseForService(
            PAIRING_SERVICE_UUID,
            PAIRING_SECRET_CHAR_UUID,
            secretB64,
          )
          .catch((err: unknown) => {
            clearTimeout(timeout);
            reject(
              new Error(
                `Failed to write pairing secret: ${err instanceof Error ? err.message : String(err)}`,
              ),
            );
          });
      },
    );

    const sessionKey = deriveSessionKey(secret, authResult.salt);
    this._session = new BleSession(sessionKey, authResult.jwt);
    this._setStatus("paired");

    return { jwt: authResult.jwt, salt: authResult.salt };
  }

  async sendCommand(opcode: Opcode, payload: Uint8Array): Promise<BleFrame> {
    if (!this._device || !this._session) {
      throw new Error("Not paired — cannot send commands");
    }

    const device = this._device;
    const session = this._session;
    this._seqNr = (this._seqNr + 1) & 0xff;

    const frame = encodeRequest(opcode, this._seqNr, payload);
    const aad = frame.slice(0, 3);
    const encryptedPayload = session.encrypt(frame.slice(3), aad);

    const encFrame = new Uint8Array(3 + encryptedPayload.length);
    encFrame.set(aad, 0);
    encFrame.set(encryptedPayload, 3);

    const responsePromise = new Promise<BleFrame>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._commandResponsePromise = null;
        reject(new Error("Command response timeout"));
      }, 5000);

      this._commandResponsePromise = {
        resolve: (f: BleFrame) => {
          clearTimeout(timeout);
          this._commandResponsePromise = null;
          resolve(f);
        },
        reject: (err: Error) => {
          clearTimeout(timeout);
          this._commandResponsePromise = null;
          reject(err);
        },
      };
    });

    const subscription = device.monitorCharacteristicForService(
      COMMAND_SERVICE_UUID,
      COMMAND_RESPONSE_CHAR_UUID,
      (error: unknown, characteristic: CharacteristicInstance | null) => {
        if (error) {
          this._commandResponsePromise?.reject(
            new Error(
              `Command response error: ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
          return;
        }
        if (characteristic?.value) {
          try {
            const raw = base64ToBytes(characteristic.value);
            const respAad = raw.slice(0, 3);
            const encPayload = raw.slice(3);
            const decrypted = session.decrypt(encPayload, respAad);
            const fullFrame = new Uint8Array(3 + decrypted.length);
            fullFrame.set(respAad, 0);
            fullFrame[2] = decrypted.length;
            fullFrame.set(decrypted, 3);
            const decoded = decodeResponse(fullFrame);

            if (decoded.opcode === ResponseOpcode.Error) {
              const err = decodeError(decoded.payload);
              this._commandResponsePromise?.reject(
                new Error(
                  `BLE error ${err.errorCode} (ref seq ${err.refSeq})`,
                ),
              );
            } else {
              this._commandResponsePromise?.resolve(decoded);
            }
          } catch (err) {
            this._commandResponsePromise?.reject(
              err instanceof Error ? err : new Error(String(err)),
            );
          }
        }
      },
    );

    const cmdB64 = bytesToBase64(encFrame);
    await device.writeCharacteristicWithResponseForService(
      COMMAND_SERVICE_UUID,
      COMMAND_WRITE_CHAR_UUID,
      cmdB64,
    );

    try {
      return await responsePromise;
    } finally {
      subscription.remove();
    }
  }

  async scanWifi(): Promise<WifiNetwork[]> {
    return this.wifiExchange(
      new Uint8Array([WifiCommand.Scan]),
      parseWifiScanResult,
      15000,
    );
  }

  async connectWifi(ssid: string, password: string): Promise<boolean> {
    const ssidBytes = new TextEncoder().encode(ssid);
    const passBytes = new TextEncoder().encode(password);
    const cmd = new Uint8Array(1 + 1 + ssidBytes.length + 1 + passBytes.length);
    cmd[0] = WifiCommand.Connect;
    cmd[1] = ssidBytes.length;
    cmd.set(ssidBytes, 2);
    cmd[2 + ssidBytes.length] = passBytes.length;
    cmd.set(passBytes, 2 + ssidBytes.length + 1);
    return this.wifiExchange(cmd, (raw) => raw[1] === 0x01, 30000);
  }

  async getWifiStatus(): Promise<WifiStatus> {
    return this.wifiExchange(
      new Uint8Array([WifiCommand.Status]),
      parseWifiStatus,
      5000,
    );
  }

  /**
   * Send a WiFi command over GATT and wait for the result notification.
   *
   * Subscribes to the WiFi Result characteristic, writes the command to the
   * WiFi Command characteristic, and resolves with the parsed result or
   * rejects on timeout / error.
   */
  private async wifiExchange<T>(
    cmd: Uint8Array,
    parseResult: (data: Uint8Array) => T,
    timeoutMs: number,
  ): Promise<T> {
    if (!this._device) {
      throw new Error("Not connected — cannot perform WiFi operation");
    }
    const device = this._device;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        sub?.remove();
        reject(new Error("WiFi operation timed out"));
      }, timeoutMs);

      const sub = device.monitorCharacteristicForService(
        WIFI_SERVICE_UUID,
        WIFI_RESULT_CHAR_UUID,
        (error: unknown, characteristic: CharacteristicInstance | null) => {
          if (error) {
            clearTimeout(timeout);
            sub?.remove();
            reject(
              new Error(
                `WiFi error: ${error instanceof Error ? error.message : String(error)}`,
              ),
            );
            return;
          }
          if (characteristic?.value) {
            clearTimeout(timeout);
            sub?.remove();
            try {
              const raw = base64ToBytes(characteristic.value);
              resolve(parseResult(raw));
            } catch (err) {
              reject(err instanceof Error ? err : new Error(String(err)));
            }
          }
        },
      );

      const cmdB64 = bytesToBase64(cmd);
      device
        .writeCharacteristicWithResponseForService(
          WIFI_SERVICE_UUID,
          WIFI_COMMAND_CHAR_UUID,
          cmdB64,
        )
        .catch((err: unknown) => {
          clearTimeout(timeout);
          reject(
            new Error(
              `WiFi write failed: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
        });
    });
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the appropriate BLE service for the current platform.
 *
 * - Web → MockBleService (no BLE support in browsers via react-native-ble-plx)
 * - Mobile → RealBleService (uses react-native-ble-plx)
 */
export function createBleService(): BleService {
  if (Platform.OS === "web") {
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
  writeCharacteristicWithResponseForService(
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

interface CommandResponseState {
  resolve: (frame: BleFrame) => void;
  reject: (err: Error) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Decode base64 string to Uint8Array. */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Encode Uint8Array to base64 string. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Parse WiFi scan result bytes into network list. */
function parseWifiScanResult(data: Uint8Array): WifiNetwork[] {
  const networks: WifiNetwork[] = [];
  if (data.length < 2) return networks;
  // data[0] is result type (0x01 = scan), data[1] is network count.
  // Start parsing network entries at offset 2.
  let offset = 2;
  while (offset < data.length) {
    if (offset + 2 > data.length) break;
    const ssidLen = data[offset];
    offset += 1;
    if (offset + ssidLen + 1 > data.length) break;
    const ssid = new TextDecoder().decode(data.slice(offset, offset + ssidLen));
    offset += ssidLen;
    const signalStrength = data[offset];
    offset += 1;
    networks.push({ ssid, signalStrength });
  }
  return networks;
}

/** Parse WiFi status response.
 *
 * nomopractic format: state (u8) | signal (u8) | ssid_len (u8) | ssid bytes
 * State: 0x00=Disconnected, 0x01=Connecting, 0x02=Connected.
 */
function parseWifiStatus(data: Uint8Array): WifiStatus {
  // data[0] is result type (0x03 = status); inner payload starts at index 1.
  // Inner format: state (u8) | signal (u8) | ssid_len (u8) | ssid bytes
  if (data.length < 2) {
    return { connected: false, ssid: null, signalStrength: null };
  }
  const connected = data[1] === WifiState.Connected;
  if (!connected || data.length < 4) {
    return { connected, ssid: null, signalStrength: null };
  }
  const signalStrength = data[2];
  const ssidLen = data[3];
  if (data.length < 4 + ssidLen) {
    return { connected, ssid: null, signalStrength };
  }
  const ssid = new TextDecoder().decode(data.slice(4, 4 + ssidLen));
  return { connected, ssid, signalStrength };
}
