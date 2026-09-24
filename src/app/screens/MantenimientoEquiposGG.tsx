// ╔══════════════════════════════════════════════════════════════════════╗
// ║  M76 — Verificación y Mantenimiento de Equipos (REG-09)             ║
// ║  Bitácora plana con checks de estado de equipos                     ║
// ║  org_id SIEMPRE del contexto de auth, nunca del input               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { useState } from 'react'
import {
  ChevronLeft, Plus, X, Loader2, Wrench, TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM76MantenimientoEquiposGG } from '@/hooks/useM76MantenimientoEquiposGG'
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

type CheckVal = 'si' | 'no' | 'na'
type TipoActividad = 'verificacion' | 'preventivo' | 'correctivo'

interface FormState {
  rancho_id: string
  fecha: string
  equipo: string
  realizo: string
  tipo_actividad: TipoActividad
  fugas_tanque_bomba: CheckVal
  mangueras: CheckVal
  pistola: CheckVal
  lanzas: CheckVal
  boquillas: CheckVal
  descripcion_trabajo: string
  observaciones: string
}

function formInicial(nombre = ''): FormState {
  return {
    rancho_id: '',
    fecha: hoy(),
    equipo: '',
    realizo: nombre,
    tipo_actividad: 'verificacion',
    fugas_tanque_bomba: 'si',
    mangueras: 'si',
    pistola: 'si',
    lanzas: 'si',
    boquillas: 'si',
    descripcion_trabajo: '',
    observaciones: '',
  }
}

const CHECKS: { key: keyof Pick<FormState, 'fugas_tanque_bomba' | 'mangueras' | 'pistola' | 'lanzas' | 'boquillas'>; label: string }[] = [
  { key: 'fugas_tanque_bomba', label: 'Libre de fugas tanque/bomba' },
  { key: 'mangueras', label: 'Mangueras libres de fugas' },
  { key: 'pistola', label: 'Estado de la pistola' },
  { key: 'lanzas', label: 'Estado de lanzas/varillas' },
  { key: 'boquillas', label: 'Estado de las boquillas' },
]

const TIPO_LABELS: Record<TipoActividad, string> = {
  verificacion: 'Verificación',
  preventivo: 'Preventivo',
  correctivo: 'Correctivo',
}

const TIPO_COLORS: Record<TipoActividad, { fill: string; text: string }> = {
  verificacion: { fill: 'var(--agro-success-fill)', text: 'var(--agro-success-text)' },
  preventivo: { fill: 'var(--agro-warning-fill)', text: 'var(--agro-warning-text)' },
  correctivo: { fill: 'var(--agro-danger-fill)', text: 'var(--agro-danger-text)' },
}

function CheckSelector({ label, valor, onChange }: { label: string; valor: CheckVal; onChange: (v: CheckVal) => void }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2.5 border rounded-xl"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
    >
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex gap-1">
        {(['si', 'no', 'na'] as CheckVal[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className="h-7 px-2.5 rounded text-xs transition-colors"
            style={{
              fontWeight: 600,
              backgroundColor: valor === v
                ? v === 'si' ? 'var(--primary)' : v === 'no' ? 'var(--agro-red)' : 'var(--switch-background)'
                : 'var(--muted)',
              color: valor === v
                ? v === 'na' ? 'var(--muted-foreground)' : '#fff'
                : 'var(--muted-foreground)',
            }}
          >
            {v === 'si' ? 'Sí' : v === 'no' ? 'No' : 'N/A'}
          </button>
        ))}
      </div>
    </div>
  )
}

