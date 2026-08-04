import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import type { AccionCorrectiva, AccionCorrectivaFoto } from '@/types/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

const MODULOS_NC: Array<{ tabla: string; modulo: string; label: string }> = [
  { tabla: 'm14_respuestas', modulo: 'm14', label: 'SAIA' },
  { tabla: 'm15_respuestas', modulo: 'm15', label: 'Granja' },
  { tabla: 'm16_respuestas', modulo: 'm16', label: 'Cuadrilla' },
  { tabla: 'm17_respuestas', modulo: 'm17', label: "BPM's" },
  { tabla: 'm18_respuestas', modulo: 'm18', label: 'HACCP' },
]

export interface AccionCorrectivaConFotos extends AccionCorrectiva {
  fotos: AccionCorrectivaFoto[]
}

export interface NcBandejaItem {
  respuesta_id: string
  modulo: string
  modulo_label: string
  codigo_pregunta: string
  seccion: string
  texto_pregunta: string
  comentario_respuesta: string | null
  rancho_id: string
  rancho_nombre: string
  fecha_auditoria: string
  visita_id: string | null
  accion: AccionCorrectivaConFotos | null
  estado: 'sin_capturar' | 'abierta' | 'cerrada'
}

export function useAccionesCorrectivas() {
  const { profile } = useAuthContext()
  const [items, setItems] = useState<NcBandejaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!profile?.org_id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const [ncResults, accionesResult] = await Promise.all([
        Promise.all(
          MODULOS_NC.map(async ({ tabla, modulo, label }) => {
            const { data, error: err } = await tbl(tabla)
              .select(`
                id, comentario,
                ${modulo}_preguntas!pregunta_id(codigo, texto, ${modulo}_secciones!seccion_id(nombre)),
                ${modulo}_auditorias!auditoria_id(rancho_id, fecha, visita_id, ranchos!rancho_id(nombre))
              `)
              .eq('org_id', profile.org_id)
              .eq('respuesta', 'no_cumple')
              .order('created_at', { ascending: false })
              .limit(500)
            if (err) { console.warn(`useAccionesCorrectivas: error en ${tabla}`, err); return [] }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return ((data ?? []) as any[]).map((r: any) => {
              const pregunta = r[`${modulo}_preguntas`] ?? {}
              const seccionObj = pregunta[`${modulo}_secciones`] ?? {}
              const auditoria = r[`${modulo}_auditorias`] ?? {}
              const rancho = auditoria.ranchos ?? {}
              return {
                respuesta_id: r.id as string,
                modulo,
                modulo_label: label,
                codigo_pregunta: (pregunta.codigo as string) ?? '—',
                seccion: (seccionObj.nombre as string) ?? '—',
                texto_pregunta: (pregunta.texto as string) ?? '—',
                comentario_respuesta: (r.comentario as string | null) ?? null,
                rancho_id: (auditoria.rancho_id as string) ?? '',
                rancho_nombre: (rancho.nombre as string) ?? '—',
                fecha_auditoria: (auditoria.fecha as string) ?? '',
                visita_id: (auditoria.visita_id as string | null) ?? null,
              }
            })
          })
        ),
        tbl('acciones_correctivas')
          .select('*, accion_correctiva_fotos(id, tipo, storage_path, leyenda, created_at)')
          .eq('org_id', profile.org_id)
          .order('created_at', { ascending: false }),
      ])

      if (accionesResult.error) throw accionesResult.error

      const accionMap = new Map<string, AccionCorrectivaConFotos>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const a of ((accionesResult.data ?? []) as any[])) {
        accionMap.set(a.respuesta_id as string, {
          ...a,
          fotos: (a.accion_correctiva_fotos ?? []) as AccionCorrectivaFoto[],
        } as AccionCorrectivaConFotos)
      }

      const allNc = ncResults.flat()
      const bandeja: NcBandejaItem[] = allNc.map((nc) => {
        const accion = accionMap.get(nc.respuesta_id) ?? null
        let estado: 'sin_capturar' | 'abierta' | 'cerrada' = 'sin_capturar'
        if (accion) estado = accion.estado as 'abierta' | 'cerrada'
        return { ...nc, accion, estado }
      })

      const ORDEN: Record<string, number> = { sin_capturar: 0, abierta: 1, cerrada: 2 }
      bandeja.sort((a, b) => {
        const o = (ORDEN[a.estado] ?? 0) - (ORDEN[b.estado] ?? 0)
        if (o !== 0) return o
        return b.fecha_auditoria.localeCompare(a.fecha_auditoria)
      })

      setItems(bandeja)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar acciones correctivas')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  async function upsertAccion(params: {
    respuesta_id: string
    modulo: string
    codigo_pregunta: string
    no_conformidad: string | null
    fecha_deteccion: string | null
    causa: string | null
    accion_correctiva: string | null
    accion_preventiva: string | null
    fecha_cumplimiento: string | null
    realizo: string | null
    verifico: string | null
    visita_id?: string | null
    ishikawa?: Record<string, string> | null
  }): Promise<string> {
    if (!profile?.org_id) throw new Error('Sin organizacion activa')
    const { data, error: err } = await tbl('acciones_correctivas')
      .upsert({ ...params, org_id: profile.org_id }, { onConflict: 'org_id,respuesta_id' })
      .select('id')
      .single()
    if (err) throw err
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any).id as string
  }

  async function agregarFoto(
    accionId: string,
    storagePath: string,
    tipo: 'no_conformidad' | 'evidencia_correccion',
    leyenda: string | null,
  ): Promise<void> {
    if (!profile?.org_id) throw new Error('Sin organizacion activa')
    const { error: err } = await tbl('accion_correctiva_fotos').insert({
      org_id: profile.org_id,
      accion_id: accionId,
      tipo,
      storage_path: storagePath,
      leyenda,
    })
    if (err) throw err
  }

  async function eliminarFotoDb(fotoId: string): Promise<void> {
    if (!profile?.org_id) throw new Error('Sin organizacion activa')
    const { error: err } = await tbl('accion_correctiva_fotos')
      .delete()
      .eq('id', fotoId)
      .eq('org_id', profile.org_id)
    if (err) throw err
  }

  return { items, loading, error, refetch: cargar, upsertAccion, agregarFoto, eliminarFotoDb }
}
