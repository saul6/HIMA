import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

// ── Tipos exportados ──────────────────────────────────────────────────────────

export type RolFirma = 'realizo' | 'verifico'
export type EstadoFirma = 'vigente' | 'desactualizada'

// Firma de enterado: persona sin cuenta, capturada desde la sesión de otro usuario
export interface FirmaEnterado {
  estado: EstadoFirma
  firmante: string
  cargo: string
  capturado_por: string
  firmado_en: string
  sello: string
  trazos?: Array<Array<{ x: number; y: number }>>
  firma_png?: string
}

export interface FirmaDetalle {
  estado: EstadoFirma
  firmante: string
  rol_usuario: string
  profile_id: string
  firmado_en: string
  sello: string
  trazos?: Array<Array<{ x: number; y: number }>>
  firma_png?: string
  // true cuando un admin_org firmó una sola vez como "Realizó y verificó"
  firma_unica?: boolean
  // Solo lo llena obtenerFirmasParaPdf: lleva el enterado hasta PdfSignatures
  // sin tener que cambiar la firma de cada generador de PDF.
  enterado?: FirmaEnterado | null
}

export interface FirmasDeRegistro {
  contenido_sha256: string
  realizo: FirmaDetalle | null
  verifico: FirmaDetalle | null
  enterado?: FirmaEnterado | null
}

export type MapaFirmas = Record<string, FirmasDeRegistro>

export interface FirmaEnteradoParaPdf {
  png: string
  firmante: string
  cargo: string
  capturadoPor: string
  fecha: string      // "dd/mm/yyyy hh:mm"
  estado: EstadoFirma
}

// FirmaParaPdf: para pasar a PdfSignatures
export interface FirmaParaPdf {
  png: string        // base64 PNG negro sobre blanco
  firmante: string
  fecha: string      // "dd/mm/yyyy hh:mm"
  sello: string      // primeros 12 chars
  estado: EstadoFirma
  unica?: boolean    // firma única "Realizó y verificó": PdfSignatures dibuja un solo bloque
  enterado?: FirmaEnteradoParaPdf | null
}

// Firma única: la fila verifico la marca y comparte firmante con realizo.
export function esFirmaUnica(reg: FirmasDeRegistro | undefined | null): boolean {
  const r = reg?.realizo
  const v = reg?.verifico
  return !!(r?.profile_id && v?.profile_id && v.firma_unica && r.profile_id === v.profile_id)
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
  const e = firma.enterado
  return {
    png: firma.firma_png ?? '',
    firmante: firma.firmante,
    fecha: firma.firmado_en ? formatFirmaFecha(firma.firmado_en) : '',
    sello: (firma.sello ?? '').slice(0, 12),
    estado: firma.estado,
    unica: !!firma.firma_unica,
    enterado: e
      ? {
          png: e.firma_png ?? '',
          firmante: e.firmante,
          cargo: e.cargo,
          capturadoPor: e.capturado_por,
          fecha: formatFirmaFecha(e.firmado_en),
          estado: e.estado,
        }
      : null,
  }
}

export function firmaEnteradoAParaPdf(e: FirmaEnterado): FirmaEnteradoParaPdf {
  return {
    png: e.firma_png ?? '',
    firmante: e.firmante,
    cargo: e.cargo,
    capturadoPor: e.capturado_por,
    fecha: formatFirmaFecha(e.firmado_en),
    estado: e.estado,
  }
}

// Las tres firmas de un registro listas para PdfSignatures (enterado por separado).
// Ignora el marcador vacío que obtenerFirmasParaPdf crea cuando solo hay enterado.
export function firmasRegistroAParaPdf(reg: FirmasDeRegistro | undefined | null): {
  realizo: FirmaParaPdf | null
  verifico: FirmaParaPdf | null
  enterado: FirmaEnteradoParaPdf | null
} {
  const realizo = reg?.realizo && reg.realizo.profile_id ? firmaDetalleAParaPdf(reg.realizo) : null
  const verifico = reg?.verifico && reg.verifico.profile_id ? firmaDetalleAParaPdf(reg.verifico) : null
  const enterado = reg?.enterado ? firmaEnteradoAParaPdf(reg.enterado) : null
  return { realizo, verifico, enterado }
}

