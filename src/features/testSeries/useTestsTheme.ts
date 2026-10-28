import { useCallback, useState } from 'react'

export type TestsTheme = 'light' | 'dark'

export const testsThemeStorageKey = 'dexam-tests-theme-v1'

function readStoredTheme(): TestsTheme {
  try {
    return localStorage.getItem(testsThemeStorageKey) === 'dark' ? 'dark' : 'light'
  } catch {
    // Storage can be unavailable (private mode, blocked site data); light is the D-057 default.
    return 'light'
  }
}

/** Light by default (D-057), with a per-device dark preference. */
export function useTestsTheme() {
  const [theme, setTheme] = useState<TestsTheme>(readStoredTheme)

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: TestsTheme = current === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(testsThemeStorageKey, next)
      } catch {
        // Preference is a convenience only; the toggle still works for this visit.
      }
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
