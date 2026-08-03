import { useState, useEffect } from 'react'
import {
  ChevronLeft, Plus, FileDown, X, Loader2, Droplets, Files,
  AlertTriangle, Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM12LimpiezaBanos, type M12Jornada } from '@/hooks/useM12LimpiezaBanos'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarLimpiezaBanosPDF } from '@/lib/pdf/m12/generarLimpiezaBanosPDF'
import { generarLimpiezaBanosConsolidadoPDF } from '@/lib/pdf/m12/generarLimpiezaBanosConsolidadoPDF'
import type { LimpiezaBanosPaginaProps } from '@/lib/pdf/m12/LimpiezaBanosPDF'
import { useModulosContext } from '@/context/ModulosContext'

// ── Constantes ────────────────────────────────────────────────────────────────

const TITULO_MODULO = 'Limpieza y Desinfección de Baños'
const CLAVE_MODULO  = 'MXA-F-SC-SIG-041.14 · Semanal'
const SUSTANCIAS_OPCIONES = ['Agua', 'Jabón', 'Cloro', 'Detergente']
const SUSTANCIAS_DEFAULT  = ['Agua', 'Jabón', 'Cloro']

// ── Tipos ─────────────────────────────────────────────────────────────────────

type FilaBano = {
  bano_numero: string
  limpieza: boolean
  desinfeccion: boolean
  concentracion_ppm: string
  sustancias: string[]
  abasto_papel: boolean
  succion: boolean
}

const BANO_INICIAL: FilaBano = {
  bano_numero: '',
  limpieza: true,
  desinfeccion: true,
  concentracion_ppm: '200',
  sustancias: [...SUSTANCIAS_DEFAULT],
  abasto_papel: true,
  succion: false,
}

