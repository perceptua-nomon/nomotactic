/**
 * Transport layer — routes commands to the device via HTTPS.
 *
 * Provides a unified `sendCommand()` for components and manages the
 * active device connection state.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import { deviceApi } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Active transport method. */
export type TransportMode = "https" | "disconnected";

/** Full transport state exposed to consumers. */
export interface TransportState {
  mode: TransportMode;
  isConnected: boolean;
  deviceId: string | null;
}

/** Context value with state + actions. */
interface TransportContextValue extends TransportState {
  /** Disconnect from the current device. */
  disconnectDevice: () => void;

  /**
   * Send a command to the device via HTTPS.
   *
   * `method` is the API path (e.g. "/api/drive"), `params` is the request body.
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
  const [mode] = useState<TransportMode>("https");
  const [isConnected] = useState(true);
  const [deviceId] = useState<string | null>(null);

  const disconnectDevice = useCallback(() => {
    // No-op for HTTPS — device connectivity is managed by the network layer.
  }, []);

  const sendCommand = useCallback(
    async (
      method: string,
      params: Record<string, unknown>,
    ): Promise<unknown> => {
      return deviceApi(method, {
        method: "POST",
        body: params,
      });
    },
    [],
  );

  const contextValue = useMemo<TransportContextValue>(
    () => ({
      mode,
      isConnected,
      deviceId,
      disconnectDevice,
      sendCommand,
    }),
    [mode, isConnected, deviceId, disconnectDevice, sendCommand],
  );

  return (
    <TransportContext.Provider value={contextValue}>
      {children}
    </TransportContext.Provider>
  );
}

