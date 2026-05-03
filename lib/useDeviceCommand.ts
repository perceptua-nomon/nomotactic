/**
 * Hook for sending commands to the device via HTTPS.
 *
 * When `body` is provided the HTTPS path sends a POST request; when
 * omitted it sends a GET.
 */

import { deviceApi } from "@/lib/api";

export function useDeviceCommand() {
  return async function sendDeviceCommand<T>(
    endpoint: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    if (body !== undefined) {
      return deviceApi<T>(endpoint, { method: "POST", body });
    }
    return deviceApi<T>(endpoint);
  };
}
