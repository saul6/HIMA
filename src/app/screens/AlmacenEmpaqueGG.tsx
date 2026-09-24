// ╔══════════════════════════════════════════════════════════════════════╗
// ║  M75 — Inspección de Almacén de Material de Empaque (REG-22)       ║
// ║  Matriz mensual: 11 ítems × días 1–31 (SI/NO/NA) + Acciones/día    ║
// ║  org_id SIEMPRE del contexto de auth, nunca del input               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft, Plus, FileDown, X, Loader2, Package, TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import {
  useM75AlmacenEmpaqueGG,
  useM75ItemsCatalogo,
  cargarM75Resultados,
  cargarM75Acciones,
  type M75RegistroResumen,
  type M75Resultado,
  type M75Accion,
} from '@/hooks/useM75AlmacenEmpaqueGG'
import { supabase } from '@/lib/supabase'
import { Fab } from '@/app/components/Fab'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

// ── Constantes de layout ──────────────────────────────────────────────────────
const ITEM_COL_W = 140
const CELL_W = 30
const CELL_H = 30
const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)

// ── Helpers ───────────────────────────────────────────────────────────────────

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMesLabel(isoDate: string): string {
  try {
    const label = new Date(isoDate + 'T12:00:00').toLocaleDateString('es-MX', {
      month: 'long', year: 'numeric',
    })
    return label.charAt(0).toUpperCase() + label.slice(1)
  } catch { return isoDate }
}

type ValorCelda = 'si' | 'no' | 'na' | undefined

function siguienteValor(v: ValorCelda): ValorCelda {
  if (v === undefined) return 'si'
  if (v === 'si') return 'no'
  if (v === 'no') return 'na'
  return undefined
}

function celdasDesdeBD(resultados: M75Resultado[]): Record<string, ValorCelda> {
  const m: Record<string, ValorCelda> = {}
  for (const r of resultados) m[`${r.item_id}_${r.dia}`] = r.valor as ValorCelda
  return m
}

function accionesDesdeBD(acciones: M75Accion[]): Record<number, string> {
  const m: Record<number, string> = {}
  for (const a of acciones) m[a.dia] = a.texto
  return m
}

// ── Celda individual ──────────────────────────────────────────────────────────

