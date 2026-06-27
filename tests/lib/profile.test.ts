/**
 * Unit tests for central profile API helpers.
 */

import { ApiRequestError } from "@/lib/api";
import { changePassword, getProfile, updateProfile } from "@/lib/profile";

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
global.fetch = mockFetch as unknown as typeof fetch;

function okResponse(body: unknown, status = 200): Partial<Response> {
  return { ok: true, status, json: async () => body };
}

function errorResponse(status: number, error: string): Partial<Response> {
  return { ok: false, status, json: async () => ({ error, timestamp: "t" }) };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("getProfile", () => {
  it("returns the profile", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        email: "a@example.com",
        display_name: "Alice",
        created_at: "2026-01-01T00:00:00+00:00",
        last_login_at: null,
        timestamp: "t",
      }) as Response,
    );
    const profile = await getProfile();
    expect(profile.email).toBe("a@example.com");
    expect(profile.display_name).toBe("Alice");
  });
});

describe("updateProfile", () => {
  it("PATCHes the display name", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        email: "a@example.com",
        display_name: "Bob",
        created_at: "2026-01-01T00:00:00+00:00",
        last_login_at: null,
        timestamp: "t",
      }) as Response,
    );
    const profile = await updateProfile("Bob");
    expect(profile.display_name).toBe("Bob");
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/auth/me");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ display_name: "Bob" });
  });
});

describe("changePassword", () => {
  it("POSTs current and new passwords", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ success: true, timestamp: "t" }) as Response);
    await changePassword("old12345", "new12345");
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/auth/change-password");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      current_password: "old12345",
      new_password: "new12345",
    });
  });

  it("throws ApiRequestError on 401 (wrong current password)", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401, "Current password is incorrect") as Response);
    await expect(changePassword("wrong", "new12345")).rejects.toBeInstanceOf(ApiRequestError);
  });
});
