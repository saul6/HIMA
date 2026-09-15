// Hook de datos del dashboard de inicio.
// Todas las queries filtran por profile.org_id (reforzado además por RLS).

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'

export interface DashboardMetricas {
  appsMes: number
  productosDistintos: number
  diasDesdeUltimaApp: number | null   // null = sin aplicaciones
  superficieHa: number
}

export interface AplicacionReciente {
  id: string
  fecha: string
  productos: string[]
  status: 'borrador' | 'completado'
}

export interface HomeDashboardData {
  orgNombre: string | null
  orgPlan: string | null
  metricas: DashboardMetricas
  recientes: AplicacionReciente[]
  loading: boolean
  error: string | null
}

const METRICAS_VACÍAS: DashboardMetricas = {
  appsMes: 0,
  productosDistintos: 0,
  diasDesdeUltimaApp: null,
  superficieHa: 0,
}

export function useHomeDashboard(): HomeDashboardData {
  const { profile } = useAuthContext()
  const [orgNombre, setOrgNombre] = useState<string | null>(null)
  const [orgPlan, setOrgPlan] = useState<string | null>(null)
  const [metricas, setMetricas] = useState<DashboardMetricas>(METRICAS_VACÍAS)
  const [recientes, setRecientes] = useState<AplicacionReciente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    try {
      const ahora = new Date()
      const year = ahora.getFullYear()
      const mes = String(ahora.getMonth() + 1).padStart(2, '0')
      const inicioMes = `${year}-${mes}-01`
      const inicioSiguienteMes = ahora.getMonth() === 11
        ? `${year + 1}-01-01`
        : `${year}-${String(ahora.getMonth() + 2).padStart(2, '0')}-01`

      const [
        orgRes,
        appsMesRes,
        productosRes,
        ultimaAppRes,
        ranchosRes,
        recientesRes,
      ] = await Promise.all([
        // 1. Nombre y plan de la organización
        supabase
          .from('organizaciones')
          .select('nombre, plan')
          .eq('id', profile.org_id)
          .single(),

        // 2. Aplicaciones en el mes actual
        supabase
          .from('aplicaciones')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', profile.org_id)
          .gte('fecha_aplicacion', inicioMes)
          .lt('fecha_aplicacion', inicioSiguienteMes),

        // 3. Productos distintos usados (deduplicar en JS)
        supabase
          .from('aplicacion_productos')
          .select('producto_id')
          .eq('org_id', profile.org_id),

        // 4. Fecha de la última aplicación
        supabase
          .from('aplicaciones')
          .select('fecha_aplicacion')
          .eq('org_id', profile.org_id)
          .order('fecha_aplicacion', { ascending: false })
          .limit(1),

        // 5. Superficie total de ranchos activos
        supabase
          .from('ranchos')
          .select('superficie_ha')
          .eq('org_id', profile.org_id)
          .eq('activo', true),

        // 6. Últimas 5 aplicaciones con sus productos
        supabase
          .from('aplicaciones')
          .select(`
            id,
            fecha_aplicacion,
            status,
            aplicacion_productos (
              catalogo_productos (
                nombre_comercial
              )
            )
          `)
          .eq('org_id', profile.org_id)
          .order('fecha_aplicacion', { ascending: false })
          .limit(5),
      ])

      // Org name y plan
      setOrgNombre(orgRes.data?.nombre ?? null)
      setOrgPlan((orgRes.data as any)?.plan ?? null)

      // Métricas
      const appsMes = appsMesRes.count ?? 0

      const productosDistintos = new Set(
        (productosRes.data ?? []).map((p) => p.producto_id)
      ).size

      let diasDesdeUltimaApp: number | null = null
      if (ultimaAppRes.data && ultimaAppRes.data.length > 0) {
        const ultima = new Date(ultimaAppRes.data[0].fecha_aplicacion + 'T12:00:00')
        const hoy = new Date()
        hoy.setHours(12, 0, 0, 0)
        diasDesdeUltimaApp = Math.max(
          0,
          Math.round((hoy.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24))
        )
      }

      const superficieHa = (ranchosRes.data ?? []).reduce(
        (sum, r) => sum + (r.superficie_ha ?? 0),
        0
      )

      setMetricas({ appsMes, productosDistintos, diasDesdeUltimaApp, superficieHa })

      // Actividad reciente
      const recientesData: AplicacionReciente[] = ((recientesRes.data ?? []) as any[]).map((app) => {
        const productos: string[] = (app.aplicacion_productos ?? [])
          .map((ap: any) => ap.catalogo_productos?.nombre_comercial)
          .filter(Boolean)
        return {
          id: app.id,
          fecha: app.fecha_aplicacion as string,
          productos,
          status: app.status as 'borrador' | 'completado',
        }
      })
      setRecientes(recientesData)

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { orgNombre, orgPlan, metricas, recientes, loading, error }
}
