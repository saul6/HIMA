import { Toaster } from 'sonner'
import { Check } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

/** Avisos de la app (sonner) con la paleta de marca. Los colores y la palomita viven en theme.css
 * (`.mady-toast`, `.mady-palomita`). El aviso de éxito lleva la palomita menta animada. */
export function AvisosToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      position="top-center"
      theme={resolvedTheme}
      icons={{ success: <Check className="mady-palomita" size={16} strokeWidth={3} aria-hidden="true" /> }}
      toastOptions={{ classNames: { toast: 'mady-toast' } }}
    />
  )
}
