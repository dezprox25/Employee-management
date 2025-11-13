import { isValidAdminCredentials } from "@/lib/admin/credentials"

describe("isValidAdminCredentials", () => {
  it("accepts the default admin credentials", () => {
    expect(isValidAdminCredentials("admin@gmail.com", "admin123")).toBe(true)
  })
  it("rejects incorrect credentials", () => {
    expect(isValidAdminCredentials("admin@gmail.com", "wrong")).toBe(false)
    expect(isValidAdminCredentials("user@example.com", "admin123")).toBe(false)
  })
})