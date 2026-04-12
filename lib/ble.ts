/**
 * Bluetooth Low Energy abstraction layer.
 *
 * Provides a clean interface for BLE communication with nomon devices.
 * Currently ships with a mock implementation; swap in a real BLE library
 * (e.g. react-native-ble-plx) when hardware integration begins.
 */

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

/** Abstract BLE service contract. */
export interface BleService {
  /** Scan for nearby nomon devices. Resolves with discovered peripherals. */
  scan(timeoutMs?: number): Promise<BleDevice[]>;

  /** Connect to a specific device by ID. */
  connect(deviceId: string): Promise<void>;

  /** Disconnect from the currently connected device. */
  disconnect(): Promise<void>;

  /** Send a UTF-8 command string to the connected device. */
  sendCommand(command: string): Promise<string>;

  /** Register a listener for connection status changes. Returns unsubscribe fn. */
  onStatusChange(listener: StatusListener): () => void;

  /** Current connection status. */
  readonly status: ConnectionStatus;
}

// ---------------------------------------------------------------------------
// Mock implementation (development / web)
// ---------------------------------------------------------------------------

const MOCK_DEVICES: BleDevice[] = [
  { id: "nomon-0001", name: "nomon-alpha", rssi: -42 },
  { id: "nomon-0002", name: "nomon-beta", rssi: -68 },
];

export class MockBleService implements BleService {
  private _status: ConnectionStatus = "disconnected";
  private _listeners: Set<StatusListener> = new Set();
  private _connectedId: string | null = null;

  get status(): ConnectionStatus {
    return this._status;
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
    this._setStatus("disconnected");
  }

  async sendCommand(command: string): Promise<string> {
    if (this._status !== "connected" || !this._connectedId) {
      throw new Error("Not connected to a device");
    }
    await delay(200);
    return JSON.stringify({ ok: true, echo: command });
  }

  onStatusChange(listener: StatusListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _setStatus(next: ConnectionStatus): void {
    this._status = next;
    for (const listener of this._listeners) {
      listener(next);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the appropriate BLE service for the current platform.
 * Returns MockBleService until a real BLE library is integrated.
 */
export function createBleService(): BleService {
  return new MockBleService();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
