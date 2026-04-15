/**
 * Transport layer — routes commands to HTTPS or BLE based on connectivity.
 *
 * Manages the BLE connection lifecycle alongside HTTPS, provides WiFi
 * provisioning flow, and exposes a unified `sendCommand()` for components.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { deviceApi } from "@/lib/api";
import type { BleService } from "@/lib/ble";
import { createBleService } from "@/lib/ble";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Active transport method. */
export type TransportMode = "https" | "ble" | "disconnected";

/** Full transport state exposed to consumers. */
export interface TransportState {
  mode: TransportMode;
  isConnected: boolean;
  deviceId: string | null;
  bleService: BleService | null;
  wifiAvailable: boolean;
}

/** Context value with state + actions. */
interface TransportContextValue extends TransportState {
  /** Connect via BLE: pair → check WiFi → provision if available → switch. */
  connectViaBle: (deviceId: string, secret: string) => Promise<void>;

  /** Disconnect from the current device. */
  disconnectDevice: () => Promise<void>;

  /**
   * Send a command, routing to HTTPS or BLE based on current transport mode.
   *
   * For HTTPS: `method` is the API path (e.g. "/api/drive"), `params` is the body.
   * For BLE: `method` is mapped to a BLE command method name.
   */
  sendCommand: (method: string, params: Record<string, unknown>) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const TransportContext = createContext<TransportContextValue | null>(null);

/**
 * Hook to access the transport context. Must be used within a TransportProvider.
 */
export function useTransport(): TransportContextValue {
  const ctx = useContext(TransportContext);
  if (ctx === null) {
    throw new Error("useTransport must be used within a TransportProvider");
  }
  return ctx;
}

/**
 * Hook that returns transport context or null when not inside a TransportProvider.
 * Safe for components that may render with or without a provider.
 */
export function useOptionalTransport(): TransportContextValue | null {
  return useContext(TransportContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface TransportProviderProps {
  children: React.ReactNode;
}

export function TransportProvider({ children }: TransportProviderProps) {
  const [mode, setMode] = useState<TransportMode>("https");
  const [isConnected, setIsConnected] = useState(true);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [wifiAvailable, setWifiAvailable] = useState(false);
  const bleServiceRef = useRef<BleService | null>(null);

  const connectViaBle = useCallback(
    async (targetDeviceId: string, secret: string) => {
      const ble = bleServiceRef.current ?? createBleService();
      bleServiceRef.current = ble;

      // Register disconnect handler
      ble.onStatusChange((status) => {
        if (status === "disconnected") {
          setMode("disconnected");
          setIsConnected(false);
        }
      });

      // Connect and pair
      await ble.connect(targetDeviceId);
      await ble.pair(secret);
      setDeviceId(targetDeviceId);

      // Check WiFi availability — try to provision
      try {
        const wifiStatus = await ble.getWifiStatus();
        if (wifiStatus.connected) {
          // Device already has WiFi — switch to HTTPS
          setWifiAvailable(true);
          setMode("https");
          setIsConnected(true);
          return;
        }
      } catch {
        // WiFi status check failed — stay on BLE
      }

      setWifiAvailable(false);
      setMode("ble");
      setIsConnected(true);
    },
    [],
  );

  const disconnectDevice = useCallback(async () => {
    if (bleServiceRef.current) {
      await bleServiceRef.current.disconnect();
    }
    setMode("disconnected");
    setIsConnected(false);
    setDeviceId(null);
    setWifiAvailable(false);
  }, []);

  const sendCommand = useCallback(
    async (
      method: string,
      params: Record<string, unknown>,
    ): Promise<unknown> => {
      if (mode === "ble" && bleServiceRef.current) {
        return sendViaBle(bleServiceRef.current, method, params);
      }
      // Default: HTTPS
      return deviceApi(method, {
        method: "POST",
        body: params,
      });
    },
    [mode],
  );

  const contextValue = useMemo<TransportContextValue>(
    () => ({
      mode,
      isConnected,
      deviceId,
      bleService: bleServiceRef.current,
      wifiAvailable,
      connectViaBle,
      disconnectDevice,
      sendCommand,
    }),
    [mode, isConnected, deviceId, wifiAvailable, connectViaBle, disconnectDevice, sendCommand],
  );

  return (
    <TransportContext.Provider value={contextValue}>
      {children}
    </TransportContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// BLE command routing
// ---------------------------------------------------------------------------

/** Map REST-style method paths to BLE service calls. */
async function sendViaBle(
  ble: BleService,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  switch (method) {
    case "/api/drive":
      await ble.drive(
        params.speed_pct as number,
        (params.ttl_ms as number) ?? 500,
      );
      return { ok: true };

    case "/api/steer":
      await ble.steer(
        params.angle_deg as number,
        (params.ttl_ms as number) ?? 500,
      );
      return { ok: true };

    case "/api/hat/motor/stop":
      await ble.stopAllMotors();
      return { ok: true };

    case "/api/hat/battery":
      return ble.getBattery();

    case "/api/sensor/ultrasonic":
      return ble.readUltrasonic();

    case "/api/sensor/grayscale": {
      const result = await ble.readGrayscale();
      return {
        channels: [0, 1, 2],
        values: result.values,
        timestamp: new Date().toISOString(),
      };
    }

    case "/api/hat/motor/speed": {
      await ble.setMotorSpeed(
        params.channel as number,
        params.speed_pct as number,
        (params.ttl_ms as number) ?? 500,
      );
      return { ok: true };
    }

    case "/api/hat/servo/angle": {
      await ble.setServoAngle(
        params.channel as number,
        params.angle_deg as number,
        (params.ttl_ms as number) ?? 500,
      );
      return { ok: true };
    }

    default:
      throw new Error(
        `BLE transport does not support method: ${method}`,
      );
  }
}
