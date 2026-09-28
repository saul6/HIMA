import { useState, useRef } from 'react'
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  type FirmasDeRegistro,
  type FirmaDetalle,
} from '@/hooks/useFirmasRegistro'
import { FirmaPad, type FirmaPadRef } from '@/app/components/FirmaPad'
import { FirmaSvg } from '@/app/components/FirmaSvg'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface FirmasRegistroProps {
  modulo: string
  registroId: string
  fechaRegistro: string  // YYYY-MM-DD, para mostrar "el registro del {fecha larga}"
  firma?: FirmasDeRegistro
  loadingFirmas?: boolean
  onFirmado?: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function formatFechaLarga(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

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

// ── Sub-componente: chip de estado de firma ───────────────────────────────────

function FirmaEstadoChip({ firma, label }: { firma: FirmaDetalle | null | undefined; label: string }) {
  if (!firma) {
    return (
      <div>
        <p className="text-[10px] mb-1" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
          {label}
        </p>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Pendiente de firma</p>
      </div>
    )
  }

  if (firma.estado === 'desactualizada') {
    return (
      <div>
        <p className="text-[10px] mb-1" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
          {label}
        </p>
        <div className="flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
          <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
            Firma desactualizada: se editó el registro
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-[10px] mb-1" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
        {label}
      </p>
      <div className="flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--agro-success-text)' }} />
        <p className="text-xs truncate" style={{ color: 'var(--agro-success-text)', fontWeight: 600 }}>
          {firma.firmante}
        </p>
      </div>
      <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
        {formatFirmaFecha(firma.firmado_en)}
      </p>
    </div>
  )
}

// ── Sub-componente: preview de firma ─────────────────────────────────────────

function FirmaPreview({ firmaInfo }: { firmaInfo: { trazos?: any; firma_png?: string } }) {
  const trazos = firmaInfo.trazos
  const png = firmaInfo.firma_png

  if (trazos && Array.isArray(trazos) && trazos.length > 0) {
    return (
      <FirmaSvg
        trazos={trazos}
        className="h-20 w-auto"
        style={{ color: 'var(--foreground)' } as any}
      />
    )
  }
  if (png) {
    return (
      <img
        src={png}
        alt="Tu firma"
        className="h-20 w-auto"
        style={{ backgroundColor: '#fff' }}
      />
    )
  }
  return (
    <p className="text-xs text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
      Firma guardada
    </p>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function FirmasRegistro({
  modulo,
  registroId,
  fechaRegistro,
  firma,
  loadingFirmas = false,
  onFirmado,
}: FirmasRegistroProps) {
  const { profile } = useAuthContext()

  // Panel de confirmación inline
  const [panelActivo, setPanelActivo] = useState<'realizo' | 'verifico' | null>(null)
  const [miFirmaInfo, setMiFirmaInfo] = useState<{ tiene: boolean; trazos?: any; firma_png?: string } | null>(null)
  const [cargandoMiFirma, setCargandoMiFirma] = useState(false)
  const [firmando, setFirmando] = useState(false)

  // FirmaPad para registro de firma nueva
  const firmaPadRef = useRef<FirmaPadRef>(null)
  const [firmaPadInfo, setFirmaPadInfo] = useState({ vacia: true, puntos: 0 })
  const [guardandoFirmaLocal, setGuardandoFirmaLocal] = useState(false)

  // Historial
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [historial, setHistorial] = useState<any[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  const esAdmin = profile?.rol === 'admin_org' || profile?.rol === 'asesor_tecnico' || profile?.rol === 'super_admin'
  const esAuditor = profile?.rol === 'auditor'

  // Lógica de visibilidad de botones
  const puedeRealizarFirma = !esAuditor && firma?.realizo?.estado !== 'vigente'
  const puedeVerificarFirma =
    esAdmin &&
    firma?.realizo?.estado === 'vigente' &&
    firma?.realizo?.profile_id !== profile?.id &&
    firma?.verifico?.estado !== 'vigente'

  async function abrirPanel(rol: 'realizo' | 'verifico') {
    setPanelActivo(rol)
    setCargandoMiFirma(true)
    setMiFirmaInfo(null)
    setFirmaPadInfo({ vacia: true, puntos: 0 })
    try {
      const { data } = await (supabase as any).rpc('mi_firma')
      setMiFirmaInfo(data ?? { tiene: false })
    } catch {
      setMiFirmaInfo({ tiene: false })
    } finally {
      setCargandoMiFirma(false)
    }
  }

  function cerrarPanel() {
    setPanelActivo(null)
    setMiFirmaInfo(null)
    firmaPadRef.current?.limpiar()
    setFirmaPadInfo({ vacia: true, puntos: 0 })
  }

  async function handleGuardarFirma() {
    if (!firmaPadRef.current) return
    const { png, trazos } = firmaPadRef.current.exportar()
    setGuardandoFirmaLocal(true)
    try {
      const eventId = crypto.randomUUID()
      const { data, error } = await (supabase as any).rpc('mi_firma_guardar', {
        p_firma_png: png,
        p_trazos: trazos,
        p_event_id: eventId,
      })
      if (error) throw error
      setMiFirmaInfo({ tiene: true, trazos, firma_png: png })
      toast.success('Firma registrada')
    } catch (err: any) {
      toast.error('No se pudo guardar la firma')
      console.error('[FirmasRegistro] guardar firma error:', err)
    } finally {
      setGuardandoFirmaLocal(false)
    }
  }

  async function handleFirmar() {
    if (!panelActivo) return
    setFirmando(true)
    try {
      const eventId = crypto.randomUUID()
      const { error } = await (supabase as any).rpc('registro_firmar', {
        p_modulo: modulo,
        p_registro_id: registroId,
        p_rol_firma: panelActivo,
        p_contenido_sha256: firma?.contenido_sha256 ?? null,
        p_event_id: eventId,
      })
      if (error) throw error
      toast.success('Registro firmado')
      cerrarPanel()
      onFirmado?.()
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (
        ERRORES_FIRMA_WARNING.some((e) => msg.includes(e))
      ) {
        toast.warning(msg)
      } else {
        console.error('[FirmasRegistro] firmar error:', err)
        toast.error('No se pudo firmar el registro')
      }
      cerrarPanel()
    } finally {
      setFirmando(false)
    }
  }

  async function toggleHistorial() {
    if (mostrarHistorial) {
      setMostrarHistorial(false)
      return
    }
    setMostrarHistorial(true)
    setCargandoHistorial(true)
    try {
      const { data, error } = await (supabase as any).rpc('registro_firmas_historial', {
        p_modulo: modulo,
        p_registro_id: registroId,
      })
      if (error) throw error
      setHistorial(data ?? [])
    } catch {
      setHistorial([])
    } finally {
      setCargandoHistorial(false)
    }
  }

  if (loadingFirmas) {
    return (
      <div className="border-t border-border mt-3 pt-3">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
      </div>
    )
  }

  return (
    <div className="border-t border-border mt-3 pt-3">

      {/* Estado de firmas */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <FirmaEstadoChip firma={firma?.realizo} label="Realizó" />
        <FirmaEstadoChip firma={firma?.verifico} label="Verificó" />
      </div>

      {/* Botones de acción */}
      {(puedeRealizarFirma || puedeVerificarFirma) && panelActivo === null && (
        <div className="flex flex-wrap gap-2 mb-3">
          {puedeRealizarFirma && (
            <button
              onClick={() => abrirPanel('realizo')}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              Firmar como Realizó
            </button>
          )}
          {puedeVerificarFirma && (
            <button
              onClick={() => abrirPanel('verifico')}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              Verificar y firmar
            </button>
          )}
        </div>
      )}

      {/* Panel de confirmación inline */}
      {panelActivo !== null && (
        <div
          className="rounded-lg border p-3 mb-3 space-y-3"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
            Firmar "{panelActivo === 'realizo' ? 'Realizó' : 'Verificó'}" —{' '}
            {formatFechaLarga(fechaRegistro)}
          </p>

          {cargandoMiFirma ? (
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          ) : miFirmaInfo?.tiene ? (
            /* Preview de la firma del usuario */
            <div
              className="rounded-lg border p-2"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
            >
              <FirmaPreview firmaInfo={miFirmaInfo} />
            </div>
          ) : (
            /* No tiene firma → FirmaPad para registrarla */
            <div className="space-y-2">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Primero registra tu firma para poder firmar registros
              </p>
              <FirmaPad
                ref={firmaPadRef}
                onChange={(info) => setFirmaPadInfo(info)}
              />
              <button
                onClick={handleGuardarFirma}
                disabled={guardandoFirmaLocal || firmaPadInfo.puntos < 15}
                className="w-full h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
                style={{ backgroundColor: 'var(--primary)', color: 'white' }}
              >
                {guardandoFirmaLocal ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : 'Guardar mi firma'}
              </button>
            </div>
          )}

          {/* Botones Firmar / Cancelar */}
          <div className="flex gap-2">
            <button
              onClick={cerrarPanel}
              className="flex-1 h-9 rounded-lg text-xs border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleFirmar}
              disabled={firmando || !miFirmaInfo?.tiene}
              className="flex-1 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-40 transition-colors"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            >
              {firmando ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Firmar'}
            </button>
          </div>
        </div>
      )}

      {/* Toggle historial */}
      <button
        onClick={toggleHistorial}
        className="flex items-center gap-1 text-xs transition-colors"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {mostrarHistorial ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
        {mostrarHistorial ? 'Ocultar historial' : 'Ver historial de firmas'}
      </button>

      {/* Historial */}
      {mostrarHistorial && (
        <div className="mt-2 space-y-2">
          {cargandoHistorial ? (
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          ) : historial.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Sin historial de firmas
            </p>
          ) : (
            historial.map((h, i) => (
              <div
                key={i}
                className="rounded-lg border p-2 space-y-1"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
              >
                <div className="flex items-center gap-2">
                  {h.estado === 'vigente' ? (
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--agro-success-text)' }} />
                  ) : (
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--agro-warning-text)' }} />
                  )}
                  <span
                    className="text-xs"
                    style={{
                      color: h.estado === 'vigente' ? 'var(--agro-success-text)' : 'var(--agro-warning-text)',
                      fontWeight: 600,
                    }}
                  >
                    {h.estado === 'vigente' ? 'Vigente' : 'Desactualizada'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    · {h.rol_firma === 'realizo' ? 'Realizó' : 'Verificó'}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--foreground)' }}>{h.firmante}</p>
                <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  {formatFirmaFecha(h.firmado_en)}
                </p>
                {h.sello && (
                  <p className="text-[10px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
                    Sello: {(h.sello ?? '').slice(0, 12)}
                  </p>
                )}
                {(h.trazos || h.firma_png) && (
                  <div
                    className="rounded border p-1 mt-1"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
                  >
                    <FirmaPreview firmaInfo={{ trazos: h.trazos, firma_png: h.firma_png }} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
