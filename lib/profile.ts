/**
 * Central user-profile API helpers.
 *
 * Typed wrappers over the central-mode auth profile endpoints: fetch profile,
 * update display name, and change password.
 */

import { centralApi } from "@/lib/api";

/** User profile (GET /api/auth/me). */
export interface Profile {
  email: string;
  display_name: string;
  created_at: string;
  last_login_at: string | null;
  timestamp: string;
}

/** Fetch the authenticated user's profile. */
export async function getProfile(): Promise<Profile> {
  return centralApi<Profile>("/api/auth/me");
}

/** Update the authenticated user's display name. */
export async function updateProfile(displayName: string): Promise<Profile> {
  return centralApi<Profile>("/api/auth/me", {
    method: "PATCH",
    body: { display_name: displayName },
  });
}

/** Change the authenticated user's password (revokes other sessions). */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await centralApi("/api/auth/change-password", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}
