/**
 * Authentication context and provider.
 *
 * Manages login, registration, logout, and automatic token refresh.
 * Handles both central-mode auth and device-mode pairing.
 * Stores tokens in expo-secure-store on mobile and localStorage on web.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { centralApi, deviceApi, setDeviceTokenAccessors, setTokenAccessors } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface UserProfile {
  email: string;
  display_name: string;
  created_at: string;
  last_login_at: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  deviceAccessToken: string | null;
  deviceRefreshToken: string | null;
  isDevicePaired: boolean;
  isGuest: boolean;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  pairWithDevice: (secret: string, displayName: string) => Promise<void>;
  unpairDevice: () => Promise<void>;
  refreshDeviceToken: () => Promise<boolean>;
  continueAsGuest: () => void;
}

// ---------------------------------------------------------------------------
// Secure storage abstraction
// ---------------------------------------------------------------------------

const STORAGE_KEY_ACCESS = "nomon_access_token";
const STORAGE_KEY_REFRESH = "nomon_refresh_token";
const STORAGE_KEY_DEVICE_ACCESS = "nomon_device_access_token";
const STORAGE_KEY_DEVICE_REFRESH = "nomon_device_refresh_token";

const storage = {
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        localStorage.setItem(key, value);
      } catch {
        // localStorage unavailable (e.g. private browsing quota exceeded)
      }
    } else {
      const SecureStore = await import("expo-secure-store");
      await SecureStore.setItemAsync(key, value);
    }
  },
  async get(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    const SecureStore = await import("expo-secure-store");
    return SecureStore.getItemAsync(key);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        localStorage.removeItem(key);
      } catch {
        // noop
      }
    } else {
      const SecureStore = await import("expo-secure-store");
      await SecureStore.deleteItemAsync(key);
    }
  },
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Hook to access the auth context. Must be used within an AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    accessToken: null,
    refreshToken: null,
    user: null,
    isLoading: true,
    deviceAccessToken: null,
    deviceRefreshToken: null,
    isDevicePaired: false,
    isGuest: false,
  });

  // Restore tokens from storage on mount
  useEffect(() => {
    (async () => {
      const access = await storage.get(STORAGE_KEY_ACCESS);
      const refresh = await storage.get(STORAGE_KEY_REFRESH);
      const deviceAccess = await storage.get(STORAGE_KEY_DEVICE_ACCESS);
      const deviceRefresh = await storage.get(STORAGE_KEY_DEVICE_REFRESH);
      setState((prev) => ({
        ...prev,
        accessToken: access,
        refreshToken: refresh,
        deviceAccessToken: deviceAccess,
        deviceRefreshToken: deviceRefresh,
        isDevicePaired: deviceAccess !== null,
        isLoading: false,
      }));
    })();
  }, []);

  async function persistTokens(tokens: TokenResponse): Promise<void> {
    await storage.set(STORAGE_KEY_ACCESS, tokens.access_token);
    await storage.set(STORAGE_KEY_REFRESH, tokens.refresh_token);
    setState((prev) => ({
      ...prev,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    }));
  }

  async function persistDeviceTokens(tokens: TokenResponse): Promise<void> {
    await storage.set(STORAGE_KEY_DEVICE_ACCESS, tokens.access_token);
    await storage.set(STORAGE_KEY_DEVICE_REFRESH, tokens.refresh_token);
    setState((prev) => ({
      ...prev,
      deviceAccessToken: tokens.access_token,
      deviceRefreshToken: tokens.refresh_token,
      isDevicePaired: true,
    }));
  }

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const tokens = await centralApi<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await persistTokens(tokens);
  }, []);

  const register = useCallback(async (
    email: string,
    password: string,
    displayName: string,
  ): Promise<void> => {
    const resp = await centralApi<TokenResponse & { user: UserProfile }>(
      "/api/auth/register",
      {
        method: "POST",
        body: { email, password, display_name: displayName },
      },
    );
    await persistTokens(resp);
    setState((prev) => ({ ...prev, user: resp.user }));
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    // Best-effort server-side token revocation
    if (state.refreshToken) {
      try {
        await centralApi("/api/auth/logout", {
          method: "POST",
          body: { refresh_token: state.refreshToken },
        });
      } catch {
        // Server unreachable — continue with local cleanup
      }
    }
    await storage.remove(STORAGE_KEY_ACCESS);
    await storage.remove(STORAGE_KEY_REFRESH);
    setState((prev) => ({
      ...prev,
      accessToken: null,
      refreshToken: null,
      user: null,
      isGuest: false,
      isLoading: false,
    }));
  }, [state.refreshToken]);

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    if (!state.refreshToken) return false;
    try {
      const tokens = await centralApi<TokenResponse>("/api/auth/refresh", {
        method: "POST",
        body: { refresh_token: state.refreshToken },
      });
      await persistTokens(tokens);
      return true;
    } catch {
      await logout();
      return false;
    }
  }, [state.refreshToken, logout]);

  const unpairDevice = useCallback(async (): Promise<void> => {
    await storage.remove(STORAGE_KEY_DEVICE_ACCESS);
    await storage.remove(STORAGE_KEY_DEVICE_REFRESH);
    setState((prev) => ({
      ...prev,
      deviceAccessToken: null,
      deviceRefreshToken: null,
      isDevicePaired: false,
    }));
  }, []);

  const refreshDeviceToken = useCallback(async (): Promise<boolean> => {
    if (!state.deviceRefreshToken) return false;
    try {
      const tokens = await deviceApi<TokenResponse>("/api/device/auth/refresh", {
        method: "POST",
        body: { refresh_token: state.deviceRefreshToken },
      });
      await persistDeviceTokens(tokens);
      return true;
    } catch {
      await unpairDevice();
      return false;
    }
  }, [state.deviceRefreshToken, unpairDevice]);

  const pairWithDevice = useCallback(
    async (secret: string, displayName: string): Promise<void> => {
      const tokens = await deviceApi<TokenResponse>("/api/device/auth/pair", {
        method: "POST",
        body: { secret, display_name: displayName },
      });
      await persistDeviceTokens(tokens);
    },
    [],
  );

  const continueAsGuest = useCallback((): void => {
    setState((prev) => ({ ...prev, isGuest: true }));
  }, []);

  // Wire central API client token access
  useEffect(() => {
    setTokenAccessors(
      () => state.accessToken,
      async () => {
        try {
          return await refreshAccessToken();
        } catch {
          return false;
        }
      },
    );
  }, [state.accessToken, state.refreshToken, refreshAccessToken]);

  // Wire device API client token access
  useEffect(() => {
    setDeviceTokenAccessors(
      () => state.deviceAccessToken,
      async () => {
        try {
          return await refreshDeviceToken();
        } catch {
          return false;
        }
      },
    );
  }, [state.deviceAccessToken, state.deviceRefreshToken, refreshDeviceToken]);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: state.accessToken !== null,
      login,
      register,
      logout,
      refreshAccessToken,
      pairWithDevice,
      unpairDevice,
      refreshDeviceToken,
      continueAsGuest,
    }),
    [state, login, register, logout, refreshAccessToken, pairWithDevice, unpairDevice, refreshDeviceToken, continueAsGuest],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
