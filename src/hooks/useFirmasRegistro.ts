import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

// ── Tipos exportados ──────────────────────────────────────────────────────────

export type RolFirma = 'realizo' | 'verifico'
export type EstadoFirma = 'vigente' | 'desactualizada'

export interface FirmaDetalle {
  estado: EstadoFirma
  firmante: string
  rol_usuario: string
  profile_id: string
  firmado_en: string
  sello: string
  trazos?: Array<Array<{ x: number; y: number }>>
  firma_png?: string
}

export interface FirmasDeRegistro {
  contenido_sha256: string
  realizo: FirmaDetalle | null
  verifico: FirmaDetalle | null
}

export type MapaFirmas = Record<string, FirmasDeRegistro>

// FirmaParaPdf: para pasar a PdfSignatures
export interface FirmaParaPdf {
  png: string        // base64 PNG negro sobre blanco
  firmante: string
  fecha: string      // "dd/mm/yyyy hh:mm"
  sello: string      // primeros 12 chars
  estado: EstadoFirma
}

// ── Helpers de formateo ───────────────────────────────────────────────────────

function formatFirmaFecha(isoStr: string): string {
  try {
    const d = new Date(isoStr)
    const dia = String(d.getDate()).padStart(2, '0')
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const anio = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${dia}/${mes}/${anio} ${hh}:${mm}`
  } catch {
    return isoStr
  }
}

// Convierte FirmaDetalle (con imagen) al formato para PDF
export function firmaDetalleAParaPdf(firma: FirmaDetalle): FirmaParaPdf {
  return {
    png: firma.firma_png ?? '',
    firmante: firma.firmante,
    fecha: formatFirmaFecha(firma.firmado_en),
    sello: (firma.sello ?? '').slice(0, 12),
    estado: firma.estado,
  }
}

// ── Mensajes de error user-friendly ──────────────────────────────────────────

const ERRORES_FIRMA_WARNING = [
  'Primero registra tu firma',
  'ya está firmado',
  'Solo un administrador',
  'Primero debe firmar',
  'Quien realizó',
  'Quien verificó',
  'El registro cambió',
  'no admite firmas',
  'no puede firmar registros',
]

function esErrorWarning(msg: string): boolean {
  return ERRORES_FIRMA_WARNING.some((e) => msg.includes(e))
}

// ── obtenerFirmasParaPdf ──────────────────────────────────────────────────────

// Async, llama registro_firmas_ver con p_con_imagen: true, chunks de 500
export async function obtenerFirmasParaPdf(modulo: string, ids: string[]): Promise<MapaFirmas> {
  if (ids.length === 0) return {}

  const resultado: MapaFirmas = {}
  const CHUNK = 500

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const { data, error } = await (supabase as any).rpc('registro_firmas_ver', {
      p_modulo: modulo,
      p_ids: chunk,
      p_con_imagen: true,
    })
    if (error) {
      console.error('[useFirmasRegistro] obtenerFirmasParaPdf error:', error)
      continue
    }
    if (data && typeof data === 'object') {
      Object.assign(resultado, data)
    }
  }

  return resultado
}

// ── useFirmasRegistro hook ────────────────────────────────────────────────────

export function useFirmasRegistro(modulo: string, ids: string[]) {
  const [firmas, setFirmas] = useState<MapaFirmas>({})
  const [loading, setLoading] = useState(false)

  // key estable basada en ids ordenados
  const idsKey = [...ids].sort().join(',')
  const idsKeyRef = useRef(idsKey)
  idsKeyRef.current = idsKey

  const fetchFirmas = useCallback(async (currentIds: string[]) => {
    if (currentIds.length === 0) {
      setFirmas({})
      return
    }
    setLoading(true)
    try {
      const resultado: MapaFirmas = {}
      const CHUNK = 500
      for (let i = 0; i < currentIds.length; i += CHUNK) {
        const chunk = currentIds.slice(i, i + CHUNK)
        const { data, error } = await (supabase as any).rpc('registro_firmas_ver', {
          p_modulo: modulo,
          p_ids: chunk,
          p_con_imagen: false,
        })
        if (error) {
          console.error('[useFirmasRegistro] fetchFirmas error:', error)
          continue
        }
        if (data && typeof data === 'object') {
          Object.assign(resultado, data)
        }
      }
      setFirmas(resultado)
    } finally {
      setLoading(false)
    }
  }, [modulo]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const currentIds = idsKey.split(',').filter(Boolean)
    fetchFirmas(currentIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, fetchFirmas])

  const refetch = useCallback(async () => {
    const currentIds = idsKeyRef.current.split(',').filter(Boolean)
    await fetchFirmas(currentIds)
  }, [fetchFirmas])

  const firmar = useCallback(async (
    registroId: string,
    rol: RolFirma,
    contenidoSha256?: string | null,
  ) => {
    const eventId = crypto.randomUUID()
    const { data, error } = await (supabase as any).rpc('registro_firmar', {
      p_modulo: modulo,
      p_registro_id: registroId,
      p_rol_firma: rol,
      p_contenido_sha256: contenidoSha256 ?? null,
      p_event_id: eventId,
    })

    if (error) {
      const msg = error.message ?? ''
      if (esErrorWarning(msg)) {
        toast.warning(msg)
      } else {
        console.error('[useFirmasRegistro] firmar error:', error)
        toast.error('No se pudo firmar el registro')
      }
      throw error
    }

    // Recargar solo ese registro
    const { data: updated, error: errUpdate } = await (supabase as any).rpc('registro_firmas_ver', {
      p_modulo: modulo,
      p_ids: [registroId],
      p_con_imagen: false,
    })
    if (!errUpdate && updated && typeof updated === 'object') {
      setFirmas((prev) => ({ ...prev, ...updated }))
    }

    return data
  }, [modulo])

  return { firmas, loading, refetch, firmar }
}
