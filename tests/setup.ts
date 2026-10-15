// Loaded before every test file (vitest.config.ts setupFiles).
import { vi } from "vitest"

process.env.SECRET_COOKIE_PASSWORD = "test-secret-test-secret-test-secret"
process.env.DM_USERNAME = "HostDM"
process.env.DM_PASSWORD = "host-dm-password"
delete process.env.REGISTRATION_SECRET

/** What next/headers' cookies() and headers() return inside route handlers under test. */
export const requestContext = {
  cookies: new Map<string, string>(),
  headers: new Headers(),
}

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      requestContext.cookies.has(name) ? { name, value: requestContext.cookies.get(name)! } : undefined,
    set: (name: string, value: string) => void requestContext.cookies.set(name, value),
    delete: (name: string) => void requestContext.cookies.delete(name),
  }),
  headers: async () => requestContext.headers,
}))