const hoy = () => new Date().toISOString().split('T')[0]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function parsearErrorLimite(mensaje: string, singular = 'rancho'): string {
  const fechas = mensaje.match(/\d{2}\/\d{2}\/\d{4}/g)
  const proxima = fechas ? fechas[fechas.length - 1] : null
  return proxima
    ? `Ya se registró una limpieza de baños esta semana. Próxima disponible: ${proxima}.`
    : `Solo se permite un registro de limpieza por semana por ${singular}.`
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Toggle({
  activo,
  onToggle,
}: {
  activo: boolean
  onToggle: () => void
}) {
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

export function RegistroLimpiezaBanos() {
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const { ranchos } = useRanchos()
  const { jornadas, loading, refetch } = useM12LimpiezaBanos()
  const { terminosSitio } = useModulosContext()
  const orgNombre = useOrganizacion(profile?.org_id)

  // Form principal
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [ranchoId, setRanchoId]   = useState('')
  const [fecha, setFecha]         = useState(hoy())
  const [banos, setBanos]         = useState<FilaBano[]>([{ ...BANO_INICIAL }])
  const [guardando, setGuardando] = useState(false)
  const [errRancho, setErrRancho] = useState(false)
  const [limiteInfo, setLimiteInfo] = useState<{ proxima: string } | null>(null)

  // Consolidado
  const [sheetConsAbierto, setSheetConsAbierto] = useState(false)
  const [consRanchoId, setConsRanchoId] = useState('')
  const [consDesde, setConsDesde]       = useState('')
  const [consHasta, setConsHasta]       = useState(hoy())
  const [generandoCons, setGenerandoCons] = useState(false)
  const [errConsRancho, setErrConsRancho] = useState(false)
  const [errConsFechas, setErrConsFechas] = useState(false)

  // PDF en lista
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  // ── Prevención proactiva del límite semanal ─────────────────────────────────

  useEffect(() => {
    if (!sheetAbierto || !ranchoId || !fecha || !profile?.org_id) {
      setLimiteInfo(null)
      return
    }
    let cancelado = false
    const fechaDate = new Date(fecha + 'T12:00:00')
    const inicio = new Date(fechaDate)
    inicio.setDate(inicio.getDate() - 6)
    const inicioStr = inicio.toISOString().split('T')[0]

    supabase
      .from('m12_limpieza_banos')
      .select('fecha')
      .eq('org_id', profile.org_id)
      .eq('rancho_id', ranchoId)
      .gte('fecha', inicioStr)
      .lte('fecha', fecha)
      .order('fecha', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelado) return
        if (data && data.length > 0) {
          const ultimaDate = new Date(data[0].fecha + 'T12:00:00')
          const proximaDate = new Date(ultimaDate)
          proximaDate.setDate(proximaDate.getDate() + 7)
          setLimiteInfo({ proxima: formatFecha(proximaDate.toISOString().split('T')[0]) })
        } else {
          setLimiteInfo(null)
        }
      })
    return () => { cancelado = true }
  }, [sheetAbierto, ranchoId, fecha, profile?.org_id])

  // ── Helpers del formulario ─────────────────────────────────────────────────

  function abrirSheet() {
    setRanchoId('')
    setFecha(hoy())
    setBanos([{ ...BANO_INICIAL }])
    setErrRancho(false)
    setLimiteInfo(null)
    setSheetAbierto(true)
  }

  function agregarBano() {
    setBanos((prev) => [
      ...prev,
      {
        ...BANO_INICIAL,
        bano_numero: String(prev.length + 1),
        sustancias: [...SUSTANCIAS_DEFAULT],
      },
    ])
  }

  function quitarBano(idx: number) {
    setBanos((prev) => prev.filter((_, i) => i !== idx))
  }

  function actualizarBano<K extends keyof FilaBano>(idx: number, campo: K, valor: FilaBano[K]) {
    setBanos((prev) => prev.map((b, i) => i === idx ? { ...b, [campo]: valor } : b))
  }

  function toggleSustancia(idx: number, sustancia: string) {
    setBanos((prev) =>
      prev.map((b, i) => {
        if (i !== idx) return b
        const tiene = b.sustancias.includes(sustancia)
        return {
          ...b,
          sustancias: tiene
            ? b.sustancias.filter((s) => s !== sustancia)
            : [...b.sustancias, sustancia],
        }
      })
    )
  }

  // ── Guardar ─────────────────────────────────────────────────────────────────

  async function handleGuardar() {
    if (!ranchoId) { setErrRancho(true); return }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }
    if (banos.length === 0) { toast.warning('Agrega al menos un baño'); return }

    setGuardando(true)
    try {
      const rows = banos.map((b) => ({
        rancho_id: ranchoId,
        org_id: profile.org_id,
        fecha,
        bano_numero: b.bano_numero || String(banos.indexOf(b) + 1),
        limpieza: b.limpieza,
        desinfeccion: b.desinfeccion,
        concentracion_ppm: parseInt(b.concentracion_ppm, 10) || 200,
        sustancias: b.sustancias,
        abasto_papel: b.abasto_papel,
        succion: b.succion,
        realizado_por_id: profile.id,
      }))

      const { error } = await supabase.from('m12_limpieza_banos').insert(rows)
      if (error) throw error

      toast.success('Registro guardado')
      setSheetAbierto(false)
      await refetch()

      // Generar PDF automáticamente
      const rancho = ranchos.find((r) => r.id === ranchoId)
      if (rancho) {
        const pdfProps: LimpiezaBanosPaginaProps = {
          rancho: rancho.nombre,
          ranchoCodigo: rancho.codigo,
          fecha,
          banos: banos.map((b) => ({
            bano_numero: b.bano_numero || String(banos.indexOf(b) + 1),
            limpieza: b.limpieza,
            desinfeccion: b.desinfeccion,
            concentracion_ppm: parseInt(b.concentracion_ppm, 10) || 200,
            sustancias: b.sustancias,
            abasto_papel: b.abasto_papel,
            succion: b.succion,
          })),
        }
        try {
          await generarLimpiezaBanosPDF(pdfProps)
        } catch {
          toast.warning('Registro guardado — el PDF no se pudo generar. Descárgalo desde el historial.')
        }
      }
    } catch (err: unknown) {
      const mensaje = (err instanceof Error ? err.message : (err as any)?.message) ?? ''
      if (mensaje.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else if (mensaje.includes('M12_LIMITE_SEMANAL')) {
        toast.warning(parsearErrorLimite(mensaje, terminosSitio.singular.toLowerCase()), { duration: 7000 })
      } else {
        toast.error(mensaje || 'No se pudo guardar el registro')
      }
    } finally {
      setGuardando(false)
    }
  }

  // ── Descargar PDF desde historial ───────────────────────────────────────────

  async function handleDescargarPDF(jornada: M12Jornada) {
    const key = `${jornada.rancho_id}|${jornada.fecha}`
    setGenerandoPDF(key)
    try {
      const pdfProps: LimpiezaBanosPaginaProps = {
        rancho: jornada.rancho_nombre,
        ranchoCodigo: jornada.rancho_codigo,
        fecha: jornada.fecha,
        banos: jornada.banos.map((b) => ({
          bano_numero: b.bano_numero,
          limpieza: b.limpieza,
          desinfeccion: b.desinfeccion,
          concentracion_ppm: b.concentracion_ppm,
          sustancias: b.sustancias,
          abasto_papel: b.abasto_papel,
          succion: b.succion,
        })),
      }
      await generarLimpiezaBanosPDF(pdfProps)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setGenerandoPDF(null)
    }
  }

  // ── Consolidado ─────────────────────────────────────────────────────────────

  async function handleGenerarConsolidado() {
    let valido = true
    if (!consRanchoId) { setErrConsRancho(true); valido = false }
    if (!consDesde || !consHasta) { setErrConsFechas(true); valido = false }
    if (!valido) return
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }

    setGenerandoCons(true)
    try {
      const rancho = ranchos.find((r) => r.id === consRanchoId)
      await generarLimpiezaBanosConsolidadoPDF(
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

  // ── Render ──────────────────────────────────────────────────────────────────

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
            <Droplets className="w-5 h-5 text-primary" />
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
        ) : jornadas.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <Droplets className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sin registros aún</p>
            <p className="text-xs text-muted-foreground mt-1">
              Toca + para registrar la primera limpieza
            </p>
          </div>
        ) : (
          jornadas.map((jornada) => {
            const key = `${jornada.rancho_id}|${jornada.fecha}`
            const todosLimpieza = jornada.banos.every((b) => b.limpieza)
            const todosDesinfeccion = jornada.banos.every((b) => b.desinfeccion)
            return (
              <div key={key} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {orgNombre && (
                        <span className="text-xs text-muted-foreground font-medium">{orgNombre} ·</span>
                      )}
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                        {jornada.rancho_nombre}
                      </span>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0"
                        style={{ fontWeight: 600 }}
                      >
                        {jornada.banos.length} {jornada.banos.length === 1 ? 'baño' : 'baños'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatFecha(jornada.fecha)}</p>
                  </div>
                  <button
                    onClick={() => handleDescargarPDF(jornada)}
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

                {/* Chips de estado */}
                <div className="flex flex-wrap gap-1 mt-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      todosLimpieza
                        ? 'bg-agro-success-fill text-agro-success-text'
                        : 'bg-agro-warning-fill text-agro-warning-text'
                    }`}
                  >
                    {todosLimpieza ? 'Limpieza completa' : 'Limpieza parcial'}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      todosDesinfeccion
                        ? 'bg-agro-success-fill text-agro-success-text'
                        : 'bg-agro-warning-fill text-agro-warning-text'
                    }`}
                  >
                    {todosDesinfeccion ? 'Desinfección completa' : 'Desinfección parcial'}
                  </span>
                </div>

                {/* Detalle de baños */}
                <div className="mt-3 pt-3 border-t border-border space-y-1">
                  {jornada.banos.map((b) => (
                    <div key={b.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="w-16 text-foreground flex-shrink-0"
                        style={{ fontWeight: 600 }}
                      >
                        Baño {b.bano_numero}
                      </span>
                      <span className={b.limpieza ? 'text-agro-success-text' : 'text-agro-danger-text'}>
                        {b.limpieza ? 'Lavado' : 'Sin lavar'}
                      </span>
                      <span className="text-border">·</span>
                      <span className={b.desinfeccion ? 'text-agro-success-text' : 'text-agro-danger-text'}>
                        {b.desinfeccion ? 'Desinfectado' : 'Sin desinfectar'}
                      </span>
                      <span className="text-border">·</span>
                      <span>{b.concentracion_ppm} ppm</span>
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
          aria-label="Nueva limpieza"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* ── Bottom Sheet — Exportar consolidado ─────────────────────────────── */}
      <BottomSheet open={sheetConsAbierto} onClose={() => setSheetConsAbierto(false)}>
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
      </BottomSheet>

      {/* ── Bottom Sheet — Formulario ────────────────────────────────────────── */}
      <BottomSheet open={sheetAbierto} onClose={() => setSheetAbierto(false)} height="85%">
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                Nueva limpieza de baños
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

              {/* Banner límite semanal */}
              {limiteInfo && (
                <div
                  className="flex items-start gap-2 px-3 py-3 rounded-lg"
                  style={{
                    backgroundColor: 'var(--agro-warning-fill)',
                    color: 'var(--agro-warning-text)',
                  }}
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="text-xs" style={{ fontWeight: 600 }}>
                    Ya existe una limpieza registrada esta semana para {terminosSitio.genero === 'f' ? 'esta' : 'este'} {terminosSitio.singular.toLowerCase()}.
                    Próxima disponible: {limiteInfo.proxima}
                  </div>
                </div>
              )}

              {/* Lista de baños */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                    BAÑOS
                  </label>
                  <span className="text-xs text-muted-foreground">{banos.length} baño(s)</span>
                </div>

                <div className="space-y-4">
                  {banos.map((bano, idx) => (
                    <div key={idx} className="bg-muted rounded-xl p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                          Baño {idx + 1}
                        </span>
                        {banos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => quitarBano(idx)}
                            className="p-1 text-agro-danger-text hover:opacity-70 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Número de baño */}
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Número / identificador del baño
                        </label>
                        <input
                          type="text"
                          value={bano.bano_numero}
                          onChange={(e) => actualizarBano(idx, 'bano_numero', e.target.value)}
                          placeholder={`B${idx + 1}`}
                          className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      {/* Limpieza y Desinfección */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Limpieza (lavar y tallar)
                          </label>
                          <Toggle
                            activo={bano.limpieza}
                            onToggle={() => actualizarBano(idx, 'limpieza', !bano.limpieza)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Desinfección (3 ml cloro/L)
                          </label>
                          <Toggle
                            activo={bano.desinfeccion}
                            onToggle={() => actualizarBano(idx, 'desinfeccion', !bano.desinfeccion)}
                          />
                        </div>
                      </div>

                      {/* Concentración */}
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Concentración (ppm)
                        </label>
                        <input
                          type="number"
                          value={bano.concentracion_ppm}
                          onChange={(e) => actualizarBano(idx, 'concentracion_ppm', e.target.value)}
                          placeholder="200"
                          className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      {/* Sustancias */}
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">
                          Sustancias utilizadas
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {SUSTANCIAS_OPCIONES.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => toggleSustancia(idx, s)}
                              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                bano.sustancias.includes(s)
                                  ? 'bg-primary text-white'
                                  : 'bg-card border border-border text-muted-foreground'
                              }`}
                              style={{ fontWeight: 600 }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Abasto papel y Succión */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Abasto papel higiénico
                          </label>
                          <Toggle
                            activo={bano.abasto_papel}
                            onToggle={() => actualizarBano(idx, 'abasto_papel', !bano.abasto_papel)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Succión
                          </label>
                          <Toggle
                            activo={bano.succion}
                            onToggle={() => actualizarBano(idx, 'succion', !bano.succion)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Agregar baño */}
                <button
                  type="button"
                  onClick={agregarBano}
                  className="mt-3 w-full h-10 flex items-center justify-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground text-sm hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agregar baño
                </button>
              </div>
            </div>

            {/* Footer del form */}
            <div className="px-4 pb-6 pt-4 border-t border-border flex-shrink-0">
              <button
                onClick={handleGuardar}
                disabled={guardando || !!limiteInfo}
                className="w-full h-14 bg-primary text-white rounded-3xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-agro-blue transition-colors"
                style={{ fontWeight: 600 }}
              >
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar registro
              </button>
            </div>
      </BottomSheet>
    </div>
  )
}