// ── Registros de varias filas (jornadas) ─────────────────────────────────────

// Fila representativa determinista: orden por (created_at, id), igual en todos los caminos.
export function idRepresentativoJornada(filas: Array<{ id: string; created_at?: string | null }>): string | undefined {
  if (filas.length === 0) return undefined
  return [...filas].sort((a, b) =>
    (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id),
  )[0].id
}

function elegirFirma(mapa: MapaFirmas, ids: string[], rol: RolFirma): FirmaDetalle | null {
  let mejor: FirmaDetalle | null = null
  for (const id of ids) {
    const f = mapa[id]?.[rol]
    if (!f || !f.profile_id) continue
    if (f.estado === 'vigente') return f
    if (!mejor || (f.firmado_en ?? '') > (mejor.firmado_en ?? '')) mejor = f
  }
  return mejor
}

// Firmas Realizó/Verificó de un registro que vive en varias filas: toma la primera
// vigente entre todas (si no hay, la más reciente, que el PDF pinta como desactualizada).
export function firmasDeFilasParaPdf(mapa: MapaFirmas, ids: string[]): {
  firmaRealizo: FirmaParaPdf | null
  firmaVerifico: FirmaParaPdf | null
} {
  const realizo = elegirFirma(mapa, ids, 'realizo')
  const verifico = elegirFirma(mapa, ids, 'verifico')
  if (realizo && verifico && verifico.firma_unica && realizo.profile_id === verifico.profile_id) {
    realizo.firma_unica = true
  }
  // El enterado puede estar en cualquier fila de la jornada
  if (realizo && !realizo.enterado) {
    for (const id of ids) {
      const e = mapa[id]?.enterado ?? mapa[id]?.realizo?.enterado
      if (e) { realizo.enterado = e; break }
    }
  }
  return {
    firmaRealizo: realizo ? firmaDetalleAParaPdf(realizo) : null,
    firmaVerifico: verifico ? firmaDetalleAParaPdf(verifico) : null,
  }
}

// Vista unificada de la jornada para la tarjeta (sin imagen): mismas reglas que el PDF.
export function firmasDeFilasParaTarjeta(mapa: MapaFirmas, ids: string[]): FirmasDeRegistro | undefined {
  const base = ids.map((id) => mapa[id]).find(Boolean)
  if (!base) return undefined
  return {
    ...base,
    realizo: elegirFirma(mapa, ids, 'realizo'),
    verifico: elegirFirma(mapa, ids, 'verifico'),
    enterado: ids.map((id) => mapa[id]?.enterado).find(Boolean) ?? base.enterado,
  }
}

export async function obtenerFirmasDeFilasParaPdf(modulo: string, ids: string[]) {
  return firmasDeFilasParaPdf(await obtenerFirmasParaPdf(modulo, ids), ids)
}

// ── Mensajes de error user-friendly ──────────────────────────────────────────

const ERRORES_FIRMA_WARNING = [
  'Primero registra tu firma',
  'ya está firmado',
  'Solo un administrador',
  'Primero debe firmar',
  'Quien realizó',
  'Quien verificó',
  'firma de enterado',
  'La firma está vacía',
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

  // Los generadores solo leen realizo/verifico: el enterado viaja dentro de ellos.
  // Si no hay firma Realizó, un marcador vacío (png '') se imprime igual que "sin firma".
  for (const reg of Object.values(resultado)) {
    // Registros viejos: la fila realizo no trae firma_unica aunque verifico sí
    if (esFirmaUnica(reg) && reg.realizo) reg.realizo.firma_unica = true
    const ent = reg?.enterado
    if (!ent) continue
    if (reg.realizo) reg.realizo.enterado = ent
    else reg.realizo = {
      estado: 'vigente', firmante: '', rol_usuario: '', profile_id: '',
      firmado_en: '', sello: '', enterado: ent,
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
