import { useEffect, useState } from 'react'
import { useAuthContext } from '@/context/AuthContext'
import { leerConCache } from '@/lib/offline/cacheLectura'
import { claveOrgNombre, fetchOrgNombre } from '@/lib/offline/orgNombre'

/** Nombre de la organización del usuario, vía la misma entrada de caché que
 * precarga ModulosContext (funciona sin conexión). Si falla, `nombre` es null. */
export function useOrgNombre(activo = true): { nombre: string | null; cargando: boolean } {
  const { user, profile } = useAuthContext()
  const userId = user?.id
  const orgId = profile?.org_id ?? undefined
  const [nombre, setNombre] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!activo || !userId || !orgId) { setNombre(null); setCargando(false); return }
    let cancelado = false
    setCargando(true)
    leerConCache(claveOrgNombre(orgId), userId, orgId, () => fetchOrgNombre(orgId))
      .then(r => { if (!cancelado) setNombre(r.datos) })
      .catch(() => { if (!cancelado) setNombre(null) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [activo, userId, orgId])

  return { nombre, cargando }
}
