import { WifiOff } from 'lucide-react'
import { Boton } from '@/app/components/ui-mady/Boton'

/** Se muestra cuando no se pudo cargar la lista de módulos: nunca dejar la pantalla en blanco. */
export function ErrorCargaModulos({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-8 py-12 text-center gap-4" role="alert">
      <WifiOff className="w-8 h-8 text-muted-foreground" />
      <div className="space-y-1.5">
        <p className="text-base text-foreground font-semibold">No se pudo cargar</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Revisa tu conexión e inténtalo de nuevo.
        </p>
      </div>
      <Boton onClick={onReintentar}>Reintentar</Boton>
    </div>
  )
}
