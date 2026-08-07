import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router'
import {
  ChevronLeft, Plus, FileDown, Loader2, AlertCircle, TriangleAlert, PackageOpen,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import {
  useM43InspeccionAlmacen,
  type M43RegistroMensual,
  type M43DiaSummary,
  type M43Punto,
  type ValorM43,
} from '@/hooks/useM43InspeccionAlmacen'
import { generarInspeccionAlmacenEmpaquePDF } from '@/lib/pdf/m43/generarInspeccionAlmacenEmpaquePDF'
import { generarInspeccionAlmacenEmpaqueConsolidadoPDF } from '@/lib/pdf/m43/generarInspeccionAlmacenEmpaqueConsolidadoPDF'

// ── Helpers ───────────────────────────────────────────────────────────────────

function hoyMX() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

function formatMesLabel(mes: string): string {
  try {
    return new Date(mes + 'T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  } catch { return mes }
}

function siguienteValor(v: ValorM43): ValorM43 {
  if (v === 'cumple')    return 'no_cumple'
  if (v === 'no_cumple') return 'na'
  return 'cumple'
}

function valorLabel(v: ValorM43): string {
  if (v === 'cumple')    return 'Cumple'
  if (v === 'no_cumple') return 'No cumple'
  return 'N/A'
}

// ── DiaCard ───────────────────────────────────────────────────────────────────

function DiaCard({ dia, onClick }: { dia: M43DiaSummary; onClick: () => void }) {
  const fecha  = new Date(dia.fecha + 'T12:00:00')
  const diaNum = fecha.getDate()
  const mesStr = fecha.toLocaleDateString('es-MX', { month: 'short' })
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card rounded-xl p-4 border border-border"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--agro-success-fill)' }}
        >
          <span className="leading-none" style={{ fontSize: 15, fontWeight: 700, color: 'var(--agro-success-text)' }}>
            {diaNum}
          </span>
          <span style={{ fontSize: 9, color: 'var(--agro-success-text)' }}>{mesStr}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1">
            {dia.num_cumple > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}
              >
                C: {dia.num_cumple}
              </span>
            )}
            {dia.num_no_cumple > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)', fontWeight: 600 }}
              >
                NC: {dia.num_no_cumple}
              </span>
            )}
            {dia.num_na > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600 }}
              >
                N/A: {dia.num_na}
              </span>
            )}
          </div>
          {dia.acciones_tomadas && (
            <p className="text-xs text-muted-foreground truncate">{dia.acciones_tomadas}</p>
          )}
        </div>
        {dia.num_incidencias > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)', fontWeight: 600 }}
          >
            {dia.num_incidencias} M13
          </span>
        )}
        <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 flex-shrink-0" />
      </div>
    </button>
  )
}

// ── TogglePunto ───────────────────────────────────────────────────────────────

