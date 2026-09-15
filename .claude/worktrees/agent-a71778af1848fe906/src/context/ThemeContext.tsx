import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

export type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: Theme
  setTheme: (t: Theme) => void
  cycleTheme: (btn?: HTMLElement) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'mady-theme'

function getSystemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark' : 'light'
}

function applyClass(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
}

type VTDoc = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      if (s === 'light' || s === 'dark') return s
    } catch {}
    return getSystemTheme()
  })

  useEffect(() => { applyClass(theme) }, [theme])

  function setTheme(t: Theme) {
    setThemeState(t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch {}
  }

  function cycleTheme(btn?: HTMLElement) {
    const next: Theme = theme === 'light' ? 'dark' : 'light'

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const vt = document as VTDoc
    if (!btn || prefersReduced || !vt.startViewTransition) {
      setTheme(next)
      return
    }

    const rect = btn.getBoundingClientRect()
    const x = Math.round(rect.left + rect.width / 2)
    const y = Math.round(rect.top + rect.height / 2)
    const r = Math.ceil(
      Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      ),
    )

    const transition = vt.startViewTransition!(() => {
      flushSync(() => { setTheme(next) })
    })

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${r}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 500,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        },
      )
    }).catch(() => {})
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: theme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
