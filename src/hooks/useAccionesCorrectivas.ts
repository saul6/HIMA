import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import type { AccionCorrectivaFoto } from '@/types/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

const MODULOS_NC: Array<{ tabla: string; modulo: string; label: string }> = [
  { tabla: 'm14_respuestas', modulo: 'm14', label: 'SAIA' },
  { tabla: 'm15_respuestas', modulo: 'm15', label: 'Granja' },
  { tabla: 'm16_respuestas', modulo: 'm16', label: 'Cuadrilla' },
  { tabla: 'm17_respuestas', modulo: 'm17', label: "BPM's" },
  { tabla: 'm18_respuestas', modulo: 'm18', label: 'HACCP' },
]

export interface CapaBandeja {
  id: string
  hallazgoId: string
  no_conformidad: string | null
  causa: string | null
  accion_correctiva: string | null
  accion_preventiva: string | null
  fecha_deteccion: string | null
  fecha_cumplimiento: string | null
  realizo: string | null
  verifico: string | null
  estado: 'abierta' | 'cerrada'
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
  accion: CapaBandeja | null
  estado: 'sin_capturar' | 'abierta' | 'cerrada'
}

function parseComentario(raw: string | null): { realizo: string | null; verifico: string | null } {
  if (!raw) return { realizo: null, verifico: null }
  const rm = raw.match(/Realiz[oó]:\s*([^·]+)/)
  const vm = raw.match(/Verific[oó]:\s*(.+)/)
  return { realizo: rm?.[1]?.trim() || null, verifico: vm?.[1]?.trim() || null }
}

