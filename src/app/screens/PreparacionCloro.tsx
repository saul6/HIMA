import { useState, useMemo } from 'react'
import {
  ChevronLeft, Plus, FileDown, Files, Loader2, FlaskConical,
  ChevronDown, ChevronUp, X,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM27PreparacionCloro, type M27Preparacion } from '@/hooks/useM27PreparacionCloro'
import { useOrganizacion } from '@/hooks/useOrganizacion'
import { supabase } from '@/lib/supabase'
import { generarPreparacionCloroPDF } from '@/lib/pdf/m27/generarPreparacionCloroPDF'
import { generarPreparacionCloroConsolidadoPDF } from '@/lib/pdf/m27/generarPreparacionCloroConsolidadoPDF'
import { useModulosContext } from '@/context/ModulosContext'

// ── Constantes ────────────────────────────────────────────────────────────────

const TITULO_MODULO = 'Preparación de Cloro a 200 ppm'
const CODIGO_FORMATO = 'F-FRUS-SAN-03'

// ── Helpers ───────────────────────────────────────────────────────────────────

function hoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function calcMlCloro(litros: number): number {
  return Math.round((litros * 10 / 3) * 100) / 100
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export function PreparacionCloro() {
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const { ranchos } = useRanchos()
  const { preparaciones, loading, refetch } = useM27PreparacionCloro()
  const { terminosSitio } = useModulosContext()
  const orgNombre = useOrganizacion(profile?.org_id)

  // Formulario
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [ranchoId, setRanchoId]           = useState('')
  const [fecha, setFecha]                 = useState(hoy())
  const [area, setArea]                   = useState('')
  const [litrosAgua, setLitrosAgua]       = useState('')
  const [responsable, setResponsable]     = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando]         = useState(false)
  const [errRancho, setErrRancho]         = useState(false)
  const [errArea, setErrArea]             = useState(false)
  const [errLitros, setErrLitros]         = useState(false)

  // Tabla de referencia
  const [refTablaAbierta, setRefTablaAbierta] = useState(false)

  // PDF individual en lista
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  // Consolidado
  const [sheetConsAbierto, setSheetConsAbierto]   = useState(false)
  const [consRanchoId, setConsRanchoId]           = useState('')
  const [consDesde, setConsDesde]                 = useState('')
  const [consHasta, setConsHasta]                 = useState(hoy())
  const [generandoCons, setGenerandoCons]         = useState(false)
  const [errConsRancho, setErrConsRancho]         = useState(false)
  const [errConsFechas, setErrConsFechas]         = useState(false)

  // Calculadora en vivo
  const litrosNum = parseFloat(litrosAgua)
  const mlCloroCalc = !isNaN(litrosNum) && litrosNum > 0 ? calcMlCloro(litrosNum) : null

  // Tabla de referencia 1–50 L
  const tablaReferencia = useMemo(() => {
    const filas: { litros: number; ml: number }[] = []
    for (let i = 1; i <= 50; i++) filas.push({ litros: i, ml: calcMlCloro(i) })
    return filas
  }, [])

  // ── Formulario ─────────────────────────────────────────────────────────────

  function abrirSheet() {
    setRanchoId(''); setFecha(hoy()); setArea(''); setLitrosAgua('')
    setResponsable(''); setObservaciones('')
    setErrRancho(false); setErrArea(false); setErrLitros(false)
    setSheetAbierto(true)
  }

  async function handleGuardar() {
    let valido = true
    if (!ranchoId) { setErrRancho(true); valido = false }
    if (!area.trim()) { setErrArea(true); valido = false }
    if (!litrosAgua || isNaN(litrosNum) || litrosNum <= 0) { setErrLitros(true); valido = false }
    if (!valido) return
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }

    setGuardando(true)
    try {
      const { data: insertado, error } = await (supabase as any)
        .from('m27_preparaciones')
        .insert({
          org_id: profile.org_id,
          rancho_id: ranchoId,
          fecha,
          area: area.trim(),
          litros_agua: litrosNum,
          responsable: responsable.trim() || null,
          observaciones: observaciones.trim() || null,
        })
        .select('id, ml_cloro')
        .single()

      if (error) throw error

      toast.success('Registro guardado')
      setSheetAbierto(false)
      await refetch()

      const rancho = ranchos.find((r) => r.id === ranchoId)
      if (rancho && insertado) {
        try {
          await generarPreparacionCloroPDF({
            rancho: rancho.nombre,
            orgNombre: orgNombre ?? null,
            fecha,
            area: area.trim(),
            litros_agua: litrosNum,
            ml_cloro: (insertado as any).ml_cloro ?? calcMlCloro(litrosNum),
            responsable: responsable.trim() || null,
            observaciones: observaciones.trim() || null,
          })
        } catch {
          toast.warning('Registro guardado — el PDF no se pudo generar. Descárgalo desde el historial.')
        }
      }
    } catch (err: unknown) {
      const mensaje = (err instanceof Error ? err.message : (err as any)?.message) ?? ''
      if (mensaje.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy.')
      } else {
        toast.error(mensaje || 'No se pudo guardar el registro')
      }
    } finally {
      setGuardando(false)
    }
  }

  // ── PDF individual desde lista ──────────────────────────────────────────────

  async function handleDescargarPDF(prep: M27Preparacion) {
    setGenerandoPDF(prep.id)
    try {
      await generarPreparacionCloroPDF({
        rancho: prep.rancho_nombre,
        orgNombre: orgNombre ?? null,
        fecha: prep.fecha,
        area: prep.area,
        litros_agua: prep.litros_agua,
        ml_cloro: prep.ml_cloro,
        responsable: prep.responsable,
        observaciones: prep.observaciones,
      })
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
      await generarPreparacionCloroConsolidadoPDF(
        consRanchoId,
        rancho?.nombre ?? terminosSitio.singular,
        orgNombre ?? undefined,
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
            <p className="text-xs text-muted-foreground">{CODIGO_FORMATO}</p>
          </div>
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <FlaskConical className="w-5 h-5 text-primary" />
          </div>
        </div>
      </header>

      {/* Exportar consolidado */}
      <div className="px-4 pt-3">
        <button
          onClick={() => {
            setConsRanchoId(''); setConsDesde(''); setConsHasta(hoy())
            setErrConsRancho(false); setErrConsFechas(false)
            setSheetConsAbierto(true)
          }}
          className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-primary text-primary text-sm hover:bg-primary/5 transition-colors"
          style={{ fontWeight: 600 }}
        >
          <Files className="w-4 h-4" />
          Exportar consolidado
        </button>
      </div>

      {/* Tabla de referencia plegable */}
      <div className="px-4 pt-3">
        <button
          onClick={() => setRefTablaAbierta((p) => !p)}
          className="w-full flex items-center justify-between px-4 py-3 bg-muted rounded-xl text-sm text-foreground"
          style={{ fontWeight: 600 }}
        >
          <span>Tabla de referencia (200 ppm)</span>
          {refTablaAbierta
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {refTablaAbierta && (
          <div className="mt-1 rounded-xl border border-border overflow-hidden">
            <div className="grid grid-cols-2 px-4 py-2 bg-primary">
              <span className="text-xs text-white" style={{ fontWeight: 600 }}>Litros de agua</span>
              <span className="text-xs text-white" style={{ fontWeight: 600 }}>mL de cloro</span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-border">
              {tablaReferencia.map(({ litros, ml }, i) => (
                <div
                  key={litros}
                  className={`grid grid-cols-2 px-4 py-1.5 ${i % 2 === 0 ? 'bg-card' : 'bg-muted/40'}`}
                >
                  <span className="text-sm text-foreground">{litros} L</span>
                  <span className="text-sm text-primary" style={{ fontWeight: 600 }}>{ml} mL</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-border" style={{ backgroundColor: 'var(--muted)' }}>
              <p className="text-xs text-muted-foreground">200 ppm · Cloro comercial ~6% · mL = Litros x 10/3</p>
            </div>
          </div>
        )}
      </div>

      {/* Lista de preparaciones */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : preparaciones.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <FlaskConical className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sin registros aún</p>
            <p className="text-xs text-muted-foreground mt-1">
              Toca + para registrar la primera preparación
            </p>
          </div>
        ) : (
          preparaciones.map((prep) => (
            <div key={prep.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {orgNombre && (
                      <span className="text-xs text-muted-foreground" style={{ fontWeight: 500 }}>
                        {orgNombre} ·
                      </span>
                    )}
                    <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                      {prep.rancho_nombre}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatFecha(prep.fecha)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{prep.area}</p>
                </div>
                <button
                  onClick={() => handleDescargarPDF(prep)}
                  disabled={generandoPDF === prep.id}
                  className="p-2 text-muted-foreground hover:text-primary transition-colors flex-shrink-0 disabled:opacity-50"
                  title="Descargar PDF"
                >
                  {generandoPDF === prep.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <FileDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Chips */}
              <div className="flex flex-wrap gap-2 mt-2">
                <span
                  className="text-[11px] px-2.5 py-1 rounded-lg"
                  style={{
                    fontWeight: 600,
                    backgroundColor: 'var(--agro-success-fill)',
                    color: 'var(--agro-success-text)',
                  }}
                >
                  {prep.litros_agua} L agua
                </span>
                <span
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-primary text-white"
                  style={{ fontWeight: 600 }}
                >
                  {prep.ml_cloro} mL cloro
                </span>
              </div>

              {/* Detalle opcional */}
              {(prep.responsable || prep.observaciones) && (
                <div className="mt-2 pt-2 border-t border-border space-y-0.5">
                  {prep.responsable && (
                    <p className="text-xs text-muted-foreground">Responsable: {prep.responsable}</p>
                  )}
                  {prep.observaciones && (
                    <p className="text-xs text-muted-foreground">{prep.observaciones}</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-[calc(72px+34px+16px)] left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
        <button
          onClick={abrirSheet}
          className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg pointer-events-auto hover:bg-agro-blue transition-colors"
          aria-label="Nueva preparación"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* ── Bottom Sheet — Consolidado ───────────────────────────────────────── */}
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
            {errConsRancho && (
              <p className="text-xs mt-1" style={{ color: 'var(--agro-red)' }}>
                Selecciona {terminosSitio.singular.toLowerCase()}
              </p>
            )}
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
            {errConsFechas && (
              <p className="text-xs mt-1" style={{ color: 'var(--agro-red)' }}>
                Indica el rango de fechas
              </p>
            )}
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
            Nueva preparación de cloro
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
            {errRancho && (
              <p className="text-xs mt-1" style={{ color: 'var(--agro-red)' }}>
                Selecciona {terminosSitio.singular.toLowerCase()}
              </p>
            )}
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

          {/* Área */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              ÁREA / PUNTO DE APLICACIÓN *
            </label>
            <input
              type="text"
              value={area}
              onChange={(e) => { setArea(e.target.value); setErrArea(false) }}
              placeholder="Ej. Baño general, Área de empaque..."
              className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                errArea ? 'border-agro-red' : 'border-border'
              }`}
            />
            {errArea && (
              <p className="text-xs mt-1" style={{ color: 'var(--agro-red)' }}>
                Indica el área de aplicación
              </p>
            )}
          </div>

          {/* Litros de agua */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              LITROS DE AGUA *
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={litrosAgua}
              onChange={(e) => { setLitrosAgua(e.target.value); setErrLitros(false) }}
              placeholder="Ej. 10"
              className={`w-full h-11 px-3 rounded-lg bg-input-background border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${
                errLitros ? 'border-agro-red' : 'border-border'
              }`}
            />
            {errLitros && (
              <p className="text-xs mt-1" style={{ color: 'var(--agro-red)' }}>
                Ingresa un valor mayor a 0
              </p>
            )}
          </div>

          {/* Calculadora en vivo */}
          <div
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{
              backgroundColor: mlCloroCalc !== null
                ? 'var(--agro-success-fill)'
                : 'var(--muted)',
            }}
          >
            <div>
              <p
                className="text-xs"
                style={{
                  fontWeight: 600,
                  color: mlCloroCalc !== null ? 'var(--agro-success-text)' : 'var(--muted-foreground)',
                }}
              >
                mL de cloro necesarios
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                200 ppm · cloro comercial ~6%
              </p>
            </div>
            <p
              className="text-2xl tabular-nums"
              style={{
                fontWeight: 700,
                color: mlCloroCalc !== null ? 'var(--agro-success-text)' : 'var(--muted-foreground)',
              }}
            >
              {mlCloroCalc !== null ? `${mlCloroCalc} mL` : '— mL'}
            </p>
          </div>

          {/* Responsable */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              RESPONSABLE
            </label>
            <input
              type="text"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              placeholder="Nombre del responsable"
              className="w-full h-11 px-3 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
              OBSERVACIONES
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg bg-input-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

        </div>

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
      </BottomSheet>

    </div>
  )
}