export function MantenimientoEquiposGG() {
  const { profile, user } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { registros, loading, error, refetch } = useM76MantenimientoEquiposGG()

  const termino = terminosSitio.singular
  const [sheetNuevo, setSheetNuevo] = useState(false)
  const [form, setForm] = useState<FormState>(formInicial)
  const [errRancho, setErrRancho] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  function abrirSheet() {
    setForm(formInicial(profile?.nombre_completo ?? ''))
    setErrRancho(false)
    setSheetNuevo(true)
  }

  async function handleGuardar() {
    if (!form.rancho_id) { setErrRancho(true); return }
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }
    setGuardando(true)
    try {
      const { error: e } = await tbl('m76_mantenimiento_equipos').insert({
        org_id: profile.org_id,
        rancho_id: form.rancho_id,
        fecha: form.fecha,
        equipo: form.equipo.trim() || null,
        realizo: form.realizo.trim() || null,
        tipo_actividad: form.tipo_actividad,
        fugas_tanque_bomba: form.fugas_tanque_bomba,
        mangueras: form.mangueras,
        pistola: form.pistola,
        lanzas: form.lanzas,
        boquillas: form.boquillas,
        descripcion_trabajo: form.descripcion_trabajo.trim() || null,
        observaciones: form.observaciones.trim() || null,
        creado_por: user?.id ?? null,
      })
      if (e) throw e
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
      setGuardando(false)
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
            <Wrench className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
              Verificación y Mantenimiento de Equipos
            </h1>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              M76 · REG-09 · Mantenimiento
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
            <Wrench className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin registros aún</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Crea el primer registro con el botón +
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {registros.map((reg) => {
              const tipo = (reg.tipo_actividad as TipoActividad | null) ?? 'verificacion'
              const cols = TIPO_COLORS[tipo] ?? TIPO_COLORS.verificacion
              return (
                <div
                  key={reg.id}
                  className="rounded-xl p-4 border"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)', fontWeight: 600 }}
                    >
                      {formatFecha(reg.fecha)}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ backgroundColor: cols.fill, color: cols.text, fontWeight: 600 }}
                    >
                      {TIPO_LABELS[tipo]}
                    </span>
                  </div>
                  <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{reg.rancho_nombre}</span>
                  {reg.equipo && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      Equipo: {reg.equipo}
                    </div>
                  )}
                  {reg.realizo && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      Realizó: {reg.realizo}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* FAB */}
            <Fab onClick={abrirSheet} aria-label="Nuevo registro" />

      {/* Sheet */}
      <BottomSheet open={sheetNuevo} onClose={() => setSheetNuevo(false)} height="85%">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Nuevo registro de equipos</h2>
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
              value={form.rancho_id}
              onChange={(e) => { setF('rancho_id', e.target.value); setErrRancho(false) }}
              className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
              style={{ borderColor: errRancho ? 'var(--agro-red)' : 'var(--border)', backgroundColor: 'var(--input-background)' }}
            >
              <option value="">Selecciona {termino.toLowerCase()}…</option>
              {ranchoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errRancho && <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Requerido</p>}
          </div>

          {/* Fecha y equipo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>FECHA</label>
              <input type="date" value={form.fecha} onChange={(e) => setF('fecha', e.target.value)}
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>EQUIPO</label>
              <input type="text" value={form.equipo} onChange={(e) => setF('equipo', e.target.value)} placeholder="Ej: Bomba A1"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          {/* Realizó */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>REALIZÓ</label>
            <input type="text" value={form.realizo} onChange={(e) => setF('realizo', e.target.value)} placeholder="Nombre del responsable"
              className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
          </div>

          {/* Tipo de actividad */}
          <div className="space-y-2">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>TIPO DE ACTIVIDAD</label>
            <div className="flex gap-2">
              {(['verificacion', 'preventivo', 'correctivo'] as TipoActividad[]).map((t) => {
                const cols = TIPO_COLORS[t]
                const activo = form.tipo_actividad === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setF('tipo_actividad', t)}
                    className="flex-1 h-9 rounded-xl text-xs transition-colors"
                    style={{
                      fontWeight: 600,
                      backgroundColor: activo ? cols.fill : 'var(--muted)',
                      color: activo ? cols.text : 'var(--muted-foreground)',
                      border: activo ? `1px solid ${cols.text}` : '1px solid var(--border)',
                    }}
                  >
                    {TIPO_LABELS[t]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Checks de estado */}
          <div className="space-y-2">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>ESTADO DE COMPONENTES</label>
            {CHECKS.map(({ key, label }) => (
              <CheckSelector
                key={key}
                label={label}
                valor={form[key] as CheckVal}
                onChange={(v) => setF(key, v)}
              />
            ))}
          </div>

          {/* Descripción del trabajo */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
              DESCRIPCIÓN DEL TRABAJO
            </label>
            <textarea
              value={form.descripcion_trabajo}
              onChange={(e) => setF('descripcion_trabajo', e.target.value)}
              rows={3}
              placeholder="Reparación, cambio de piezas, etc."
              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none resize-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }}
            />
          </div>

          {/* Observaciones */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>OBSERVACIONES</label>
            <textarea value={form.observaciones} onChange={(e) => setF('observaciones', e.target.value)} rows={2}
              placeholder="Observaciones adicionales…"
              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none resize-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
          </div>
        </div>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleGuardar}
            disabled={guardando || !form.rancho_id}
            className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
          >
            {guardando ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Guardar registro'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
