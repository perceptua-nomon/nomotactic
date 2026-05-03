/**
 * Local device registry — persists HTTP-paired devices across sessions.
 *
 * TODO: Replace the in-memory Map with @react-native-async-storage/async-storage
 *       once that package is added as a dependency. The async API surface is already
 *       correct so the swap will be a single-file change.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocalDevice {
  id: string;
  name: string;
  pairedAt: string;
  vin: string | null;
  source: "local";
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const _store = new Map<string, LocalDevice>();

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function addLocalDevice(device: LocalDevice): Promise<void> {
  _store.set(device.id, device);
}

export async function getLocalDevices(): Promise<LocalDevice[]> {
  return Array.from(_store.values());
}

export async function updateLocalDevice(
  id: string,
  patch: Partial<Omit<LocalDevice, "id" | "source">>,
): Promise<void> {
  const existing = _store.get(id);
  if (existing) {
    _store.set(id, { ...existing, ...patch });
  }
}

export async function removeLocalDevice(id: string): Promise<void> {
  _store.delete(id);
}
