import { useState, useEffect, useCallback } from 'react'
import { useAuthContext } from '@/context/AuthContext'
import { obtenerLotes, OUTBOX_CAMBIO_EVENT } from '@/lib/offline/outbox'
import { SYNC_OK_EVENT, SYNC_RECHAZADO_EVENT } from '@/lib/offline/sync'
import type { LoteOutbox } from '@/lib/offline/tipos'

export type { LoteOutbox }

const DIAS_RECIENTES = 7

export function useOutbox(moduloFiltro?: string) {
  const { user } = useAuthContext()
  const [lotes, setLotes] = useState<LoteOutbox[]>([])
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(async () => {
    if (!user?.id) { setLotes([]); setCargando(false); return }
    setCargando(true)
    try {
      const todos = await obtenerLotes(user.id)
      setLotes(todos)
    } catch {
      setLotes([])
    } finally {
      setCargando(false)
    }
  }, [user?.id])

  useEffect(() => {
    recargar()
    const handler = () => recargar()
    window.addEventListener(OUTBOX_CAMBIO_EVENT, handler)
    window.addEventListener(SYNC_OK_EVENT, handler)
    window.addEventListener(SYNC_RECHAZADO_EVENT, handler)
    return () => {
      window.removeEventListener(OUTBOX_CAMBIO_EVENT, handler)
      window.removeEventListener(SYNC_OK_EVENT, handler)
      window.removeEventListener(SYNC_RECHAZADO_EVENT, handler)
    }
  }, [recargar])

  const filtrados = moduloFiltro ? lotes.filter(l => l.modulo === moduloFiltro) : lotes
  const pendientes = filtrados.filter(l => l.estado === 'pendiente')
  const rechazados = filtrados.filter(l => l.estado === 'rechazado')
  const ahora = Date.now()
  const sincronizados = filtrados.filter(l => {
    if (l.estado !== 'sincronizado' || !l.sincronizadoEn) return false
    return ahora - new Date(l.sincronizadoEn).getTime() < DIAS_RECIENTES * 86400_000
  })
  const totalPendientes = lotes.filter(l => l.estado === 'pendiente').length

  return {
    lotes: filtrados,
    pendientes,
    rechazados,
    sincronizados,
    totalPendientes,
    cargando,
    recargar,
  }
}
