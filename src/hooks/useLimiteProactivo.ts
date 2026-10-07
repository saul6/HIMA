import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useOutbox } from '@/hooks/useOutbox'

interface OpcionesLimite {
  // ID del módulo para buscar en la outbox
  modulo: string
  // Si es null, no aplica validación (rancho no seleccionado)
  orgId: string | null
  ranchoId: string | null
  // Fecha de referencia (normalmente hoy)
  fecha: string
  // true = ventana de 7 días (semanal), false = sin limit (no aplica)
  activo: boolean
  // Tabla donde buscar registros del servidor
  tabla: string
  // Columnas de filtro del servidor: { org_id, rancho_id, campo_fecha }
  campoFecha: string
  // Días de la ventana de exclusión (7 = semanal, 14 = quincenal)
  ventanaDias: number
  // Si el sheet está abierto (para no consultar en segundo plano)
  sheetAbierto: boolean
}

interface ResultadoLimite {
  // null = no hay límite; { proxima } = hay registro en la ventana
  limiteInfo: { proxima: string } | null
  // true = hay un lote offline que conflictúa dentro de la ventana
  hayConflictoOffline: boolean
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

export function useLimiteProactivo({
  modulo,
  orgId,
  ranchoId,
  fecha,
  activo,
  tabla,
  campoFecha,
  ventanaDias,
  sheetAbierto,
}: OpcionesLimite): ResultadoLimite {
  const [limiteInfo, setLimiteInfo] = useState<{ proxima: string } | null>(null)
  const { lotes } = useOutbox(modulo)

  // Verificar conflicto en lotes offline
  const hayConflictoOffline = (() => {
    if (!ranchoId || !sheetAbierto || !activo) return false
    const fechaRef = new Date(fecha + 'T12:00:00')
    const inicio = new Date(fechaRef)
    inicio.setDate(inicio.getDate() - (ventanaDias - 1))
    return lotes.some(l => {
      if (l.estado === 'sincronizado') return false
      const meta = l.metadatos as { rancho_id?: string; fecha?: string } | undefined
      if (meta?.rancho_id !== ranchoId) return false
      if (!meta?.fecha) return false
      const lf = new Date(meta.fecha + 'T12:00:00')
      return lf >= inicio && lf <= fechaRef
    })
  })()

  // Verificar límite en el servidor
  useEffect(() => {
    if (!sheetAbierto || !ranchoId || !fecha || !orgId || !activo) {
      setLimiteInfo(null)
      return
    }
    let cancelado = false
    const fechaDate = new Date(fecha + 'T12:00:00')
    const inicio = new Date(fechaDate)
    inicio.setDate(inicio.getDate() - (ventanaDias - 1))
    const inicioStr = inicio.toISOString().split('T')[0]

    ;(supabase as any)
      .from(tabla)
      .select(campoFecha)
      .eq('org_id', orgId)
      .eq('rancho_id', ranchoId)
      .gte(campoFecha, inicioStr)
      .lte(campoFecha, fecha)
      .order(campoFecha, { ascending: false })
      .limit(1)
      .then(({ data }: { data: any[] | null }) => {
        if (cancelado) return
        if (data && data.length > 0) {
          const ultimaDate = new Date(data[0][campoFecha] + 'T12:00:00')
          const proximaDate = new Date(ultimaDate)
          proximaDate.setDate(proximaDate.getDate() + ventanaDias)
          setLimiteInfo({ proxima: formatFecha(proximaDate.toISOString().split('T')[0]) })
        } else {
          setLimiteInfo(null)
        }
      })
    return () => { cancelado = true }
  }, [sheetAbierto, ranchoId, fecha, orgId, activo, tabla, campoFecha, ventanaDias])

  return { limiteInfo, hayConflictoOffline }
}
