/**
 * Hook that routes commands through BLE or HTTPS based on transport mode.
 *
 * When `body` is provided the HTTPS path sends a POST request; when
 * omitted it sends a GET.  The BLE path always forwards to the
 * transport's `sendCommand`.
 */

import { deviceApi } from "@/lib/api";
import { useOptionalTransport } from "@/lib/transport";

export function useDeviceCommand() {
  const transport = useOptionalTransport();

  return async function sendDeviceCommand<T>(
    endpoint: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    if (transport?.mode === "ble") {
      return transport.sendCommand(endpoint, body ?? {}) as Promise<T>;
    }
    if (body !== undefined) {
      return deviceApi<T>(endpoint, { method: "POST", body });
    }
    return deviceApi<T>(endpoint);
  };
}
