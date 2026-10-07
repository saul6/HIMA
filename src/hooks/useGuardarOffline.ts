import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { encolarLote } from '@/lib/offline/outbox'
import type { OperacionSync, AdjuntoOutbox } from '@/lib/offline/tipos'

interface GuardarOpts {
  descripcion: string
  metadatos?: Record<string, unknown>
  operaciones: OperacionSync[]
  adjuntos?: Omit<AdjuntoOutbox, 'loteId'>[]
}

// Hook que encola un lote en el outbox y muestra el toast correcto.
// Con red: "Guardado". Sin red: "Guardado sin conexión — se subirá al recuperar señal".
export function useGuardarOffline(modulo: string) {
  const { user, profile } = useAuthContext()
  const [guardando, setGuardando] = useState(false)

  const guardar = useCallback(async (opts: GuardarOpts): Promise<boolean> => {
    if (!user?.id || !profile?.org_id) {
      toast.error('Sin organización activa')
      return false
    }
    setGuardando(true)
    try {
      await encolarLote({
        userId: user.id,
        orgId: profile.org_id,
        modulo,
        descripcion: opts.descripcion,
        metadatos: opts.metadatos,
        operaciones: opts.operaciones,
        adjuntos: opts.adjuntos,
      })
      if (navigator.onLine) {
        toast.success('Guardado')
      } else {
        toast.success('Guardado sin conexión — se subirá al recuperar señal')
      }
      return true
    } catch {
      toast.error('No se pudo guardar el registro')
      return false
    } finally {
      setGuardando(false)
    }
  }, [user?.id, profile?.org_id, modulo])

  return { guardar, guardando }
}
