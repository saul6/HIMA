import { useState, useEffect } from 'react'
import {
  ChevronLeft, Plus, FileDown, X, Loader2, Package, Files,
  AlertTriangle, Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM10CosechaLiberacion, type M10Registro } from '@/hooks/useM10CosechaLiberacion'
import { supabase } from '@/lib/supabase'
import { generarCosechaLiberacionPDF } from '@/lib/pdf/m10/generarCosechaLiberacionPDF'
import { generarCosechaLiberacionConsolidadoPDF } from '@/lib/pdf/m10/generarCosechaLiberacionConsolidadoPDF'
import type { CosechaLiberacionPaginaProps } from '@/lib/pdf/m10/CosechaLiberacionPDF'
import { useModulosContext } from '@/context/ModulosContext'

// ── Constantes ────────────────────────────────────────────────────────────────

const TITULO_MODULO = 'Registro de Cosecha y Liberación'
const CLAVE_MODULO  = 'MXA-F-SC-SIG-038.14 · Por evento'

// ── Tipos locales ─────────────────────────────────────────────────────────────

type FilaLiberacion = {
  sector: string
  cantidad_bandejas: string
  lote_liberado: boolean
  numero_comprobante: string
  codigo_trazabilidad: string
  marca_embalaje: string
  destino_final: string
  fruta_proceso_kg: string
  encargado_liberacion_id: string
  verificacion_semanal: boolean
  hora_inicio_cosecha: string
  hora_fin_cosecha: string
  observaciones: string
}

type Advertencia = {
  nombreProducto: string
  fechaAplicacion: string
  diasCarencia: number
  fechaLimite: string
}