function TogglePunto({
  punto, valor, descripcion, onToggle, onDescripcion,
}: {
  punto: M43Punto
  valor: ValorM43
  descripcion: string
  onToggle: () => void
  onDescripcion: (v: string) => void
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3 text-left">
        <p className="flex-1 text-xs text-foreground">{punto.orden}. {punto.descripcion}</p>
        <span
          className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
          style={{
            fontWeight: 600,
            backgroundColor: valor === 'cumple'
              ? 'var(--agro-success-fill)'
              : valor === 'no_cumple'
              ? 'var(--agro-danger-fill)'
              : 'var(--muted)',
            color: valor === 'cumple'
              ? 'var(--agro-success-text)'
              : valor === 'no_cumple'
              ? 'var(--agro-danger-text)'
              : 'var(--muted-foreground)',
          }}
        >
          {valorLabel(valor)}
        </span>
      </button>
      {valor === 'no_cumple' && (
        <div className="px-3 pb-3 pt-0">
          <textarea
            value={descripcion}
            onChange={(e) => onDescripcion(e.target.value)}
            rows={2}
            placeholder="Descripción de incidencia (opcional — si se llena, se vincula a M13)"
            className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
          />
        </div>
      )}
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

type Vista = 'lista' | 'detalle'

export function InspeccionAlmacenEmpaque() {
  const { profile }        = useAuthContext()
  const { terminosSitio }  = useModulosContext()
  const { ranchos }        = useRanchos()
  const { registros, loading, error, refetch } = useM43InspeccionAlmacen()

  const mesActual    = hoyMX().slice(0, 7)
  const esSuperAdmin = profile?.rol === 'super_admin'
  const termino      = terminosSitio.singular

  // ── Catalog ──
  const [puntos, setPuntos] = useState<M43Punto[]>([])
  useEffect(() => {
    const tbl = supabase as any
    tbl.from('m43_puntos').select('id, orden, descripcion').order('orden')
      .then(({ data }: any) => { if (data) setPuntos(data as M43Punto[]) })
  }, [])

  // ── Vista ──
  const [vista, setVista]                   = useState<Vista>('lista')
  const [registroActivo, setRegistroActivo] = useState<M43RegistroMensual | null>(null)
  const [dias, setDias]                     = useState<M43DiaSummary[]>([])
  const [loadingDias, setLoadingDias]       = useState(false)

  const cargarDias = useCallback(async (regId: string) => {
    setLoadingDias(true)
    const tbl = supabase as any
    const { data } = await tbl
      .from('m43_dias')
      .select('id, fecha, acciones_tomadas, m43_resultados(id, punto_id, valor, incidencia_id)')
      .eq('registro_id', regId)
      .order('fecha', { ascending: true })
    if (data) {
      const mapped: M43DiaSummary[] = (data as any[]).map((d: any) => {
        const res: any[] = d.m43_resultados ?? []
        return {
          id:             d.id,
          fecha:          d.fecha,
          acciones_tomadas: d.acciones_tomadas ?? null,
          num_cumple:     res.filter((x: any) => x.valor === 'cumple').length,
          num_no_cumple:  res.filter((x: any) => x.valor === 'no_cumple').length,
          num_na:         res.filter((x: any) => x.valor === 'na').length,
          num_incidencias:res.filter((x: any) => x.incidencia_id).length,
        }
      })
      setDias(mapped)
    }
    setLoadingDias(false)
  }, [])

  function abrirDetalle(reg: M43RegistroMensual) {
    setRegistroActivo(reg)
    setObsLocal(reg.observaciones ?? '')
    setRealizadoPorLocal(reg.realizado_por ?? '')
    setVerificaLocal(reg.verifica ?? '')
    setAutorizaLocal(reg.autoriza ?? '')
    setVista('detalle')
    cargarDias(reg.id)
  }

  function volverALista() {
    setVista('lista')
    setRegistroActivo(null)
    setDias([])
  }

  const numIncidenciasTotal = useMemo(
    () => dias.reduce((acc, d) => acc + d.num_incidencias, 0),
    [dias],
  )

  // ── Encabezado editable ──
  const [obsLocal,          setObsLocal]          = useState('')
  const [realizadoPorLocal, setRealizadoPorLocal] = useState('')
  const [verificaLocal,     setVerificaLocal]     = useState('')
  const [autorizaLocal,     setAutorizaLocal]     = useState('')
  const [savingMeta,        setSavingMeta]         = useState(false)

  async function handleActualizarEncabezado() {
    if (!registroActivo || !profile?.org_id) return
    setSavingMeta(true)
    try {
      const { error: err } = await (supabase as any)
        .from('m43_registro_mensual')
        .update({
          realizado_por: realizadoPorLocal.trim() || null,
          verifica:      verificaLocal.trim() || null,
          autoriza:      autorizaLocal.trim() || null,
          observaciones: obsLocal.trim() || null,
        })
        .eq('id', registroActivo.id)
        .eq('org_id', profile.org_id)
      if (err) throw err
      toast.success('Encabezado actualizado')
      setRegistroActivo((prev) =>
        prev ? {
          ...prev,
          realizado_por: realizadoPorLocal.trim() || null,
          verifica:      verificaLocal.trim() || null,
          autoriza:      autorizaLocal.trim() || null,
          observaciones: obsLocal.trim() || null,
        } : null,
      )
      await refetch()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar')
    } finally {
      setSavingMeta(false)
    }
  }

  // ── Sheet: crear registro mensual ──
  const [sheetCrear,    setSheetCrear]    = useState(false)
  const [nRanchoId,     setNRanchoId]     = useState('')
  const [nMes,          setNMes]          = useState(mesActual)
  const [nRealizadoPor, setNRealizadoPor] = useState('')
  const [nVerifica,     setNVerifica]     = useState('')
  const [nAutoriza,     setNAutoriza]     = useState('')
  const [creando,       setCreando]       = useState(false)
  const [errRancho,     setErrRancho]     = useState(false)

  async function handleCrearRegistro() {
    if (!nRanchoId) { setErrRancho(true); return }
    if (!profile?.org_id) return
    setCreando(true)
    try {
      const { error: err } = await (supabase as any)
        .from('m43_registro_mensual')
        .insert({
          org_id:        profile.org_id,
          rancho_id:     nRanchoId,
          mes:           nMes + '-01',
          realizado_por: nRealizadoPor.trim() || null,
          verifica:      nVerifica.trim() || null,
          autoriza:      nAutoriza.trim() || null,
        })
      if (err) {
        const msg = err.message as string
        if (msg.includes('23505') || msg.includes('unique') || msg.includes('duplicate')) {
          toast.warning('Ya existe un registro para ese mes e instalación')
        } else {
          toast.error(msg)
        }
        return
      }
      toast.success('Registro mensual creado')
      setSheetCrear(false)
      setNRanchoId('')
      setNMes(mesActual)
      setNRealizadoPor('')
      setNVerifica('')
      setNAutoriza('')
      await refetch()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al crear registro')
    } finally {
      setCreando(false)
    }
  }

  // ── Sheet: agregar día ──
  const [sheetDia,       setSheetDia]       = useState(false)
  const [dFecha,         setDFecha]         = useState(hoyMX())
  const [dValores,       setDValores]       = useState<Record<string, ValorM43>>({})
  const [dDescripciones, setDDescripciones] = useState<Record<string, string>>({})
  const [dAcciones,      setDAcciones]      = useState('')
  const [dGuardando,     setDGuardando]     = useState(false)

  function abrirSheetDia() {
    const hoy = hoyMX()
    setDFecha(hoy)
    const init: Record<string, ValorM43> = {}
    for (const p of puntos) init[p.id] = 'cumple'
    setDValores(init)
    setDDescripciones({})
    setDAcciones('')
    setSheetDia(true)
  }

  async function handleGuardarDia() {
    if (!registroActivo || !profile?.org_id) return
    if (!dFecha) { toast.warning('Selecciona la fecha'); return }
    if (!esSuperAdmin && dFecha !== hoyMX()) {
      toast.warning('Solo puedes registrar con la fecha de hoy')
      return
    }
    setDGuardando(true)
    const tbl = supabase as any
    try {
      // 1. M13 para cada punto no_cumple con descripción
      const incMap: Record<string, string> = {}
      const itemsNoCumple = puntos.filter(
        (p) => (dValores[p.id] ?? 'cumple') === 'no_cumple' && dDescripciones[p.id]?.trim(),
      )
      if (itemsNoCumple.length > 0) {
        const { data: repData, error: repErr } = await tbl
          .from('m13_reportes')
          .insert({
            org_id:         profile.org_id,
            rancho_id:      registroActivo.rancho_id,
            fecha:          dFecha,
            auditor_nombre: profile.nombre_completo ?? null,
          })
          .select('id')
          .single()
        if (repErr) throw repErr
        const repId = repData.id as string
        for (let i = 0; i < itemsNoCumple.length; i++) {
          const punto = itemsNoCumple[i]
          const { data: incData, error: iErr } = await tbl
            .from('m13_incidencias')
            .insert({
              reporte_id:  repId,
              org_id:      profile.org_id,
              descripcion: dDescripciones[punto.id].trim(),
              orden:       i + 1,
            })
            .select('id')
            .single()
          if (iErr) throw iErr
          incMap[punto.id] = incData.id as string
        }
      }

      // 2. Insertar día
      const { data: diaData, error: dErr } = await tbl
        .from('m43_dias')
        .insert({
          registro_id:      registroActivo.id,
          org_id:           profile.org_id,
          fecha:            dFecha,
          acciones_tomadas: dAcciones.trim() || null,
        })
        .select('id')
        .single()
      if (dErr) throw dErr
      const diaId = diaData.id as string

      // 3. Batch insertar resultados
      const batch = puntos.map((p) => ({
        dia_id:       diaId,
        punto_id:     p.id,
        org_id:       profile.org_id,
        valor:        dValores[p.id] ?? 'cumple',
        incidencia_id: incMap[p.id] ?? null,
      }))
      const { error: bErr } = await tbl.from('m43_resultados').insert(batch)
      if (bErr) throw bErr

      const numInc  = Object.keys(incMap).length
      const msgExtra = numInc > 0 ? ` · ${numInc} incidencia${numInc > 1 ? 's' : ''} M13 vinculada${numInc > 1 ? 's' : ''}` : ''
      toast.success(`Día guardado${msgExtra}`)
      setSheetDia(false)
      cargarDias(registroActivo.id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar día'
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else if (msg.includes('23505') || msg.includes('unique') || msg.includes('duplicate')) {
        toast.warning('Ya existe una inspección para esa fecha')
      } else {
        toast.error(msg)
      }
    } finally {
      setDGuardando(false)
    }
  }

  // ── PDF individual ──
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)

  async function handlePDFIndividual(regId: string) {
    if (!profile?.org_id) return
    setGenerandoPDF(regId)
    try {
      await generarInspeccionAlmacenEmpaquePDF(regId, profile.org_id)
      toast.success('PDF descargado')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally {
      setGenerandoPDF(null)
    }
  }

  // ── Sheet: consolidado ──
  const [sheetConsolidado, setSheetConsolidado] = useState(false)
  const [cRanchoId,        setCRanchoId]        = useState('')
  const [cDesde,           setCDesde]           = useState(mesActual)
  const [cHasta,           setCHasta]           = useState(mesActual)
  const [cGenerando,       setCGenerando]       = useState(false)
  const [cErrRancho,       setCErrRancho]       = useState(false)

  async function handleConsolidado() {
    if (!cRanchoId) { setCErrRancho(true); return }
    if (!profile?.org_id) return
    setCGenerando(true)
    try {
      const instalacionNombre = ranchos.find((r) => r.id === cRanchoId)?.nombre ?? cRanchoId
      await generarInspeccionAlmacenEmpaqueConsolidadoPDF(
        cRanchoId, instalacionNombre, profile.org_id, cDesde, cHasta,
      )
      toast.success('PDF consolidado generado')
      setSheetConsolidado(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally {
      setCGenerando(false)
    }
  }

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: `${r.nombre} (${r.codigo})` }))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-card border-b border-border px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          {vista === 'detalle' ? (
            <button onClick={volverALista} className="p-1 -ml-1">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
          ) : (
            <Link to="/" className="p-1 -ml-1">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </Link>
          )}
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <PackageOpen className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            {vista === 'lista' ? (
              <>
                <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                  Inspección Almacén Empaque
                </h1>
                <div className="text-xs text-muted-foreground">Cuarto Frío · Mensual</div>
              </>
            ) : (
              <>
                <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                  {registroActivo ? formatMesLabel(registroActivo.mes) : '—'}
                </h1>
                <div className="text-xs text-muted-foreground truncate">
                  {registroActivo?.rancho_nombre ?? '—'}
                </div>
              </>
            )}
          </div>
          {vista === 'lista' && (
            <button
              onClick={() => setSheetConsolidado(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs text-foreground"
              style={{ fontWeight: 600 }}
            >
              <FileDown className="w-3.5 h-3.5" />
              Consolidado
            </button>
          )}
          {vista === 'detalle' && registroActivo && (
            <button
              onClick={() => handlePDFIndividual(registroActivo.id)}
              disabled={generandoPDF === registroActivo.id || dias.length === 0}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs text-foreground disabled:opacity-50"
              style={{ fontWeight: 600 }}
            >
              {generandoPDF === registroActivo.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              PDF mes
            </button>
          )}
        </div>
      </header>

      {/* ── LISTA ──────────────────────────────────────────────────────── */}
      {vista === 'lista' && (
        <div className="p-4 space-y-4">
          {error && (
            <div
              className="flex items-start gap-2 rounded-xl p-3"
              style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}
            >
              <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
              <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
                Error al cargar registros. Verifica tu conexión.
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : registros.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6 text-center">
              <PackageOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin registros aún</p>
              <p className="text-xs text-muted-foreground mt-1">
                Crea el primer registro mensual con el botón +
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {registros.map((reg) => (
                <button
                  key={reg.id}
                  onClick={() => abrirDetalle(reg)}
                  className="w-full text-left bg-card rounded-xl p-4 border border-border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: 'var(--agro-success-fill)',
                            color: 'var(--agro-success-text)',
                            fontWeight: 600,
                          }}
                        >
                          {formatMesLabel(reg.mes)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {reg.dias.length} día{reg.dias.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="text-sm text-foreground truncate block" style={{ fontWeight: 600 }}>
                        {reg.rancho_nombre}
                      </span>
                      {reg.realizado_por && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Realizado por: {reg.realizado_por}
                        </p>
                      )}
                    </div>
                    <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 flex-shrink-0 mt-0.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DETALLE ────────────────────────────────────────────────────── */}
      {vista === 'detalle' && registroActivo && (
        <div className="p-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <span
              className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
            >
              {formatMesLabel(registroActivo.mes)}
            </span>
            <span
              className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              {registroActivo.rancho_nombre} · {registroActivo.rancho_codigo}
            </span>
          </div>

          {numIncidenciasTotal > 0 && (
            <div
              className="flex items-start gap-2 rounded-xl p-3"
              style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
              <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
                {numIncidenciasTotal} incidencia{numIncidenciasTotal !== 1 ? 's' : ''} de M13 vinculada{numIncidenciasTotal !== 1 ? 's' : ''} este mes.
              </p>
            </div>
          )}

          {/* Encabezado editable */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h2 className="text-sm text-foreground" style={{ fontWeight: 600 }}>Encabezado del mes</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Realizado por</label>
                <input
                  type="text"
                  value={realizadoPorLocal}
                  onChange={(e) => setRealizadoPorLocal(e.target.value)}
                  placeholder="Nombre"
                  className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Verifica</label>
                <input
                  type="text"
                  value={verificaLocal}
                  onChange={(e) => setVerificaLocal(e.target.value)}
                  placeholder="Nombre"
                  className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Autoriza</label>
              <input
                type="text"
                value={autorizaLocal}
                onChange={(e) => setAutorizaLocal(e.target.value)}
                placeholder="Nombre (opcional)"
                className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Observaciones</label>
              <textarea
                value={obsLocal}
                onChange={(e) => setObsLocal(e.target.value)}
                rows={2}
                placeholder="Observaciones generales del mes…"
                className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <button
              onClick={handleActualizarEncabezado}
              disabled={savingMeta}
              className="h-9 px-4 rounded-xl text-sm text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
            >
              {savingMeta ? 'Guardando…' : 'Guardar encabezado'}
            </button>
          </div>

          {/* Días de inspección */}
          <div>
            <h2 className="text-sm text-foreground mb-3" style={{ fontWeight: 600 }}>
              Días de inspección
            </h2>
            {loadingDias ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : dias.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin días aún</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Registra el primer día con el botón +
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {dias.map((dia) => (
                  <DiaCard key={dia.id} dia={dia} onClick={() => {/* readonly — días ya guardados */}} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FAB ────────────────────────────────────────────────────────── */}
      <button
        onClick={() => {
          if (vista === 'lista') {
            setSheetCrear(true)
            setErrRancho(false)
          } else {
            abrirSheetDia()
          }
        }}
        className="fixed bottom-[calc(72px+16px)] right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40"
        style={{ backgroundColor: 'var(--primary)' }}
        aria-label="Agregar"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* ── Sheet: crear registro ──────────────────────────────────────── */}
      {sheetCrear && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={(e) => { if (e.target === e.currentTarget) setSheetCrear(false) }}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-card rounded-t-[10px] flex flex-col"
            style={{ maxHeight: '85dvh' }}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-4 flex-shrink-0" />
            <div className="px-4 pb-2 flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 700 }}>
                Nuevo registro mensual
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">{termino} *</label>
                <select
                  value={nRanchoId}
                  onChange={(e) => { setNRanchoId(e.target.value); setErrRancho(false) }}
                  className="w-full rounded-xl border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  style={{ borderColor: errRancho ? 'var(--agro-red)' : 'var(--border)' }}
                >
                  <option value="">Seleccionar…</option>
                  {ranchoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {errRancho && (
                  <p className="text-xs mt-1" style={{ color: 'var(--agro-danger-text)' }}>
                    Selecciona una {termino.toLowerCase()}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Mes</label>
                <input
                  type="month"
                  value={nMes}
                  max={esSuperAdmin ? undefined : mesActual}
                  onChange={(e) => { if (esSuperAdmin || e.target.value <= mesActual) setNMes(e.target.value) }}
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Realizado por</label>
                <input
                  type="text"
                  value={nRealizadoPor}
                  onChange={(e) => setNRealizadoPor(e.target.value)}
                  placeholder="Nombre del responsable"
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Verifica</label>
                <input
                  type="text"
                  value={nVerifica}
                  onChange={(e) => setNVerifica(e.target.value)}
                  placeholder="Nombre del verificador"
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Autoriza (opcional)</label>
                <input
                  type="text"
                  value={nAutoriza}
                  onChange={(e) => setNAutoriza(e.target.value)}
                  placeholder="Nombre del autorizador"
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={handleCrearRegistro}
                disabled={creando}
                className="w-full h-12 rounded-xl text-sm text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
              >
                {creando ? 'Creando…' : 'Crear registro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sheet: agregar día ─────────────────────────────────────────── */}
      {sheetDia && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={(e) => { if (e.target === e.currentTarget) setSheetDia(false) }}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-card rounded-t-[10px] flex flex-col"
            style={{ maxHeight: '85dvh' }}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-4 flex-shrink-0" />
            <div className="px-4 pb-2 flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 700 }}>
                Registrar día de inspección
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Fecha</label>
                <input
                  type="date"
                  value={dFecha}
                  min={esSuperAdmin ? undefined : hoyMX()}
                  max={esSuperAdmin ? undefined : hoyMX()}
                  onChange={(e) => { if (esSuperAdmin) setDFecha(e.target.value) }}
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Puntos de inspección */}
              <div>
                <h3 className="text-xs text-muted-foreground mb-2">
                  Puntos de inspección — toca para cambiar estado
                </h3>
                <div className="space-y-2">
                  {puntos.map((p) => (
                    <TogglePunto
                      key={p.id}
                      punto={p}
                      valor={dValores[p.id] ?? 'cumple'}
                      descripcion={dDescripciones[p.id] ?? ''}
                      onToggle={() =>
                        setDValores((prev) => ({ ...prev, [p.id]: siguienteValor(prev[p.id] ?? 'cumple') }))
                      }
                      onDescripcion={(v) =>
                        setDDescripciones((prev) => ({ ...prev, [p.id]: v }))
                      }
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Acciones tomadas (opcional)</label>
                <textarea
                  value={dAcciones}
                  onChange={(e) => setDAcciones(e.target.value)}
                  rows={2}
                  placeholder="Describe las acciones tomadas durante este día…"
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {puntos.some((p) => (dValores[p.id] ?? 'cumple') === 'no_cumple') && (
                <div
                  className="flex items-start gap-2 rounded-xl p-3"
                  style={{ backgroundColor: 'var(--agro-warning-fill)' }}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
                  <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                    Los puntos marcados "No cumple" con descripción generarán una incidencia M13 automáticamente.
                  </p>
                </div>
              )}

              <button
                onClick={handleGuardarDia}
                disabled={dGuardando || puntos.length === 0}
                className="w-full h-12 rounded-xl text-sm text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
              >
                {dGuardando ? 'Guardando…' : 'Guardar día'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sheet: consolidado ─────────────────────────────────────────── */}
      {sheetConsolidado && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={(e) => { if (e.target === e.currentTarget) setSheetConsolidado(false) }}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-card rounded-t-[10px] flex flex-col"
            style={{ maxHeight: '85dvh' }}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-4 flex-shrink-0" />
            <div className="px-4 pb-2 flex-shrink-0">
              <h2 className="text-base text-foreground" style={{ fontWeight: 700 }}>
                Exportar PDF consolidado
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">{termino} *</label>
                <select
                  value={cRanchoId}
                  onChange={(e) => { setCRanchoId(e.target.value); setCErrRancho(false) }}
                  className="w-full rounded-xl border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  style={{ borderColor: cErrRancho ? 'var(--agro-red)' : 'var(--border)' }}
                >
                  <option value="">Seleccionar…</option>
                  {ranchoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {cErrRancho && (
                  <p className="text-xs mt-1" style={{ color: 'var(--agro-danger-text)' }}>
                    Selecciona una {termino.toLowerCase()}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Desde (mes)</label>
                <input
                  type="month"
                  value={cDesde}
                  onChange={(e) => setCDesde(e.target.value)}
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Hasta (mes)</label>
                <input
                  type="month"
                  value={cHasta}
                  onChange={(e) => setCHasta(e.target.value)}
                  className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={handleConsolidado}
                disabled={cGenerando}
                className="w-full h-12 rounded-xl text-sm text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
              >
                {cGenerando ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando PDF…
                  </span>
                ) : 'Generar PDF consolidado'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
