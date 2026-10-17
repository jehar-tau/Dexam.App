export function safeSecurityReturn(value: string | null) {
  if (!value || !/^\/(staff|teacher|admin)(\/|\?|$)/.test(value) || /[\\\r\n\t]/.test(value)) {
    return '/staff/notifications'
  }
  const url = new URL(value, 'https://dexam.invalid')
  if (
    url.origin !== 'https://dexam.invalid' ||
    /%|\\/.test(url.pathname) ||
    !/^\/(staff|teacher|admin)(\/|$)/.test(url.pathname) ||
    /^\/(staff|teacher|admin)\/sign-in/.test(url.pathname) ||
    /^\/(staff|teacher|admin)\/security$/.test(url.pathname)
  ) {
    return '/staff/notifications'
  }
  return `${url.pathname}${url.search}`
}