type PerfilItem = { id: string; nombre_completo: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

const hoy = () => new Date().toISOString().split('T')[0]

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function nuevaFila(profileId: string): FilaLiberacion {
  return {
    sector: '',
    cantidad_bandejas: '',
    lote_liberado: true,
    numero_comprobante: '',
    codigo_trazabilidad: '',
    marca_embalaje: '',
    destino_final: '',
    fruta_proceso_kg: '',
    encargado_liberacion_id: profileId,
    verificacion_semanal: true,
    hora_inicio_cosecha: '',
    hora_fin_cosecha: '',
    observaciones: '',
  }
}

// ── Sub-componente Toggle ─────────────────────────────────────────────────────

function Toggle({ activo, onToggle }: { activo: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-4 py-2 rounded-lg text-sm transition-colors ${
        activo
          ? 'bg-agro-success-fill text-agro-success-text'
          : 'bg-agro-danger-fill text-agro-danger-text'
      }`}
      style={{ fontWeight: 600 }}
    >
      {activo ? 'Sí' : 'No'}
    </button>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function RegistroCosechaLiberacion() {
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const { ranchos } = useRanchos()
  const { registros, loading, refetch } = useM10CosechaLiberacion()
  const { terminosSitio } = useModulosContext()

  // Perfiles de la org para el select de encargado
  const [perfiles, setPerfiles] = useState<PerfilItem[]>([])

  useEffect(() => {
    if (!profile?.org_id) return
    supabase
      .from('profiles')
      .select('id, nombre_completo')
      .eq('org_id', profile.org_id)
      .eq('activo', true)
      .order('nombre_completo')
      .then(({ data }) => { if (data) setPerfiles(data) })
  }, [profile?.org_id])

  // Form principal
  const [sheetAbierto, setSheetAbierto]     = useState(false)
  const [ranchoId, setRanchoId]             = useState('')
  const [fecha, setFecha]                   = useState(hoy())
  const [liberaciones, setLiberaciones]     = useState<FilaLiberacion[]>([])
  const [guardando, setGuardando]           = useState(false)
  const [errRancho, setErrRancho]           = useState(false)
  const [advertencias, setAdvertencias]     = useState<Advertencia[]>([])
  const [cargandoVerif, setCargandoVerif]   = useState(false)

  // Consolidado
  const [sheetConsAbierto, setSheetConsAbierto] = useState(false)
  const [consRanchoId, setConsRanchoId]         = useState('')
  const [consDesde, setConsDesde]               = useState('')
  const [consHasta, setConsHasta]               = useState(hoy())
  const [generandoCons, setGenerandoCons]       = useState(false)
  const [errConsRancho, setErrConsRancho]       = useState(false)
  const [errConsFechas, setErrConsFechas]       = useState(false)

  // PDF en historial
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  // ── Verificación de intervalo de seguridad (M1) ───────────────────────────

  useEffect(() => {
    if (!sheetAbierto || !ranchoId || !fecha || !profile?.org_id) {
      setAdvertencias([])
      return
    }
    let cancelado = false
    setCargandoVerif(true)

    supabase
      .from('aplicaciones')
      .select('fecha_aplicacion, aplicacion_productos(dias_cosecha, catalogo_productos(nombre_comercial))')
      .eq('rancho_id', ranchoId)
      .eq('org_id', profile.org_id)
      .lte('fecha_aplicacion', fecha)
      .order('fecha_aplicacion', { ascending: false })
      .limit(60)
      .then(({ data }) => {
        if (cancelado) return
        if (!data) { setCargandoVerif(false); return }

        const fechaCosecha = new Date(fecha + 'T12:00:00')
        const warns: Advertencia[] = []

        for (const app of data) {
          const productos = (app as any).aplicacion_productos ?? []
          for (const ap of productos) {
            if (!ap.dias_cosecha || ap.dias_cosecha <= 0) continue
            const fechaApp = new Date(app.fecha_aplicacion + 'T12:00:00')
            const fechaLimite = new Date(fechaApp)
            fechaLimite.setDate(fechaLimite.getDate() + ap.dias_cosecha)
            if (fechaCosecha <= fechaLimite) {
              warns.push({
                nombreProducto: (ap as any).catalogo_productos?.nombre_comercial ?? 'Producto desconocido',
                fechaAplicacion: app.fecha_aplicacion,
                diasCarencia: ap.dias_cosecha,
                fechaLimite: fechaLimite.toISOString().split('T')[0],
              })
            }
          }
        }

        setAdvertencias(warns)
        setCargandoVerif(false)
      })

    return () => { cancelado = true }
  }, [sheetAbierto, ranchoId, fecha, profile?.org_id])

  // ── Helpers del formulario ────────────────────────────────────────────────

  function abrirSheet() {
    setRanchoId('')
    setFecha(hoy())
    setLiberaciones([nuevaFila(profile?.id ?? '')])
    setErrRancho(false)
    setAdvertencias([])
    setSheetAbierto(true)
  }

  function agregarLiberacion() {
    setLiberaciones((prev) => [...prev, nuevaFila(profile?.id ?? '')])
  }

  function quitarLiberacion(idx: number) {
    setLiberaciones((prev) => prev.filter((_, i) => i !== idx))
  }

  function actualizarFila<K extends keyof FilaLiberacion>(
    idx: number, campo: K, valor: FilaLiberacion[K],
  ) {
    setLiberaciones((prev) =>
      prev.map((f, i) => i === idx ? { ...f, [campo]: valor } : f),
    )
  }

  // ── Guardar ───────────────────────────────────────────────────────────────

  async function handleGuardar() {
    if (!ranchoId) { setErrRancho(true); return }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }
    if (liberaciones.length === 0) { toast.warning('Agrega al menos una liberación'); return }

    setGuardando(true)
    try {
      const rows = liberaciones.map((lib) => ({
        rancho_id: ranchoId,
        org_id: profile.org_id,
        fecha,
        sector: lib.sector || null,
        cantidad_bandejas: lib.cantidad_bandejas ? parseInt(lib.cantidad_bandejas, 10) : null,
        lote_liberado: lib.lote_liberado,
        numero_comprobante: lib.numero_comprobante || null,
        codigo_trazabilidad: lib.codigo_trazabilidad || null,
        marca_embalaje: lib.marca_embalaje || null,
        destino_final: lib.destino_final || null,
        fruta_proceso_kg: lib.fruta_proceso_kg ? parseFloat(lib.fruta_proceso_kg) : null,
        encargado_liberacion_id: lib.encargado_liberacion_id || null,
        verificacion_semanal: lib.verificacion_semanal,
        hora_inicio_cosecha: lib.hora_inicio_cosecha || null,
        hora_fin_cosecha: lib.hora_fin_cosecha || null,
        observaciones: lib.observaciones || null,
      }))

      const { error } = await supabase.from('m10_cosecha_liberacion').insert(rows)
      if (error) throw error

      toast.success('Registro guardado')
      setSheetAbierto(false)
      await refetch()

      // PDF automático
      const rancho = ranchos.find((r) => r.id === ranchoId)
      if (rancho) {
        const pdfProps: CosechaLiberacionPaginaProps = {
          rancho: rancho.nombre,
          ranchoCodigo: rancho.codigo,
          fecha,
          liberaciones: liberaciones.map((lib) => ({
            sector: lib.sector || null,
            cantidad_bandejas: lib.cantidad_bandejas ? parseInt(lib.cantidad_bandejas, 10) : null,
            lote_liberado: lib.lote_liberado,
            numero_comprobante: lib.numero_comprobante || null,
            codigo_trazabilidad: lib.codigo_trazabilidad || null,
            marca_embalaje: lib.marca_embalaje || null,
            destino_final: lib.destino_final || null,
            fruta_proceso_kg: lib.fruta_proceso_kg ? parseFloat(lib.fruta_proceso_kg) : null,
            encargado_nombre: perfiles.find((p) => p.id === lib.encargado_liberacion_id)?.nombre_completo ?? null,
            verificacion_semanal: lib.verificacion_semanal,
            hora_inicio_cosecha: lib.hora_inicio_cosecha || null,
            hora_fin_cosecha: lib.hora_fin_cosecha || null,
            observaciones: lib.observaciones || null,
          })),
        }
        try {
          await generarCosechaLiberacionPDF(pdfProps)
        } catch {
          toast.warning('Registro guardado — el PDF no se pudo generar. Descárgalo desde el historial.')
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as any)?.message ?? ''
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(msg || 'No se pudo guardar el registro')
      }
    } finally {
      setGuardando(false)
    }
  }

  // ── Descargar PDF desde historial ─────────────────────────────────────────

  async function handleDescargarPDF(registro: M10Registro) {
    const key = `${registro.rancho_id}|${registro.fecha}`
    setGenerandoPDF(key)
    try {
      const pdfProps: CosechaLiberacionPaginaProps = {
        rancho: registro.rancho_nombre,
        ranchoCodigo: registro.rancho_codigo,
        fecha: registro.fecha,
        liberaciones: registro.liberaciones.map((lib) => ({
          sector: lib.sector,
          cantidad_bandejas: lib.cantidad_bandejas,
          lote_liberado: lib.lote_liberado,
          numero_comprobante: lib.numero_comprobante,
          codigo_trazabilidad: lib.codigo_trazabilidad,
          marca_embalaje: lib.marca_embalaje,
          destino_final: lib.destino_final,
          fruta_proceso_kg: lib.fruta_proceso_kg,
          encargado_nombre: lib.encargado_nombre,
          verificacion_semanal: lib.verificacion_semanal,
          hora_inicio_cosecha: lib.hora_inicio_cosecha,
          hora_fin_cosecha: lib.hora_fin_cosecha,
          observaciones: lib.observaciones,
        })),
      }
      await generarCosechaLiberacionPDF(pdfProps)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setGenerandoPDF(null)
    }
  }

  // ── Consolidado ───────────────────────────────────────────────────────────

  async function handleGenerarConsolidado() {
    let valido = true
    if (!consRanchoId) { setErrConsRancho(true); valido = false }
    if (!consDesde || !consHasta) { setErrConsFechas(true); valido = false }
    if (!valido) return
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }

    setGenerandoCons(true)
    try {
      const rancho = ranchos.find((r) => r.id === consRanchoId)
      await generarCosechaLiberacionConsolidadoPDF(
        consRanchoId,
        rancho?.nombre ?? 'Rancho',
        profile.org_id,
        consDesde,
        consHasta,
      )
      setSheetConsAbierto(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar el PDF consolidado')
    } finally {
      setGenerandoCons(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">

      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1 text-muted-foreground flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-foreground truncate" style={{ fontWeight: 600 }}>
              {TITULO_MODULO}
            </h1>
            <p className="text-xs text-muted-foreground">{CLAVE_MODULO}</p>
          </div>
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-primary" />
          </div>
        </div>
      </header>

      {/* Exportar consolidado */}
      <div className="px-4 pt-3">
        <button
          onClick={() => {
            setConsRanchoId('')
            setConsDesde('')
            setConsHasta(hoy())
            setErrConsRancho(false)
            setErrConsFechas(false)
            setSheetConsAbierto(true)
          }}
          className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-primary text-primary text-sm hover:bg-primary/5 transition-colors"
          style={{ fontWeight: 600 }}
        >
          <Files className="w-4 h-4" />
          Exportar consolidado
        </button>
      </div>

      {/* Historial */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : registros.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sin registros aún</p>
            <p className="text-xs text-muted-foreground mt-1">
              Toca + para registrar la primera liberación
            </p>
          </div>
        ) : (
          registros.map((reg) => {
            const key = `${reg.rancho_id}|${reg.fecha}`
            const lotesLiberados = reg.liberaciones.filter((l) => l.lote_liberado).length
            const totalBandejas  = reg.liberaciones.reduce((s, l) => s + (l.cantidad_bandejas ?? 0), 0)
            return (
              <div key={key} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                        {reg.rancho_nombre}
                      </span>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0"
                        style={{ fontWeight: 600 }}
                      >
                        {reg.liberaciones.length} {reg.liberaciones.length === 1 ? 'liberación' : 'liberaciones'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatFecha(reg.fecha)}</p>
                  </div>
                  <button
                    onClick={() => handleDescargarPDF(reg)}
                    disabled={generandoPDF === key}
                    className="p-2 text-muted-foreground hover:text-primary transition-colors flex-shrink-0 disabled:opacity-50"
                    title="Descargar PDF"
                  >
                    {generandoPDF === key ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Chips de resumen */}
                <div className="flex flex-wrap gap-1 mt-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      lotesLiberados === reg.liberaciones.length
                        ? 'bg-agro-success-fill text-agro-success-text'
                        : 'bg-agro-warning-fill text-agro-warning-text'
                    }`}
                  >
                    {lotesLiberados}/{reg.liberaciones.length} lotes liberados
                  </span>
                  {totalBandejas > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {totalBandejas} bandejas
                    </span>
                  )}
                </div>

                {/* Detalle de sectores */}
                <div className="mt-3 pt-3 border-t border-border space-y-1">
                  {reg.liberaciones.map((lib) => (
                    <div key={lib.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="text-foreground flex-shrink-0" style={{ fontWeight: 600 }}>
                        {lib.sector || '—'}
                      </span>
                      <span className="text-border">·</span>
                      <span
                        className={lib.lote_liberado ? 'text-agro-success-text' : 'text-agro-danger-text'}
                      >
                        {lib.lote_liberado ? 'Liberado' : 'No liberado'}
                      </span>
                      {lib.cantidad_bandejas != null && (
                        <>
                          <span className="text-border">·</span>
                          <span>{lib.cantidad_bandejas} bandejas</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-[calc(72px+34px+16px)] left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
        <button
          onClick={abrirSheet}
          className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg pointer-events-auto hover:bg-agro-blue transition-colors"
          aria-label="Nueva liberación"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* ── Bottom Sheet — Exportar consolidado ─────────────────────────────── */}
      {sheetConsAbierto && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setSheetConsAbierto(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 bg-card flex flex-col"
            style={{ borderRadius: '0.625rem 0.625rem 0 0', maxWidth: 390, margin: '0 auto' }}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                Exportar consolidado
              </h2>
              <button onClick={() => setSheetConsAbierto(false)} className="p-1">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  {terminosSitio.singular.toUpperCase()} *
                </label>
                <select
                  value={consRanchoId}
                  onChange={(e) => { setConsRanchoId(e.target.value); setErrConsRancho(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary ${
                    errConsRancho ? 'border-agro-red' : 'border-border'
                  } ${!consRanchoId ? 'text-muted-foreground' : 'text-foreground'}`}
                >
                  <option value="" disabled>Seleccionar {terminosSitio.singular.toLowerCase()}</option>
                  {ranchos.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
                {errConsRancho && <p className="text-xs text-agro-red mt-1">Selecciona {terminosSitio.genero === 'f' ? 'una' : 'un'} {terminosSitio.singular.toLowerCase()}</p>}
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  DESDE *
                </label>
                <input
                  type="date"
                  value={consDesde}
                  onChange={(e) => { setConsDesde(e.target.value); setErrConsFechas(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary ${
                    errConsFechas && !consDesde ? 'border-agro-red' : 'border-border'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  HASTA *
                </label>
                <input
                  type="date"
                  value={consHasta}
                  onChange={(e) => { setConsHasta(e.target.value); setErrConsFechas(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary ${
                    errConsFechas && !consHasta ? 'border-agro-red' : 'border-border'
                  }`}
                />
                {errConsFechas && <p className="text-xs text-agro-red mt-1">Indica el rango de fechas</p>}
              </div>
            </div>

            <div className="p-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGenerarConsolidado}
                disabled={generandoCons}
                className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
                style={{ fontWeight: 600 }}
              >
                {generandoCons && <Loader2 className="w-4 h-4 animate-spin" />}
                Generar PDF consolidado
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Bottom Sheet — Formulario ────────────────────────────────────────── */}
      {sheetAbierto && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setSheetAbierto(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 bg-card flex flex-col"
            style={{
              height: '85%',
              borderRadius: '0.625rem 0.625rem 0 0',
              maxWidth: 390,
              margin: '0 auto',
            }}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                Nueva liberación de cosecha
              </h2>
              <button onClick={() => setSheetAbierto(false)} className="p-1">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

              {/* Rancho */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  {terminosSitio.singular.toUpperCase()} *
                </label>
                <select
                  value={ranchoId}
                  onChange={(e) => { setRanchoId(e.target.value); setErrRancho(false) }}
                  className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                    errRancho ? 'border-agro-red' : 'border-border'
                  } ${!ranchoId ? 'text-muted-foreground' : 'text-foreground'}`}
                >
                  <option value="" disabled>Seleccionar {terminosSitio.singular.toLowerCase()}</option>
                  {ranchos.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
                {errRancho && <p className="text-xs text-agro-red mt-1">Selecciona {terminosSitio.genero === 'f' ? 'una' : 'un'} {terminosSitio.singular.toLowerCase()}</p>}
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  FECHA *
                </label>
                <input
                  type="date"
                  value={fecha}
                  min={esSuperAdmin ? undefined : hoy()}
                  max={esSuperAdmin ? undefined : hoy()}
                  onChange={(e) => { if (esSuperAdmin) setFecha(e.target.value) }}
                  className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Advertencias de intervalo de seguridad */}
              {cargandoVerif && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Verificando intervalos de seguridad…
                </div>
              )}
              {!cargandoVerif && advertencias.length > 0 && (
                <div
                  className="rounded-lg px-3 py-3"
                  style={{
                    backgroundColor: 'var(--agro-warning-fill)',
                    color: 'var(--agro-warning-text)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs" style={{ fontWeight: 700 }}>
                      Atención: verificar intervalos de seguridad
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {advertencias.map((w, i) => (
                      <p key={i} className="text-xs">
                        {w.nombreProducto} — aplicado el {formatFecha(w.fechaAplicacion)},
                        intervalo de {w.diasCarencia} días se cumple hasta el {formatFecha(w.fechaLimite)}.
                      </p>
                    ))}
                  </div>
                  <p className="text-xs mt-2 opacity-80">
                    El responsable decide según criterio de la empresa. Puedes continuar guardando.
                  </p>
                </div>
              )}

              {/* Lista de liberaciones */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                    LIBERACIONES
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {liberaciones.length} {liberaciones.length === 1 ? 'fila' : 'filas'}
                  </span>
                </div>

                <div className="space-y-4">
                  {liberaciones.map((lib, idx) => (
                    <div key={idx} className="bg-muted rounded-xl p-3 space-y-3">

                      {/* Encabezado de fila */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                          Liberación {idx + 1}
                        </span>
                        {liberaciones.length > 1 && (
                          <button
                            type="button"
                            onClick={() => quitarLiberacion(idx)}
                            className="p-1 text-agro-danger-text hover:opacity-70 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Sector */}
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Sector</label>
                        <input
                          type="text"
                          value={lib.sector}
                          onChange={(e) => actualizarFila(idx, 'sector', e.target.value)}
                          placeholder="Ej: Sector A-1"
                          className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      {/* Bandejas y lote liberado */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Cantidad de bandejas
                          </label>
                          <input
                            type="number"
                            value={lib.cantidad_bandejas}
                            onChange={(e) => actualizarFila(idx, 'cantidad_bandejas', e.target.value)}
                            placeholder="0"
                            min="0"
                            className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Lote liberado
                          </label>
                          <Toggle
                            activo={lib.lote_liberado}
                            onToggle={() => actualizarFila(idx, 'lote_liberado', !lib.lote_liberado)}
                          />
                        </div>
                      </div>

                      {/* No. comprobante */}
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          No. de comprobante o vale interno
                        </label>
                        <input
                          type="text"
                          value={lib.numero_comprobante}
                          onChange={(e) => actualizarFila(idx, 'numero_comprobante', e.target.value)}
                          placeholder="VAL-YYYY-000"
                          className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      {/* Código trazabilidad */}
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Código de trazabilidad
                        </label>
                        <input
                          type="text"
                          value={lib.codigo_trazabilidad}
                          onChange={(e) => actualizarFila(idx, 'codigo_trazabilidad', e.target.value)}
                          placeholder="Ej: HF-MX-A1-20260601"
                          className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                        />
                      </div>

                      {/* Marca embalaje */}
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Marca y embalaje
                        </label>
                        <input
                          type="text"
                          value={lib.marca_embalaje}
                          onChange={(e) => actualizarFila(idx, 'marca_embalaje', e.target.value)}
                          placeholder="Ej: Driscoll's"
                          className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      {/* Destino final */}
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Destino final
                        </label>
                        <input
                          type="text"
                          value={lib.destino_final}
                          onChange={(e) => actualizarFila(idx, 'destino_final', e.target.value)}
                          placeholder="Ej: Exportación USA"
                          className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      {/* Fruta proceso y verificación */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Fruta de proceso (Kg)
                          </label>
                          <input
                            type="number"
                            value={lib.fruta_proceso_kg}
                            onChange={(e) => actualizarFila(idx, 'fruta_proceso_kg', e.target.value)}
                            placeholder="0.0"
                            min="0"
                            step="0.1"
                            className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Verificación semanal
                          </label>
                          <Toggle
                            activo={lib.verificacion_semanal}
                            onToggle={() => actualizarFila(idx, 'verificacion_semanal', !lib.verificacion_semanal)}
                          />
                        </div>
                      </div>

                      {/* Encargado */}
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Encargado de la liberación del embarque
                        </label>
                        <select
                          value={lib.encargado_liberacion_id}
                          onChange={(e) => actualizarFila(idx, 'encargado_liberacion_id', e.target.value)}
                          className={`w-full h-10 px-3 rounded-lg bg-card border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                            !lib.encargado_liberacion_id ? 'text-muted-foreground' : 'text-foreground'
                          }`}
                        >
                          <option value="">Sin asignar</option>
                          {perfiles.map((p) => (
                            <option key={p.id} value={p.id}>{p.nombre_completo}</option>
                          ))}
                        </select>
                      </div>

                      {/* Horario de cosecha */}
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                          HORARIO DE COSECHA
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">
                              Hora inicio
                            </label>
                            <input
                              type="time"
                              value={lib.hora_inicio_cosecha}
                              onChange={(e) => actualizarFila(idx, 'hora_inicio_cosecha', e.target.value)}
                              className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">
                              Hora fin
                            </label>
                            <input
                              type="time"
                              value={lib.hora_fin_cosecha}
                              onChange={(e) => actualizarFila(idx, 'hora_fin_cosecha', e.target.value)}
                              className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Observaciones */}
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Observaciones (opcional)
                        </label>
                        <textarea
                          value={lib.observaciones}
                          onChange={(e) => actualizarFila(idx, 'observaciones', e.target.value)}
                          placeholder="Notas adicionales…"
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                        />
                      </div>

                    </div>
                  ))}
                </div>

                {/* Agregar liberación */}
                <button
                  type="button"
                  onClick={agregarLiberacion}
                  className="mt-3 w-full h-10 flex items-center justify-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground text-sm hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agregar liberación
                </button>
              </div>
            </div>

            {/* Footer del form */}
            <div className="px-4 pb-6 pt-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGuardar}
                disabled={guardando}
                className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
                style={{ fontWeight: 600 }}
              >
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar registro
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