function buildComentario(realizo: string | null, verifico: string | null): string | null {
  const parts = [
    realizo?.trim() ? `Realizó: ${realizo.trim()}` : null,
    verifico?.trim() ? `Verificó: ${verifico.trim()}` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
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
      // 1. Derivar NCs desde m14-m18
      const ncResultsRaw = await Promise.all(
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
      )
      const allNc = ncResultsRaw.flat()
      const respuestaIds = allNc.map((nc) => nc.respuesta_id)

      // 2. Cargar hallazgos + CAPAs canónicas
      const capasMap = new Map<string, CapaBandeja>()

      if (respuestaIds.length > 0) {
        const { data: hallazgos, error: hErr } = await tbl('aud_hallazgos')
          .select('id, source_record_id, estado, detectado_en, descripcion, criterion_code, source_module_code')
          .eq('origin_type', 'SELF_AUDIT')
          .eq('org_id', profile.org_id)
          .in('source_record_id', respuestaIds)
        if (hErr) throw hErr

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hallazgoList = (hallazgos ?? []) as any[]
        const hallazgoIds = hallazgoList.map((h: any) => h.id as string)

        let capaList: any[] = [] // eslint-disable-line @typescript-eslint/no-explicit-any
        if (hallazgoIds.length > 0) {
          const { data: capas, error: cErr } = await tbl('aud_acciones_correctivas')
            .select('id, hallazgo_id, causa_raiz, correccion_inmediata, accion_preventiva, comentario_accion, due_at')
            .in('hallazgo_id', hallazgoIds)
            .eq('org_id', profile.org_id)
          if (cErr) throw cErr
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          capaList = (capas ?? []) as any[]
        }

        // Cargar fotos por capa_id
        const capaIds = capaList.map((c: any) => c.id as string) // eslint-disable-line @typescript-eslint/no-explicit-any
        const fotosMap = new Map<string, AccionCorrectivaFoto[]>()
        if (capaIds.length > 0) {
          const { data: fotos, error: fErr } = await tbl('accion_correctiva_fotos')
            .select('id, tipo, storage_path, leyenda, created_at, capa_id, accion_id')
            .in('capa_id', capaIds)
            .eq('org_id', profile.org_id)
          if (fErr) console.warn('[useAccionesCorrectivas] fotos:', fErr)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const foto of (fotos ?? []) as any[]) {
            const cId = foto.capa_id as string
            if (!fotosMap.has(cId)) fotosMap.set(cId, [])
            fotosMap.get(cId)!.push(foto as AccionCorrectivaFoto)
          }
        }

        // Indexar CAPAs por hallazgo_id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const capaByHallazgo = new Map<string, any>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const c of capaList) capaByHallazgo.set(c.hallazgo_id as string, c)

        // Construir mapa por source_record_id
        for (const h of hallazgoList) {
          const capa = capaByHallazgo.get(h.id)
          if (!capa) continue
          const { realizo, verifico } = parseComentario(capa.comentario_accion)
          const cb: CapaBandeja = {
            id: capa.id,
            hallazgoId: h.id,
            no_conformidad: h.descripcion ?? null,
            causa: capa.causa_raiz ?? null,
            accion_correctiva: capa.correccion_inmediata ?? null,
            accion_preventiva: capa.accion_preventiva ?? null,
            fecha_deteccion: h.detectado_en ?? null,
            fecha_cumplimiento: capa.due_at ?? null,
            realizo,
            verifico,
            estado: (h.estado as string) === 'CLOSED' ? 'cerrada' : 'abierta',
            fotos: fotosMap.get(capa.id) ?? [],
          }
          capasMap.set(h.source_record_id as string, cb)
        }
      }

      // 3. Armar bandeja
      const bandeja: NcBandejaItem[] = allNc.map((nc) => {
        const accion = capasMap.get(nc.respuesta_id) ?? null
        let estado: 'sin_capturar' | 'abierta' | 'cerrada' = 'sin_capturar'
        if (accion) estado = accion.estado
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
      console.error('[useAccionesCorrectivas]', e)
      setError('Error al cargar acciones correctivas')
    } finally {
      setLoading(false)
    }
  }, [profile?.org_id])

  useEffect(() => { cargar() }, [cargar])

  async function guardarCapa(params: {
    hallazgoId?: string | null
    capaId?: string | null
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
  }): Promise<{ hallazgoId: string; capaId: string }> {
    if (!profile?.org_id) throw new Error('Sin organización activa')
    const comentario = buildComentario(params.realizo, params.verifico)

    if (!params.hallazgoId) {
      const { data: h, error: hErr } = await tbl('aud_hallazgos').insert({
        org_id: profile.org_id,
        origin_type: 'SELF_AUDIT',
        source_module_code: params.modulo,
        source_record_id: params.respuesta_id,
        criterion_code: params.codigo_pregunta,
        descripcion: params.no_conformidad ?? '',
        estado: 'OPEN',
        detectado_en: params.fecha_deteccion || null,
        creado_por: profile.id,
      }).select('id').single()
      if (hErr) throw hErr

      const hId = (h as any).id as string // eslint-disable-line @typescript-eslint/no-explicit-any
      const { data: c, error: cErr } = await tbl('aud_acciones_correctivas').insert({
        org_id: profile.org_id,
        hallazgo_id: hId,
        causa_raiz: params.causa || null,
        correccion_inmediata: params.accion_correctiva || null,
        accion_preventiva: params.accion_preventiva || null,
        internal_status: 'PREPARING',
        comentario_accion: comentario,
        due_at: params.fecha_cumplimiento || null,
        creado_por: profile.id,
      }).select('id').single()
      if (cErr) throw cErr

      return { hallazgoId: hId, capaId: (c as any).id as string } // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    // Actualizar hallazgo existente
    const { error: hErr } = await tbl('aud_hallazgos').update({
      descripcion: params.no_conformidad ?? '',
      detectado_en: params.fecha_deteccion || null,
    }).eq('id', params.hallazgoId).eq('org_id', profile.org_id)
    if (hErr) throw hErr

    if (!params.capaId) {
      // Hallazgo sin CAPA — crear
      const { data: c, error: cErr } = await tbl('aud_acciones_correctivas').insert({
        org_id: profile.org_id,
        hallazgo_id: params.hallazgoId,
        causa_raiz: params.causa || null,
        correccion_inmediata: params.accion_correctiva || null,
        accion_preventiva: params.accion_preventiva || null,
        internal_status: 'PREPARING',
        comentario_accion: comentario,
        due_at: params.fecha_cumplimiento || null,
        creado_por: profile.id,
      }).select('id').single()
      if (cErr) throw cErr
      return { hallazgoId: params.hallazgoId, capaId: (c as any).id as string } // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    // Actualizar CAPA existente (el trigger versiona automáticamente)
    const { error: cErr } = await tbl('aud_acciones_correctivas').update({
      causa_raiz: params.causa || null,
      correccion_inmediata: params.accion_correctiva || null,
      accion_preventiva: params.accion_preventiva || null,
      comentario_accion: comentario,
      due_at: params.fecha_cumplimiento || null,
    }).eq('id', params.capaId).eq('org_id', profile.org_id)
    if (cErr) throw cErr

    return { hallazgoId: params.hallazgoId, capaId: params.capaId }
  }

  async function cerrarCapa(hallazgoId: string, capaId: string): Promise<void> {
    if (!profile?.org_id) throw new Error('Sin organización activa')
    const now = new Date().toISOString()
    const [r1, r2] = await Promise.all([
      tbl('aud_hallazgos')
        .update({ estado: 'CLOSED' })
        .eq('id', hallazgoId)
        .eq('org_id', profile.org_id),
      tbl('aud_acciones_correctivas')
        .update({ internal_status: 'COMPLETE_INTERNAL', closed_at: now })
        .eq('id', capaId)
        .eq('org_id', profile.org_id),
    ])
    if (r1.error) throw r1.error
    if (r2.error) throw r2.error
  }

  async function agregarFoto(
    capaId: string,
    storagePath: string,
    tipo: 'no_conformidad' | 'evidencia_correccion',
    leyenda: string | null,
  ): Promise<void> {
    if (!profile?.org_id) throw new Error('Sin organización activa')
    const { error: err } = await tbl('accion_correctiva_fotos').insert({
      org_id: profile.org_id,
      capa_id: capaId,
      tipo,
      storage_path: storagePath,
      leyenda,
    })
    if (err) throw err
  }

  async function eliminarFotoDb(fotoId: string): Promise<void> {
    if (!profile?.org_id) throw new Error('Sin organización activa')
    const { error: err } = await tbl('accion_correctiva_fotos')
      .delete()
      .eq('id', fotoId)
      .eq('org_id', profile.org_id)
    if (err) throw err
  }

  return { items, loading, error, refetch: cargar, guardarCapa, cerrarCapa, agregarFoto, eliminarFotoDb }
}
