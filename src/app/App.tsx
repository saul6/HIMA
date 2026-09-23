import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { router } from './routes'
import { AuthProvider } from '@/context/AuthContext'
import { ModulosProvider } from '@/context/ModulosContext'
import { HomeSearchProvider } from '@/context/HomeSearchContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { IntroTransitionProvider } from '@/context/IntroTransitionContext'

export default function App() {
  // Limpia el navy inline que theme-init.js pinta en <html> antes de montar
  // (solo en rutas de auth, ver public/theme-init.js) — una vez React montó,
  // el fondo normal de cada pantalla (body/tarjeta) ya manda.
  useEffect(() => {
    document.documentElement.style.background = ''
  }, [])

  return (
    <ThemeProvider>
      <AuthProvider>
        <ModulosProvider>
          <HomeSearchProvider>
            <IntroTransitionProvider>
              <RouterProvider router={router} />
            </IntroTransitionProvider>
            <Toaster position="top-center" richColors />
          </HomeSearchProvider>
        </ModulosProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
