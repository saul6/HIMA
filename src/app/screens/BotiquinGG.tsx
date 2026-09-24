// ╔══════════════════════════════════════════════════════════════════════╗
// ║  M73 — Inventario de Material de Curación (Botiquín GlobalGAP)     ║
// ║  Registro con detalle de movimientos de materiales                  ║
// ║  org_id SIEMPRE del contexto de auth, nunca del input               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { useState, useCallback } from 'react'
import {
  ChevronLeft, Plus, X, Loader2, ShieldPlus, TriangleAlert, Trash2,
} from 'lucide-react'
import { Link } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import {
  useM73BotiquinGG,
  useM73Catalogo,
  type M73RegistroResumen,
} from '@/hooks/useM73BotiquinGG'
import { supabase } from '@/lib/supabase'
import { Fab } from '@/app/components/Fab'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function hoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

interface FilaMaterial {
  material_id: string | null
  material_otro: string
  sale: string
  entra: string
  total: string
  usuario: string
}

function filaVacia(materialId: string | null = null, materialNombre = ''): FilaMaterial {
  return { material_id: materialId, material_otro: materialNombre, sale: '', entra: '', total: '', usuario: '' }
}

export function BotiquinGG() {
  const { profile, user } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { registros, loading, error, refetch } = useM73BotiquinGG()
  const { items: catalogo, loading: loadingCatalogo } = useM73Catalogo()

  const termino = terminosSitio.singular

  // Sheet estado
  const [sheetNuevo, setSheetNuevo] = useState(false)
  const [nRanchoId, setNRanchoId] = useState('')
  const [nFecha, setNFecha] = useState(hoy)
  const [nBotiquinNum, setNBotiquinNum] = useState('')
  const [nRealizo, setNRealizo] = useState('')
  const [nObservaciones, setNObservaciones] = useState('')
  const [nErrRancho, setNErrRancho] = useState(false)
  const [nGuardando, setNGuardando] = useState(false)

  // Filas de materiales del catálogo + filas extras
  const [filasCatalogo, setFilasCatalogo] = useState<FilaMaterial[]>([])
  const [filasExtra, setFilasExtra] = useState<FilaMaterial[]>([])

  const abrirSheet = useCallback(() => {
    setNRanchoId('')
    setNFecha(hoy())
    setNBotiquinNum('')
    setNRealizo(profile?.nombre_completo ?? '')
    setNObservaciones('')
    setNErrRancho(false)
    // Inicializar filas con el catálogo
    setFilasCatalogo(catalogo.map((c) => filaVacia(c.id, c.nombre)))
    setFilasExtra([])
    setSheetNuevo(true)
  }, [catalogo, profile?.nombre_completo])

  function actualizarFilaCatalogo(idx: number, campo: keyof FilaMaterial, valor: string) {
    setFilasCatalogo((prev) => prev.map((f, i) => i === idx ? { ...f, [campo]: valor } : f))
  }

  function actualizarFilaExtra(idx: number, campo: keyof FilaMaterial, valor: string) {
    setFilasExtra((prev) => prev.map((f, i) => i === idx ? { ...f, [campo]: valor } : f))
  }

  function agregarFilaExtra() {
    setFilasExtra((prev) => [...prev, filaVacia(null, '')])
  }

  function eliminarFilaExtra(idx: number) {
    setFilasExtra((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleGuardar() {
    if (!nRanchoId) { setNErrRancho(true); return }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }

    setNGuardando(true)
    try {
      // 1. INSERT encabezado
      const { data, error: e1 } = await tbl('m73_registro')
        .insert({
          org_id: profile.org_id,
          rancho_id: nRanchoId,
          fecha: nFecha,
          botiquin_num: nBotiquinNum.trim() || null,
          realizo: nRealizo.trim() || null,
          observaciones: nObservaciones.trim() || null,
          creado_por: user?.id ?? null,
        })
        .select('id')
        .single()
      if (e1) throw e1

      const registroId = (data as { id: string }).id

      // 2. INSERT resultados (solo filas con al menos un valor)
      const todasFilas = [
        ...filasCatalogo.map((f) => ({ ...f, tipo: 'catalogo' })),
        ...filasExtra.map((f) => ({ ...f, tipo: 'extra' })),
      ]

      const batch = todasFilas
        .filter((f) => f.sale || f.entra || f.total || f.usuario)
        .map((f) => ({
          org_id: profile.org_id,
          registro_id: registroId,
          material_id: f.material_id || null,
          material_otro: f.tipo === 'extra' ? (f.material_otro.trim() || null) : null,
          sale: f.sale ? parseFloat(f.sale) : null,
          entra: f.entra ? parseFloat(f.entra) : null,
          total: f.total ? parseFloat(f.total) : null,
          usuario: f.usuario.trim() || null,
        }))

      if (batch.length > 0) {
        const { error: e2 } = await tbl('m73_resultados').insert(batch)
        if (e2) throw e2
      }

      toast.success('Registro guardado')
      setSheetNuevo(false)
      await refetch()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(msg || 'Error al guardar')
      }
    } finally {
      setNGuardando(false)
    }
  }

  async function handleEliminar(reg: M73RegistroResumen) {
    if (!profile?.org_id) return
    const esAdmin = profile.rol === 'admin_org' || profile.rol === 'super_admin'
    const esMio = reg.creado_por === user?.id
    if (!esAdmin && !esMio) { toast.error('No tienes permiso para eliminar este registro'); return }
    if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return

    try {
      await tbl('m73_resultados').delete().eq('registro_id', reg.id).eq('org_id', profile.org_id)
      const { error } = await tbl('m73_registro').delete().eq('id', reg.id).eq('org_id', profile.org_id)
      if (error) throw error
      toast.success('Registro eliminado')
      await refetch()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: r.nombre }))

  return (
    <div className="min-h-full pb-safe-nav">

      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1 -ml-1">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </Link>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
          >
            <ShieldPlus className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
              Inventario de Material de Curación
            </h1>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              M73 · Botiquín GlobalGAP · Seguridad
            </div>
          </div>
        </div>
      </header>

      {/* Lista */}
      <div className="p-4 space-y-3">
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
            <ShieldPlus className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin registros aún</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Crea el primer registro con el botón +
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {registros.map((reg) => {
              const esAdmin = profile?.rol === 'admin_org' || profile?.rol === 'super_admin'
              const esMio = reg.creado_por === user?.id
              return (
                <div
                  key={reg.id}
                  className="rounded-xl p-4 border"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}
                        >
                          {formatFecha(reg.fecha)}
                        </span>
                        {reg.total_materiales > 0 && (
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 600 }}
                          >
                            {reg.total_materiales} material{reg.total_materiales !== 1 ? 'es' : ''}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                        {reg.rancho_nombre}
                      </span>
                      {reg.botiquin_num && (
                        <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          Botiquín: {reg.botiquin_num}
                        </div>
                      )}
                      {reg.realizo && (
                        <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          Realizó: {reg.realizo}
                        </div>
                      )}
                    </div>
                    {(esAdmin || esMio) && (
                      <button
                        onClick={() => handleEliminar(reg)}
                        className="p-2 flex-shrink-0"
                        style={{ color: 'var(--muted-foreground)' }}
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* FAB */}
            <Fab onClick={abrirSheet} aria-label="Nuevo registro" />

      {/* Sheet nuevo registro */}
      <BottomSheet open={sheetNuevo} onClose={() => setSheetNuevo(false)} height="85%">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
            Nuevo registro de botiquín
          </h2>
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
              style={{
                borderColor: nErrRancho ? 'var(--agro-red)' : 'var(--border)',
                backgroundColor: 'var(--input-background)',
              }}
            >
              <option value="">Selecciona {termino.toLowerCase()}…</option>
              {ranchoOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {nErrRancho && <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Requerido</p>}
          </div>

          {/* Fecha */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>FECHA</label>
            <input
              type="date"
              value={nFecha}
              onChange={(e) => setNFecha(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
            />
          </div>

          {/* Botiquín num y quién realizó */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>N° BOTIQUÍN</label>
              <input
                type="text"
                value={nBotiquinNum}
                onChange={(e) => setNBotiquinNum(e.target.value)}
                placeholder="Ej: B-01"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>REALIZÓ</label>
              <input
                type="text"
                value={nRealizo}
                onChange={(e) => setNRealizo(e.target.value)}
                placeholder="Nombre"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
              />
            </div>
          </div>

          {/* Tabla de materiales */}
          <div>
            <label className="text-xs mb-2 block" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
              MATERIALES
            </label>
            {loadingCatalogo ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--primary)' }} />
              </div>
            ) : (
              <div
                className="border rounded-xl overflow-hidden"
                style={{ borderColor: 'var(--border)' }}
              >
                {/* Encabezado tabla */}
                <div
                  className="grid text-xs px-3 py-2"
                  style={{
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr',
                    backgroundColor: 'var(--muted)',
                    color: 'var(--muted-foreground)',
                    fontWeight: 600,
                    gap: '0.5rem',
                  }}
                >
                  <span>Material</span>
                  <span className="text-center">Sale</span>
                  <span className="text-center">Entra</span>
                  <span className="text-center">Total</span>
                  <span>Usuario</span>
                </div>

                {/* Filas catálogo */}
                {filasCatalogo.map((fila, idx) => (
                  <div
                    key={`cat-${idx}`}
                    className="grid px-3 py-1.5 border-t items-center"
                    style={{
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr',
                      borderColor: 'var(--border)',
                      gap: '0.5rem',
                    }}
                  >
                    <span className="text-xs text-foreground truncate">{fila.material_otro}</span>
                    {(['sale', 'entra', 'total'] as const).map((campo) => (
                      <input
                        key={campo}
                        type="number"
                        min="0"
                        step="1"
                        value={fila[campo]}
                        onChange={(e) => actualizarFilaCatalogo(idx, campo, e.target.value)}
                        className="w-full h-8 px-1 rounded border text-center text-xs focus:outline-none"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
                        placeholder="0"
                      />
                    ))}
                    <input
                      type="text"
                      value={fila.usuario}
                      onChange={(e) => actualizarFilaCatalogo(idx, 'usuario', e.target.value)}
                      className="w-full h-8 px-2 rounded border text-xs focus:outline-none"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
                      placeholder="—"
                    />
                  </div>
                ))}

                {/* Filas extra */}
                {filasExtra.map((fila, idx) => (
                  <div
                    key={`extra-${idx}`}
                    className="grid px-3 py-1.5 border-t items-center"
                    style={{
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr auto',
                      borderColor: 'var(--border)',
                      gap: '0.5rem',
                    }}
                  >
                    <input
                      type="text"
                      value={fila.material_otro}
                      onChange={(e) => actualizarFilaExtra(idx, 'material_otro', e.target.value)}
                      className="w-full h-8 px-2 rounded border text-xs focus:outline-none"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
                      placeholder="Otro material…"
                    />
                    {(['sale', 'entra', 'total'] as const).map((campo) => (
                      <input
                        key={campo}
                        type="number"
                        min="0"
                        step="1"
                        value={fila[campo]}
                        onChange={(e) => actualizarFilaExtra(idx, campo, e.target.value)}
                        className="w-full h-8 px-1 rounded border text-center text-xs focus:outline-none"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
                        placeholder="0"
                      />
                    ))}
                    <input
                      type="text"
                      value={fila.usuario}
                      onChange={(e) => actualizarFilaExtra(idx, 'usuario', e.target.value)}
                      className="w-full h-8 px-2 rounded border text-xs focus:outline-none"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
                      placeholder="—"
                    />
                    <button onClick={() => eliminarFilaExtra(idx)} className="p-1">
                      <X className="w-3.5 h-3.5" style={{ color: 'var(--agro-red)' }} />
                    </button>
                  </div>
                ))}

                {/* Agregar otro */}
                <div className="border-t px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={agregarFilaExtra}
                    className="flex items-center gap-1.5 text-xs"
                    style={{ color: 'var(--primary)', fontWeight: 600 }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar otro material
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>OBSERVACIONES</label>
            <textarea
              value={nObservaciones}
              onChange={(e) => setNObservaciones(e.target.value)}
              rows={2}
              placeholder="Observaciones generales…"
              className="w-full rounded-xl border px-3 py-2 text-sm text-foreground focus:outline-none resize-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
            />
          </div>
        </div>

        {/* Botón guardar */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleGuardar}
            disabled={nGuardando || !nRanchoId}
            className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
          >
            {nGuardando ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
            ) : (
              'Guardar registro'
            )}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
