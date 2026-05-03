/**
 * Transport layer — routes commands to HTTPS or BLE based on connectivity.
 *
 * Manages the BLE connection lifecycle alongside HTTPS, provides WiFi
 * provisioning flow, and exposes a unified `sendCommand()` for components.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { deviceApi } from "@/lib/api";
import type { BleService } from "@/lib/ble";
import { clearBleSession, createBleService, getBleSession } from "@/lib/ble";
import { ENDPOINTS } from "@/lib/endpoints";

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
}

/** Context value with state + actions. */
interface TransportContextValue extends TransportState {
  /** Connect via BLE: OS passkey pairing → authenticate → check WiFi. */
  connectViaBle: (deviceId: string) => Promise<void>;

  /** Disconnect from the current device. */
  disconnectDevice: () => Promise<void>;

  /**
   * Send a command, routing to HTTPS or BLE based on current transport mode.
   *
   * For HTTPS: `method` is the API path (e.g. "/api/drive"), `params` is the body.
   * For BLE: `method` is mapped to a BLE command method name.
   */
  sendCommand: (method: string, params: Record<string, unknown>) => Promise<unknown>;

  /**
   * Activate a BLE session from the registry for the given device.
   * Called by the device detail page on mount to reconnect without re-pairing.
   */
  activateSession: (deviceId: string) => Promise<void>;
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
  const bleServiceRef = useRef<BleService | null>(null);
  const activeDeviceIdRef = useRef<string | null>(null);
  const bleStatusUnsubRef = useRef<(() => void) | null>(null);

  const connectViaBle = useCallback(
    async (targetDeviceId: string) => {
      const ble = bleServiceRef.current ?? createBleService();
      bleServiceRef.current = ble;
      activeDeviceIdRef.current = targetDeviceId;

      // Register disconnect handler — cancel any previous subscription first
      bleStatusUnsubRef.current?.();
      bleStatusUnsubRef.current = ble.onStatusChange((status) => {
        if (status === "disconnected") {
          setMode("disconnected");
          setIsConnected(false);
        }
      });

      // Connect — OS handles passkey pairing
      await ble.connect(targetDeviceId);

      // Authenticate to get JWT
      await ble.authenticate();
      setDeviceId(targetDeviceId);

      // Check WiFi availability — try to provision
      try {
        const wifiStatus = await ble.getWifiStatus();
        if (wifiStatus.state === "connected") {
          // Device already has WiFi — switch to HTTPS
          setMode("https");
          setIsConnected(true);
          return;
        }
      } catch {
        // WiFi status check failed — stay on BLE
      }

      setMode("ble");
      setIsConnected(true);
    },
    [],
  );

  const disconnectDevice = useCallback(async () => {
    bleStatusUnsubRef.current?.();
    bleStatusUnsubRef.current = null;
    if (bleServiceRef.current) {
      await bleServiceRef.current.disconnect();
      bleServiceRef.current = null;
    }
    if (activeDeviceIdRef.current) {
      clearBleSession(activeDeviceIdRef.current);
      activeDeviceIdRef.current = null;
    }
    setMode("disconnected");
    setIsConnected(false);
    setDeviceId(null);
  }, []);

  const activateSession = useCallback(async (targetDeviceId: string): Promise<void> => {
    const ble = getBleSession(targetDeviceId);
    if (!ble) return;

    bleServiceRef.current = ble;
    activeDeviceIdRef.current = targetDeviceId;

    // Cancel any previous subscription before registering
    bleStatusUnsubRef.current?.();
    bleStatusUnsubRef.current = ble.onStatusChange((status) => {
      if (status === "disconnected") {
        setMode("disconnected");
        setIsConnected(false);
      }
    });

    setDeviceId(targetDeviceId);

    try {
      const wifiStatus = await ble.getWifiStatus();
      if (wifiStatus.state === "connected") {
        setMode("https");
        setIsConnected(true);
        return;
      }
    } catch {
      // WiFi status check failed — stay on BLE
    }

    setMode("ble");
    setIsConnected(true);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        void disconnectDevice();
      }
    });
    return () => subscription.remove();
  }, [disconnectDevice]);

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
      connectViaBle,
      disconnectDevice,
      sendCommand,
      activateSession,
    }),
    [mode, isConnected, deviceId, connectViaBle, disconnectDevice, sendCommand, activateSession],
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
    case ENDPOINTS.DRIVE:
      await ble.drive(
        params.speed_pct as number,
        (params.ttl_ms as number) ?? 500,
      );
      return { ok: true };

    case ENDPOINTS.STEER:
      await ble.steer(
        params.angle_deg as number,
        (params.ttl_ms as number) ?? 500,
      );
      return { ok: true };

    case ENDPOINTS.MOTOR_STOP:
      await ble.stopAllMotors();
      return { ok: true };

    case ENDPOINTS.BATTERY:
      return ble.getBattery();

    case ENDPOINTS.ULTRASONIC:
      return ble.readUltrasonic();

    case ENDPOINTS.GRAYSCALE: {
      const result = await ble.readGrayscale();
      return {
        channels: [0, 1, 2],
        values: result.values,
        timestamp: new Date().toISOString(),
      };
    }

    case ENDPOINTS.MOTOR_SPEED: {
      await ble.setMotorSpeed(
        params.channel as number,
        params.speed_pct as number,
        (params.ttl_ms as number) ?? 500,
      );
      return { ok: true };
    }

    case ENDPOINTS.SERVO_ANGLE: {
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
