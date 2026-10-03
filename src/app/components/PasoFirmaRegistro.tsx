// Paso de firma después de guardar un registro.
// Se renderiza dentro del mismo bottom sheet (sheetPaso === 'firma_decision').
// Maneja: carga de mi_firma, FirmaPad si no tiene, preview si tiene,
// botón "Firmar y generar PDF", y botón "Después" (solo si !obligatoria).

import { useState, useRef, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { FirmaPad, type FirmaPadRef } from '@/app/components/FirmaPad'
import { FirmaSvg } from '@/app/components/FirmaSvg'
import {
  obtenerFirmasParaPdf,
  type MapaFirmas,
} from '@/hooks/useFirmasRegistro'
import { useFirmaContext } from '@/context/FirmaContext'

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

interface MiFirmaInfo {
  tiene: boolean
  trazos?: any
  firma_png?: string
}

export interface PasoFirmaRegistroProps {
  modulo: string
  ids: string[]                                        // IDs a firmar (pueden ser varios)
  descripcion: string                                  // p.ej. "Cosecha · 29/09/2026 · Rancho El Fresno"
  obligatoria: boolean
  onFirmadoYPDF: (firmasMapa: MapaFirmas) => Promise<void>
  onDespues?: () => void                               // solo si !obligatoria
}

export function PasoFirmaRegistro({
  modulo,
  ids,
  descripcion,
  obligatoria,
  onFirmadoYPDF,
  onDespues,
}: PasoFirmaRegistroProps) {
  const { refrescar } = useFirmaContext()

  const [miFirma, setMiFirma] = useState<MiFirmaInfo | null>(null)
  const [cargando, setCargando] = useState(true)
  const firmaPadRef = useRef<FirmaPadRef>(null)
  const [firmaPadInfo, setFirmaPadInfo] = useState({ vacia: true, puntos: 0 })
  const [guardandoFirma, setGuardandoFirma] = useState(false)
  const [firmando, setFirmando] = useState(false)

  useEffect(() => {
    let activo = true
    ;(supabase as any).rpc('mi_firma').then(({ data }: any) => {
      if (activo) setMiFirma(data ?? { tiene: false })
    }).catch(() => {
      if (activo) setMiFirma({ tiene: false })
    }).finally(() => {
      if (activo) setCargando(false)
    })
    return () => { activo = false }
  }, [])

  async function handleGuardarFirma() {
    if (!firmaPadRef.current) return
    const { png, trazos } = firmaPadRef.current.exportar()
    setGuardandoFirma(true)
    try {
      const eventId = crypto.randomUUID()
      const { error } = await (supabase as any).rpc('mi_firma_guardar', {
        p_firma_png: png,
        p_trazos: trazos,
        p_event_id: eventId,
      })
      if (error) throw error
      setMiFirma({ tiene: true, trazos, firma_png: png })
      toast.success('Firma registrada')
      await refrescar()
    } catch {
      toast.error('No se pudo guardar la firma')
    } finally {
      setGuardandoFirma(false)
    }
  }

  async function handleFirmar() {
    if (ids.length === 0) return
    setFirmando(true)
    try {
      // Firmar todos los IDs
      for (const id of ids) {
        const eventId = crypto.randomUUID()
        const { error } = await (supabase as any).rpc('registro_firmar', {
          p_modulo: modulo,
          p_registro_id: id,
          p_rol_firma: 'realizo',
          p_contenido_sha256: null,
          p_event_id: eventId,
        })
        if (error) throw error
      }
      const firmasMapa = await obtenerFirmasParaPdf(modulo, ids)
      await onFirmadoYPDF(firmasMapa)
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (ERRORES_FIRMA_WARNING.some((e) => msg.includes(e))) {
        toast.warning(msg)
      } else {
        console.error('[PasoFirmaRegistro] firmar error:', err)
        toast.error('No se pudo firmar el registro')
      }
    } finally {
      setFirmando(false)
    }
  }

  return (
    <>
      {/* Contenido */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {obligatoria ? (
          <div className="space-y-1">
            <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              Firmar como Realizó
            </p>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {descripcion}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Firmo como responsable de realizar este registro y confirmo que su contenido es correcto.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              ¿Firmar como Realizó?
            </p>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {descripcion}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Puedes firmar ahora o hacerlo después desde la lista de registros.
            </p>
          </div>
        )}

        {cargando ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          </div>
        ) : miFirma?.tiene ? (
          <div
            className="rounded-lg border p-3"
            style={{ backgroundColor: 'var(--input-background)' }}
          >
            {miFirma.trazos && Array.isArray(miFirma.trazos) && miFirma.trazos.length > 0 ? (
              <FirmaSvg
                trazos={miFirma.trazos}
                className="h-20 w-auto"
                style={{ color: 'var(--foreground)' }}
              />
            ) : miFirma.firma_png ? (
              <img
                src={miFirma.firma_png}
                alt="Tu firma"
                className="h-20 w-auto"
                style={{ backgroundColor: '#fff' }}
              />
            ) : (
              <p className="text-xs text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
                Firma guardada
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
              Primero registra tu firma para poder firmar registros
            </p>
            <FirmaPad
              ref={firmaPadRef}
              onChange={(info) => setFirmaPadInfo(info)}
            />
            <button
              onClick={handleGuardarFirma}
              disabled={guardandoFirma || firmaPadInfo.puntos < 15}
              className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            >
              {guardandoFirma ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar mi firma'}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border flex-shrink-0 flex gap-3">
        {!obligatoria && onDespues && (
          <button
            onClick={onDespues}
            className="flex-1 h-14 rounded-3xl border font-semibold"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Después
          </button>
        )}
        <button
          onClick={handleFirmar}
          disabled={firmando || !miFirma?.tiene}
          className="flex-1 h-14 rounded-3xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors hover:bg-agro-blue"
          style={{ backgroundColor: 'var(--primary)', color: 'white' }}
        >
          {firmando && <Loader2 className="w-4 h-4 animate-spin" />}
          Firmar y generar PDF
        </button>
      </div>
    </>
  )
}
