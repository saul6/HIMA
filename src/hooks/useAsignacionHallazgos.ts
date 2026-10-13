import { useCallback, useEffect, useState } from 'react'
import { useAuthContext } from '@/context/AuthContext'
import {
  leerEstado, listarColaboradores, puedeAsignarHallazgos, esModuloAsignable,
  type ColaboradorAsignable, type EstadoAsignacion,
} from '@/lib/hallazgos/asignacion'
import { SYNC_OK_EVENT } from '@/lib/offline/sync'

interface ItemRef { respuesta_id: string; modulo: string }

/**
 * Responsable y fecha límite de los hallazgos listados (lectura vía RPC),
 * más colaboradores asignables. Solo admin_org / super_admin pueden asignar.
 */
export function useAsignacionHallazgos(items: ItemRef[], habilitado = true) {
  const { profile } = useAuthContext()
  const puedeAsignar = puedeAsignarHallazgos(profile?.rol)
  const [estados, setEstados] = useState<Record<string, EstadoAsignacion>>({})
  const [colaboradores, setColaboradores] = useState<ColaboradorAsignable[]>([])
  const [cargandoColab, setCargandoColab] = useState(false)
  const [errorColab, setErrorColab] = useState<string | null>(null)

  // Clave estable para no relanzar la lectura si la lista no cambió
  const clave = items.map(i => `${i.modulo}:${i.respuesta_id}`).sort().join(',')

  const recargarEstados = useCallback(async () => {
    if (!habilitado || !profile?.org_id || !navigator.onLine) return
    const porModulo = new Map<string, string[]>()
    for (const it of items) {
      if (!esModuloAsignable(it.modulo)) continue
      porModulo.set(it.modulo, [...(porModulo.get(it.modulo) ?? []), it.respuesta_id])
    }
    const resultados = await Promise.all([...porModulo].map(async ([modulo, ids]) => {
      const out: Record<string, EstadoAsignacion> = {}
      // Lotes de 200 ids para no exceder el tamaño de la petición
      for (let i = 0; i < ids.length; i += 200) {
        try {
          Object.assign(out, await leerEstado(modulo as never, ids.slice(i, i + 200)))
        } catch (e) {
          console.warn('[useAsignacionHallazgos] leerEstado', modulo, e)
        }
      }
      return out
    }))
    setEstados(Object.assign({}, ...resultados))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habilitado, profile?.org_id, clave])

  useEffect(() => { recargarEstados() }, [recargarEstados])

  useEffect(() => {
    window.addEventListener(SYNC_OK_EVENT, recargarEstados)
    return () => window.removeEventListener(SYNC_OK_EVENT, recargarEstados)
  }, [recargarEstados])

  const cargarColaboradores = useCallback(async () => {
    if (!puedeAsignar) return
    setCargandoColab(true)
    setErrorColab(null)
    try {
      setColaboradores(await listarColaboradores())
    } catch {
      setColaboradores([])
      setErrorColab('No se pudieron cargar los colaboradores.')
    } finally {
      setCargandoColab(false)
    }
  }, [puedeAsignar])

  return { estados, recargarEstados, puedeAsignar, colaboradores, cargandoColab, errorColab, cargarColaboradores }
}