function CeldaMatriz({ valor, onClick }: { valor: ValorCelda; onClick: () => void }) {
  let bg = 'transparent'
  let color = 'var(--muted-foreground)'
  let label = ''
  let borderColor = 'var(--border)'

  if (valor === 'si') { bg = 'var(--primary)'; color = '#fff'; label = 'S'; borderColor = 'var(--primary)' }
  else if (valor === 'no') { bg = 'var(--agro-red)'; color = '#fff'; label = 'N'; borderColor = 'var(--agro-red)' }
  else if (valor === 'na') { bg = 'var(--switch-background)'; color = 'var(--muted-foreground)'; label = '-'; borderColor = 'var(--switch-background)' }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: CELL_W, height: CELL_H, flexShrink: 0,
        backgroundColor: bg, border: `1px solid ${borderColor}`,
        color, fontSize: 10, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function LeyendaMatriz() {
  return (
    <div className="flex items-center gap-3 flex-wrap px-1 py-2">
      <div className="flex items-center gap-1">
        <div style={{ width: 16, height: 16, backgroundColor: 'var(--primary)', borderRadius: 2 }} />
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>S = Sí</span>
      </div>
      <div className="flex items-center gap-1">
        <div style={{ width: 16, height: 16, backgroundColor: 'var(--agro-red)', borderRadius: 2 }} />
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>N = No</span>
      </div>
      <div className="flex items-center gap-1">
        <div style={{ width: 16, height: 16, backgroundColor: 'var(--switch-background)', borderRadius: 2 }} />
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>- = N/A</span>
      </div>
      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Toca para cambiar</span>
    </div>
  )
}

// ── Tipo de vista ─────────────────────────────────────────────────────────────
type Vista = 'lista' | 'detalle'

// ── Pantalla principal ────────────────────────────────────────────────────────

export function AlmacenEmpaqueGG() {
  const { profile, user } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { registros, loading, error, refetch } = useM75AlmacenEmpaqueGG()
  const { items, loading: loadingItems } = useM75ItemsCatalogo()

  const termino = terminosSitio.singular
  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: r.nombre }))

  // Navegación interna
  const [vista, setVista] = useState<Vista>('lista')
  const [registroActivo, setRegistroActivo] = useState<M75RegistroResumen | null>(null)

  // Detalle campos editables
  const [dRealizo, setDRealizo] = useState('')
  const [dCultivo, setDCultivo] = useState('')
  const [dObservaciones, setDObservaciones] = useState('')
  const [celdas, setCeldas] = useState<Record<string, ValorCelda>>({})
  const [acciones, setAcciones] = useState<Record<number, string>>({})
  const [loadingCeldas, setLoadingCeldas] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const cargarCeldas = useCallback(async (regId: string) => {
    if (!profile?.org_id) return
    setLoadingCeldas(true)
    try {
      const [resultados, accs] = await Promise.all([
        cargarM75Resultados(regId, profile.org_id),
        cargarM75Acciones(regId, profile.org_id),
      ])
      setCeldas(celdasDesdeBD(resultados))
      setAcciones(accionesDesdeBD(accs))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar matriz')
    } finally {
      setLoadingCeldas(false)
    }
  }, [profile?.org_id])

  const abrirDetalle = (reg: M75RegistroResumen) => {
    setRegistroActivo(reg)
    setDRealizo(reg.realizo ?? '')
    setDCultivo(reg.cultivo ?? '')
    setDObservaciones(reg.observaciones ?? '')
    setCeldas({})
    setAcciones({})
    setVista('detalle')
    cargarCeldas(reg.id)
  }

  const volverALista = () => { setVista('lista'); setRegistroActivo(null); setCeldas({}); setAcciones({}) }

  function toggleCelda(itemId: string, dia: number) {
    const key = `${itemId}_${dia}`
    setCeldas((prev) => ({ ...prev, [key]: siguienteValor(prev[key]) }))
  }

  function setAccion(dia: number, texto: string) {
    setAcciones((prev) => ({ ...prev, [dia]: texto }))
  }

  async function handleGuardarDetalle() {
    if (!registroActivo || !profile?.org_id) return
    setGuardando(true)
    try {
      // 1. Update encabezado
      const { error: updErr } = await tbl('m75_registro')
        .update({
          realizo: dRealizo.trim() || null,
          cultivo: dCultivo.trim() || null,
          observaciones: dObservaciones.trim() || null,
        })
        .eq('id', registroActivo.id)
        .eq('org_id', profile.org_id)
      if (updErr) throw updErr

      // 2. Delete + re-insert resultados
      const { error: delErr } = await tbl('m75_resultados')
        .delete()
        .eq('registro_id', registroActivo.id)
        .eq('org_id', profile.org_id)
      if (delErr) throw delErr

      const batch = Object.entries(celdas)
        .filter(([, v]) => v !== undefined)
        .map(([key, v]) => {
          const [item_id, diaStr] = key.split('_')
          return {
            org_id: profile.org_id,
            registro_id: registroActivo.id,
            item_id,
            dia: parseInt(diaStr, 10),
            valor: v as string,
          }
        })

      if (batch.length > 0) {
        const { error: insErr } = await tbl('m75_resultados').insert(batch)
        if (insErr) throw insErr
      }

      // 3. Delete + re-insert acciones
      const { error: delAcc } = await tbl('m75_acciones')
        .delete()
        .eq('registro_id', registroActivo.id)
        .eq('org_id', profile.org_id)
      if (delAcc) throw delAcc

      const batchAcciones = Object.entries(acciones)
        .filter(([, texto]) => texto.trim())
        .map(([diaStr, texto]) => ({
          org_id: profile.org_id,
          registro_id: registroActivo.id,
          dia: parseInt(diaStr, 10),
          texto: texto.trim(),
        }))

      if (batchAcciones.length > 0) {
        const { error: insAcc } = await tbl('m75_acciones').insert(batchAcciones)
        if (insAcc) throw insAcc
      }

      await refetch()
      toast.success(`Guardado · ${batch.length} celda${batch.length !== 1 ? 's' : ''} · ${batchAcciones.length} acción${batchAcciones.length !== 1 ? 'es' : ''}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar'
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(msg)
      }
    } finally {
      setGuardando(false)
    }
  }

  // Sheet nuevo
  const [sheetNuevo, setSheetNuevo] = useState(false)
  const [nRanchoId, setNRanchoId] = useState('')
  const [nMes, setNMes] = useState(mesActual)
  const [nCultivo, setNCultivo] = useState('')
  const [nRealizo, setNRealizo] = useState('')
  const [nObservaciones, setNObservaciones] = useState('')
  const [nErrRancho, setNErrRancho] = useState(false)
  const [nYaExiste, setNYaExiste] = useState(false)
  const [nGuardando, setNGuardando] = useState(false)

  useEffect(() => {
    if (!sheetNuevo) { setNYaExiste(false); return }
    if (!nRanchoId || !nMes || !profile?.org_id) { setNYaExiste(false); return }
    let cancelado = false
    tbl('m75_registro')
      .select('id')
      .eq('org_id', profile.org_id)
      .eq('rancho_id', nRanchoId)
      .eq('mes', nMes + '-01')
      .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any }) => { if (!cancelado) setNYaExiste(!!data) })
    return () => { cancelado = true }
  }, [sheetNuevo, nRanchoId, nMes, profile?.org_id])

  async function handleCrearRegistro() {
    if (!nRanchoId) { setNErrRancho(true); return }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }
    if (nYaExiste) { toast.warning('Ya existe un registro para este mes y sitio'); return }
    setNGuardando(true)
    try {
      const { data, error: e } = await tbl('m75_registro')
        .insert({
          org_id: profile.org_id,
          rancho_id: nRanchoId,
          mes: nMes + '-01',
          cultivo: nCultivo.trim() || null,
          realizo: nRealizo.trim() || null,
          observaciones: nObservaciones.trim() || null,
          creado_por: user?.id ?? null,
        })
        .select('*, ranchos(nombre)')
        .single()
      if (e) throw e

      toast.success('Registro creado')
      setSheetNuevo(false)
      await refetch()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = data as any
      const nuevo: M75RegistroResumen = {
        id: r.id,
        rancho_id: r.rancho_id,
        rancho_nombre: r.ranchos?.nombre ?? '—',
        mes: r.mes,
        cultivo: r.cultivo ?? null,
        realizo: r.realizo ?? null,
        observaciones: r.observaciones ?? null,
        creado_por: r.creado_por ?? null,
        created_at: r.created_at,
      }
      abrirDetalle(nuevo)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('23505') || msg.includes('unique') || msg.includes('duplicate')) {
        toast.warning('Ya existe un registro para este mes y sitio')
      } else {
        toast.error(msg || 'Error al crear registro')
      }
    } finally {
      setNGuardando(false)
    }
  }

  return (
    <div className="min-h-full pb-safe-nav">

      {/* Header */}
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
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
          >
            <Package className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            {vista === 'lista' ? (
              <>
                <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                  Inspección Almacén de Empaque
                </h1>
                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  M75 · REG-22 · Gestión de campo
                </div>
              </>
            ) : (
              <>
                <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                  {registroActivo ? formatMesLabel(registroActivo.mes) : '—'}
                </h1>
                <div className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                  {registroActivo?.rancho_nombre ?? '—'}
                </div>
              </>
            )}
          </div>
          {vista === 'lista' && (
            <button
              onClick={() => toast.info('PDF próximamente')}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs text-foreground"
              style={{ borderColor: 'var(--border)', fontWeight: 600 }}
            >
              <FileDown className="w-3.5 h-3.5" />
              Exportar
            </button>
          )}
        </div>
      </header>

      {/* LISTA */}
      {vista === 'lista' && (
        <div className="p-4 space-y-4">
          {error && (
            <div
              className="flex items-start gap-2 rounded-xl p-3"
              style={{ backgroundColor: 'var(--agro-danger-fill)', border: '1px solid var(--agro-red)' }}
            >
              <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
              <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
          ) : registros.length === 0 ? (
            <div
              className="border rounded-xl p-6 text-center"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <Package className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin registros aún</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                Crea el primer registro mensual con el botón +
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {registros.map((reg) => (
                <button
                  key={reg.id}
                  onClick={() => abrirDetalle(reg)}
                  className="w-full text-left rounded-xl p-4 border"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}
                        >
                          {formatMesLabel(reg.mes)}
                        </span>
                        {reg.cultivo && (
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
                          >
                            {reg.cultivo}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                        {reg.rancho_nombre}
                      </span>
                      {reg.realizo && (
                        <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          Realizó: {reg.realizo}
                        </div>
                      )}
                    </div>
                    <ChevronLeft
                      className="w-4 h-4 flex-shrink-0 mt-0.5 rotate-180"
                      style={{ color: 'var(--muted-foreground)' }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DETALLE */}
      {vista === 'detalle' && registroActivo && (
        <div className="p-4 space-y-4 pb-32">
          {/* Chips */}
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
              {registroActivo.rancho_nombre}
            </span>
          </div>

          {/* Campos editables de encabezado */}
          <div
            className="border rounded-xl p-4 space-y-3"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-sm text-foreground" style={{ fontWeight: 600 }}>Datos del encabezado</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>Cultivo</label>
                <input type="text" value={dCultivo} onChange={(e) => setDCultivo(e.target.value)}
                  placeholder="Cultivo"
                  className="w-full h-9 px-3 rounded-lg border text-sm focus:outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
              </div>
              <div className="space-y-1">
                <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>Realizó</label>
                <input type="text" value={dRealizo} onChange={(e) => setDRealizo(e.target.value)}
                  placeholder="Responsable"
                  className="w-full h-9 px-3 rounded-lg border text-sm focus:outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>Observaciones</label>
              <textarea value={dObservaciones} onChange={(e) => setDObservaciones(e.target.value)} rows={2}
                placeholder="Observaciones generales del mes…"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none resize-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          {/* Matriz */}
          <div
            className="border rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-sm text-foreground" style={{ fontWeight: 600 }}>Matriz de inspección</h2>
              <LeyendaMatriz />
            </div>

            {(loadingCeldas || loadingItems) ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--primary)' }} />
              </div>
            ) : (
              <div style={{ overflow: 'auto', maxHeight: '60vh', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: ITEM_COL_W + DIAS.length * CELL_W }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          position: 'sticky', top: 0, left: 0, zIndex: 3,
                          width: ITEM_COL_W, minWidth: ITEM_COL_W, height: CELL_H,
                          backgroundColor: 'var(--background)',
                          borderBottom: '1px solid var(--border)',
                          borderRight: '1px solid var(--border)',
                          padding: '0 6px', fontSize: 10, fontWeight: 600,
                          color: 'var(--muted-foreground)', textAlign: 'left',
                        }}
                      >
                        Ítem
                      </th>
                      {DIAS.map((d) => (
                        <th key={d}
                          style={{
                            position: 'sticky', top: 0, zIndex: 2,
                            width: CELL_W, minWidth: CELL_W, height: CELL_H,
                            backgroundColor: 'var(--background)',
                            borderBottom: '1px solid var(--border)',
                            fontSize: 9, fontWeight: 600,
                            color: 'var(--muted-foreground)', textAlign: 'center',
                          }}
                        >
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td
                          style={{
                            position: 'sticky', left: 0, zIndex: 1,
                            width: ITEM_COL_W, minWidth: ITEM_COL_W, maxWidth: ITEM_COL_W,
                            backgroundColor: 'var(--background)',
                            borderRight: '1px solid var(--border)',
                            borderBottom: '1px solid var(--border)',
                            padding: '2px 6px', fontSize: 10,
                            color: 'var(--foreground)', verticalAlign: 'middle',
                          }}
                        >
                          <div style={{
                            overflow: 'hidden', display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.3',
                          }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{item.numero}.</span>
                            {' '}{item.texto}
                          </div>
                        </td>
                        {DIAS.map((dia) => (
                          <td key={dia}
                            style={{ padding: 0, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}
                          >
                            <CeldaMatriz
                              valor={celdas[`${item.id}_${dia}`]}
                              onClick={() => toggleCelda(item.id, dia)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Acciones por día */}
          <div
            className="border rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-sm text-foreground" style={{ fontWeight: 600 }}>Acción tomada por día</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                Registra la acción correctiva para cada día que lo requiera
              </p>
            </div>
            <div style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ display: 'flex', minWidth: DIAS.length * 80 + 16 }}>
                {DIAS.map((dia) => (
                  <div
                    key={dia}
                    style={{
                      width: 80, flexShrink: 0, padding: '8px 6px',
                      borderRight: '1px solid var(--border)',
                    }}
                  >
                    <div
                      className="text-center text-xs mb-1"
                      style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}
                    >
                      Día {dia}
                    </div>
                    <textarea
                      value={acciones[dia] ?? ''}
                      onChange={(e) => setAccion(dia, e.target.value)}
                      rows={3}
                      placeholder="—"
                      style={{
                        width: '100%',
                        fontSize: 10,
                        resize: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        padding: '4px',
                        backgroundColor: 'var(--input-background)',
                        color: 'var(--foreground)',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Botón guardar sticky */}
          <div
            className="sticky bottom-0 py-3 -mx-4 px-4"
            style={{ backgroundColor: 'var(--background)', borderTop: '1px solid var(--border)' }}
          >
            <button
              onClick={handleGuardarDetalle}
              disabled={guardando || loadingCeldas || loadingItems}
              className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
            >
              {guardando ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
              ) : (
                'Guardar registro'
              )}
            </button>
          </div>
        </div>
      )}

      {/* FAB — solo en lista */}
      {vista === 'lista' && (
                <Fab onClick={() => {
              setNRanchoId('')
              setNMes(mesActual())
              setNCultivo('')
              setNRealizo(profile?.nombre_completo ?? '')
              setNObservaciones('')
              setNErrRancho(false)
              setNYaExiste(false)
              setSheetNuevo(true)
            }} aria-label="Nuevo registro mensual" />
      )}

      {/* Sheet nuevo registro */}
      <BottomSheet open={sheetNuevo} onClose={() => setSheetNuevo(false)} height="85%">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Nuevo registro mensual</h2>
          <button onClick={() => setSheetNuevo(false)}>
            <X className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 pt-4">
          {/* Rancho */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
              {termino.toUpperCase()} *
            </label>
            <select
              value={nRanchoId}
              onChange={(e) => { setNRanchoId(e.target.value); setNErrRancho(false) }}
              className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
              style={{ borderColor: nErrRancho ? 'var(--agro-red)' : 'var(--border)', backgroundColor: 'var(--input-background)' }}
            >
              <option value="">Selecciona {termino.toLowerCase()}…</option>
              {ranchoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {nErrRancho && <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Requerido</p>}
          </div>

          {/* Mes */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>MES DE REGISTRO *</label>
            <input type="month" value={nMes} onChange={(e) => setNMes(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
          </div>

          {/* Cultivo */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>CULTIVO</label>
            <input type="text" value={nCultivo} onChange={(e) => setNCultivo(e.target.value)} placeholder="Ej: Zarzamora"
              className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
          </div>

          {/* Realizó */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>REALIZÓ</label>
            <input type="text" value={nRealizo} onChange={(e) => setNRealizo(e.target.value)} placeholder="Nombre del responsable"
              className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
          </div>

          {/* Observaciones */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>OBSERVACIONES</label>
            <textarea value={nObservaciones} onChange={(e) => setNObservaciones(e.target.value)} rows={2}
              placeholder="Observaciones generales…"
              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none resize-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
          </div>

          {nYaExiste && (
            <div
              className="flex items-start gap-2 rounded-xl p-3"
              style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid var(--agro-amber)' }}
            >
              <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
              <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                Ya existe un registro para este mes y {termino.toLowerCase()}.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleCrearRegistro}
            disabled={nGuardando || nYaExiste || !nRanchoId}
            className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
          >
            {nGuardando ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</> : 'Crear registro'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
