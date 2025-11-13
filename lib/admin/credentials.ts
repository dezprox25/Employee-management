export function isValidAdminCredentials(email: string, password: string) {
  return email.toLowerCase() === "admin@gmail.com" && password === "admin123"
}