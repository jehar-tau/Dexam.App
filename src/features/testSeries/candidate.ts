/** The Member ID behind a student session's synthetic email, or null for any other account. */
export function memberIdFromEmail(email: string | undefined): string | null {
  if (!email) return null
  const [local, domain] = email.split('@')
  return domain === 'members.dexam.invalid' && local ? local.toUpperCase() : null
}
