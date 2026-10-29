/** Signup step selection follows BE utils/kuEmail.ts; the server owns userType. */
export function isKuEmail(email: string): boolean {
  const at = email.lastIndexOf('@')
  return at !== -1 && email.slice(at + 1).trim().toLowerCase() === 'ku.th'
}
