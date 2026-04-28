// ────────────────────────────────────────────────────────────
//  ThemeContext — light / dark toggle, persisted in localStorage
//  under `snibble-theme` (matching the apply-on-load script in
//  index.html so reload doesn't flash the wrong theme).
//
//  The class flip happens on <html>, so all `.dark .foo` global
//  overrides in index.css fire correctly.
// ────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'snibble-theme'
const ThemeContext = createContext({ theme: 'light', isDark: false, toggle: () => {} })

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try { localStorage.setItem(STORAGE_KEY, theme) } catch {}
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
