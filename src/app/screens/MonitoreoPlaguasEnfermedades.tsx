import { useState } from 'react'
import { ChevronLeft, Plus, X, Loader2, Sprout, Files } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import {
  useM72MonitoreoPlaguasEnfermedades,
  useM72Organismos,
} from '@/hooks/useM72MonitoreoPlaguasEnfermedades'
import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)
const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

function formatFecha(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

type FilaPlanta = {
  id: string
  sector: string
  num_planta: string
  conteos: Record<string, string> // organismo_id → conteo string
}

function filaPlantaVacia(): FilaPlanta {
  return { id: crypto.randomUUID(), sector: '', num_planta: '', conteos: {} }
}

type FormEncabezado = {
  rancho_id: string
  fecha: string
  etapa: string
  realizo: string
  beneficos: string
  observaciones: string
}

const FORM_VACIO: FormEncabezado = {
  rancho_id: '',
  fecha: hoyMX(),
  etapa: '',
  realizo: '',
  beneficos: '',
  observaciones: '',
}

export function MonitoreoPlaguasEnfermedades() {
  const navigate = useNavigate()
  const { profile, user } = useAuthContext()
  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const { terminosSitio } = useModulosContext()
  const orgId = profile?.org_id ?? null
  const { ranchos } = useRanchos(orgId)
  const { registros, loading, refetch } = useM72MonitoreoPlaguasEnfermedades(orgId)
  const { organismos } = useM72Organismos()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [consolidadoOpen, setConsolidadoOpen] = useState(false)
  const [form, setForm] = useState<FormEncabezado>(FORM_VACIO)
  const [filas, setFilas] = useState<FilaPlanta[]>([filaPlantaVacia(), filaPlantaVacia()])
  const [guardando, setGuardando] = useState(false)

  function abrirNuevo() {
    setForm({ ...FORM_VACIO, fecha: hoyMX() })
    setFilas([filaPlantaVacia(), filaPlantaVacia()])
    setSheetOpen(true)
  }

  function agregarFila() {
    setFilas(f => [...f, filaPlantaVacia()])
  }

  function eliminarFila(id: string) {
    setFilas(f => f.length > 1 ? f.filter(x => x.id !== id) : f)
  }

  function actualizarFila(id: string, campo: 'sector' | 'num_planta', valor: string) {
    setFilas(f => f.map(x => x.id === id ? { ...x, [campo]: valor } : x))
  }

  function actualizarConteo(filaId: string, orgId2: string, valor: string) {
    setFilas(f => f.map(x =>
      x.id === filaId ? { ...x, conteos: { ...x.conteos, [orgId2]: valor } } : x
    ))
  }

  async function guardar() {
    if (!orgId) return
    if (!form.rancho_id) {
      toast.error(`Selecciona ${terminosSitio.genero === 'f' ? 'una' : 'un'} ${terminosSitio.singular}`)
      return
    }

    setGuardando(true)
    try {
      // 1. INSERT m72_registro
      const { data: reg, error: regErr } = await tbl('m72_registro')
        .insert({
          org_id: orgId,
          rancho_id: form.rancho_id,
          fecha: form.fecha,
          etapa_fenologica: form.etapa.trim() || null,
          realizo: form.realizo.trim() || null,
          beneficos: form.beneficos.trim() || null,
          observaciones: form.observaciones.trim() || null,
          creado_por: user?.id,
        })
        .select('id')
        .single()
      if (regErr) throw regErr
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const registroId = (reg as any).id as string

      // 2. INSERT m72_resultados (solo conteos > 0)
      const batch: object[] = []
      for (const fila of filas) {
        const numPlanta = parseInt(fila.num_planta) || 0
        if (!fila.sector.trim() || numPlanta <= 0) continue
        for (const [organismoId, conteoStr] of Object.entries(fila.conteos)) {
          const conteo = parseInt(conteoStr) || 0
          if (conteo > 0) {
            batch.push({
              org_id: orgId,
              registro_id: registroId,
              sector: fila.sector.trim(),
              num_planta: numPlanta,
              organismo_id: organismoId,
              conteo,
            })
          }
        }
      }
      if (batch.length > 0) {
        const { error: resErr } = await tbl('m72_resultados').insert(batch)
        if (resErr) throw resErr
      }

      setSheetOpen(false)
      await refetch()
      toast.success('Monitoreo registrado')
    } catch (e: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg: string = (e as any)?.message ?? 'Error al guardar'
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(msg)
        console.error(e)
      }
    } finally {
      setGuardando(false)
    }
  }

  const plagas = organismos.filter(o => o.tipo === 'plaga')
  const enfermedades = organismos.filter(o => o.tipo === 'enfermedad')

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => navigate('/')} className="p-1 -ml-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">Monitoreo de Plagas y Enfermedades</h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>M72 · REG-21 · Por evento</p>
        </div>
        <Sprout className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
      </div>

      {/* Botón consolidado */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setConsolidadoOpen(true)}
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--primary)' }}
        >
          <Files className="w-4 h-4" />
          Exportar consolidado
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 px-4 pb-32 space-y-3 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          </div>
        )}
        {!loading && registros.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Sin registros. Usa el botón + para agregar.
          </div>
        )}
        {registros.map(r => (
          <div
            key={r.id}
            className="rounded-[0.625rem] border p-4 space-y-2"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{r.rancho_nombre}</p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{formatFecha(r.fecha)}</p>
              </div>
              <button
                onClick={() => toast.info('Detalle próximamente')}
                className="text-xs font-medium px-2.5 py-1 rounded-[0.625rem] border shrink-0"
                style={{ color: 'var(--primary)', borderColor: 'var(--border)' }}
              >
                Ver detalle
              </button>
            </div>
            {r.etapa_fenologica && (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Etapa: <span style={{ color: 'var(--foreground)' }}>{r.etapa_fenologica}</span>
              </p>
            )}
            {r.realizo && (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Realizó: <span style={{ color: 'var(--foreground)' }}>{r.realizo}</span>
              </p>
            )}
          </div>
        ))}
      </div>

      {/* FAB */}
      <div className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10 md:bottom-6">
        <button
          onClick={abrirNuevo}
          className="pointer-events-auto w-14 h-14 rounded-full text-white flex items-center justify-center active:scale-95 transition-transform"
          style={{ backgroundColor: 'var(--primary)' }}
          aria-label="Nuevo monitoreo"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Sheet — nuevo registro */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} height="90%">
        <div
          className="flex items-center justify-between px-4 pt-4 pb-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="text-base font-semibold">Nuevo monitoreo</h2>
          <button onClick={() => setSheetOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 pt-4 pb-8 space-y-5">

          {/* ── Sección 1: Encabezado ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--muted-foreground)' }}>
              Datos generales
            </p>
            <div className="space-y-4">

              {/* Rancho */}
              <div>
                <label className="block text-xs font-medium mb-1">{terminosSitio.singular}</label>
                <select
                  className="w-full h-10 rounded-[0.625rem] border px-3 text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
                  value={form.rancho_id}
                  onChange={e => setForm(f => ({ ...f, rancho_id: e.target.value }))}
                >
                  <option value="">Selecciona...</option>
                  {ranchos.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-medium mb-1">Fecha</label>
                <input
                  type="date"
                  className="w-full h-10 rounded-[0.625rem] border px-3 text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
                  value={form.fecha}
                  min={puedeEditarFecha ? undefined : hoyMX()}
                  max={puedeEditarFecha ? undefined : hoyMX()}
                  onChange={e => { if (puedeEditarFecha) setForm(f => ({ ...f, fecha: e.target.value })) }}
                />
              </div>

              {/* Etapa fenológica */}
              <div>
                <label className="block text-xs font-medium mb-1">
                  Etapa fenológica <span style={{ color: 'var(--muted-foreground)' }}>(opcional)</span>
                </label>
                <input
                  type="text"
                  className="w-full h-10 rounded-[0.625rem] border px-3 text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
                  placeholder="Ej. Floración, Fructificación..."
                  value={form.etapa}
                  onChange={e => setForm(f => ({ ...f, etapa: e.target.value }))}
                />
              </div>

              {/* Realizó */}
              <div>
                <label className="block text-xs font-medium mb-1">
                  Realizó <span style={{ color: 'var(--muted-foreground)' }}>(opcional)</span>
                </label>
                <input
                  type="text"
                  className="w-full h-10 rounded-[0.625rem] border px-3 text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
                  placeholder="Nombre completo"
                  value={form.realizo}
                  onChange={e => setForm(f => ({ ...f, realizo: e.target.value }))}
                />
              </div>

              {/* Benéficos */}
              <div>
                <label className="block text-xs font-medium mb-1">
                  Organismos benéficos observados <span style={{ color: 'var(--muted-foreground)' }}>(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-[0.625rem] border px-3 py-2 text-sm resize-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
                  placeholder="Ej. Coccinélidos, Crisópas..."
                  value={form.beneficos}
                  onChange={e => setForm(f => ({ ...f, beneficos: e.target.value }))}
                />
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-medium mb-1">
                  Observaciones <span style={{ color: 'var(--muted-foreground)' }}>(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-[0.625rem] border px-3 py-2 text-sm resize-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
                  value={form.observaciones}
                  onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* ── Sección 2: Tabla de plantas ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                Plantas monitoreadas
              </p>
              <button
                type="button"
                onClick={agregarFila}
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: 'var(--primary)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar punto/planta
              </button>
            </div>

            {organismos.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
                Cargando catálogo de organismos...
              </p>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4">
                <div style={{ minWidth: `${2 * 120 + organismos.length * 72 + 40}px` }}>
                  {/* Cabecera */}
                  <div className="flex items-stretch mb-1 gap-1">
                    <div
                      className="w-28 shrink-0 text-xs font-semibold px-2 py-1.5 rounded-t-[0.625rem]"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
                    >
                      Sector
                    </div>
                    <div
                      className="w-16 shrink-0 text-xs font-semibold px-2 py-1.5 rounded-t-[0.625rem] text-center"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
                    >
                      Planta
                    </div>
                    {plagas.map(o => (
                      <div
                        key={o.id}
                        className="w-16 shrink-0 text-xs font-semibold px-1 py-1.5 rounded-t-[0.625rem] text-center leading-tight"
                        style={{ backgroundColor: 'var(--agro-danger-fill)', color: 'var(--agro-danger-text)' }}
                      >
                        {o.nombre}
                      </div>
                    ))}
                    {enfermedades.map(o => (
                      <div
                        key={o.id}
                        className="w-16 shrink-0 text-xs font-semibold px-1 py-1.5 rounded-t-[0.625rem] text-center leading-tight"
                        style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
                      >
                        {o.nombre}
                      </div>
                    ))}
                    <div className="w-8 shrink-0" />
                  </div>

                  {/* Filas */}
                  {filas.map((fila, idx) => (
                    <div key={fila.id} className="flex items-center gap-1 mb-1">
                      {/* Sector */}
                      <input
                        type="text"
                        className="w-28 h-9 shrink-0 rounded-[0.625rem] border px-2 text-xs"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
                        placeholder={`Sector ${idx + 1}`}
                        value={fila.sector}
                        onChange={e => actualizarFila(fila.id, 'sector', e.target.value)}
                      />
                      {/* N° planta */}
                      <input
                        type="number"
                        min="1"
                        className="w-16 h-9 shrink-0 rounded-[0.625rem] border px-2 text-xs text-center"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
                        placeholder="#"
                        value={fila.num_planta}
                        onChange={e => actualizarFila(fila.id, 'num_planta', e.target.value)}
                      />
                      {/* Conteos organismos (plagas primero, luego enfermedades — mismo orden que cabecera) */}
                      {[...plagas, ...enfermedades].map(o => (
                        <input
                          key={o.id}
                          type="number"
                          min="0"
                          className="w-16 h-8 shrink-0 rounded-[0.625rem] border text-xs text-center"
                          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
                          placeholder="0"
                          value={fila.conteos[o.id] ?? ''}
                          onChange={e => actualizarConteo(fila.id, o.id, e.target.value)}
                        />
                      ))}
                      {/* Eliminar fila */}
                      <button
                        type="button"
                        onClick={() => eliminarFila(fila.id)}
                        className="w-8 h-8 shrink-0 flex items-center justify-center rounded"
                        style={{ color: filas.length > 1 ? 'var(--agro-danger-text)' : 'var(--muted-foreground)' }}
                        disabled={filas.length <= 1}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pb-6 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full h-11 rounded-[0.625rem] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar
          </button>
        </div>
      </BottomSheet>

      {/* Sheet — consolidado */}
      <BottomSheet open={consolidadoOpen} onClose={() => setConsolidadoOpen(false)}>
        <div
          className="flex items-center justify-between px-4 pt-4 pb-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="text-base font-semibold">Exportar consolidado</h2>
          <button onClick={() => setConsolidadoOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 pt-6 pb-8 flex flex-col items-center gap-4 text-center">
          <Files className="w-10 h-10" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            La exportación consolidada estará disponible próximamente.
          </p>
          <button
            onClick={() => { setConsolidadoOpen(false); toast.info('Consolidado próximamente') }}
            className="h-11 px-6 rounded-[0.625rem] text-white font-semibold text-sm"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Entendido
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
