export function safeSecurityReturn(value: string | null) {
  if (!value || !value.startsWith('/staff/') || /[\\\r\n]/.test(value)) {
    return '/staff/notifications'
  }
  const url = new URL(value, 'https://dexam.invalid')
  if (
    !url.pathname.startsWith('/staff/') ||
    url.pathname.startsWith('/staff/sign-in') ||
    url.pathname === '/staff/security'
  ) {
    return '/staff/notifications'
  }
  return `${url.pathname}${url.search}`
}
