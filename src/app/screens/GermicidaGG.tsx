// ╔══════════════════════════════════════════════════════════════════════╗
// ║  M74 — Monitoreo de Solución Germicida (REG-10.1)                   ║
// ║  Bitácora con 3 tomas de PPM por registro                           ║
// ║  org_id SIEMPRE del contexto de auth, nunca del input               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { useState } from 'react'
import {
  ChevronLeft, Plus, X, Loader2, FlaskConical, TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM74GermicidaGG } from '@/hooks/useM74GermicidaGG'
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

interface FormState {
  rancho_id: string
  producto: string
  fecha: string
  material_utilizado: string
  sector: string
  hora1: string; ppm1: string; ajuste1: string
  hora2: string; ppm2: string; ajuste2: string
  hora3: string; ppm3: string; ajuste3: string
  realizo: string
  observaciones: string
}

function formInicial(nombreCompleto = ''): FormState {
  return {
    rancho_id: '',
    producto: '',
    fecha: hoy(),
    material_utilizado: '',
    sector: '',
    hora1: '', ppm1: '', ajuste1: '',
    hora2: '', ppm2: '', ajuste2: '',
    hora3: '', ppm3: '', ajuste3: '',
    realizo: nombreCompleto,
    observaciones: '',
  }
}

export function GermicidaGG() {
  const { profile, user } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { registros, loading, error, refetch } = useM74GermicidaGG()

  const termino = terminosSitio.singular
  const [sheetNuevo, setSheetNuevo] = useState(false)
  const [form, setForm] = useState<FormState>(formInicial)
  const [errRancho, setErrRancho] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const set = (campo: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }))

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
      const { error: e } = await tbl('m74_germicida').insert({
        org_id: profile.org_id,
        rancho_id: form.rancho_id,
        producto: form.producto.trim() || null,
        fecha: form.fecha,
        material_utilizado: form.material_utilizado.trim() || null,
        sector: form.sector.trim() || null,
        hora1: form.hora1 || null,
        ppm1: form.ppm1 ? parseFloat(form.ppm1) : null,
        ajuste1: form.ajuste1.trim() || null,
        hora2: form.hora2 || null,
        ppm2: form.ppm2 ? parseFloat(form.ppm2) : null,
        ajuste2: form.ajuste2.trim() || null,
        hora3: form.hora3 || null,
        ppm3: form.ppm3 ? parseFloat(form.ppm3) : null,
        ajuste3: form.ajuste3.trim() || null,
        realizo: form.realizo.trim() || null,
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
            <FlaskConical className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
              Monitoreo de Solución Germicida
            </h1>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              M74 · REG-10.1 · Limpieza
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

        {/* Info box PPM */}
        <div
          className="flex items-start gap-2 rounded-xl p-3"
          style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid var(--agro-amber)' }}
        >
          <FlaskConical className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
          <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
            <span style={{ fontWeight: 600 }}>Rangos de referencia:</span>{' '}
            Lavado de manos: 1.5–3.0 ppm · Herramientas/cubetas: 100–200 ppm
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : registros.length === 0 ? (
          <div
            className="border rounded-xl p-6 text-center"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <FlaskConical className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin registros aún</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Crea el primer registro con el botón +
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {registros.map((reg) => (
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
                  {reg.sector && (
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
                    >
                      {reg.sector}
                    </span>
                  )}
                </div>
                <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{reg.rancho_nombre}</span>
                {reg.producto && (
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    Producto: {reg.producto}
                  </div>
                )}
                {/* Resumen tomas */}
                <div className="flex gap-3 mt-2 flex-wrap">
                  {[
                    { hora: reg.hora1, ppm: reg.ppm1, label: 'Toma 1' },
                    { hora: reg.hora2, ppm: reg.ppm2, label: 'Toma 2' },
                    { hora: reg.hora3, ppm: reg.ppm3, label: 'Toma 3' },
                  ].filter((t) => t.ppm !== null).map((t, i) => (
                    <div key={i} className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {t.label}: <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{t.ppm} ppm</span>
                      {t.hora && ` · ${t.hora}`}
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Nuevo monitoreo germicida</h2>
          <button onClick={() => setSheetNuevo(false)}>
            <X className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 pt-4">
          {/* Info */}
          <div
            className="flex items-start gap-2 rounded-xl p-3"
            style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid var(--agro-amber)' }}
          >
            <FlaskConical className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
            <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
              Lavado de manos: 1.5–3.0 ppm · Herramientas/cubetas: 100–200 ppm
            </p>
          </div>

          {/* Rancho */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
              {termino.toUpperCase()} *
            </label>
            <select
              value={form.rancho_id}
              onChange={(e) => { setForm((f) => ({ ...f, rancho_id: e.target.value })); setErrRancho(false) }}
              className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
              style={{ borderColor: errRancho ? 'var(--agro-red)' : 'var(--border)', backgroundColor: 'var(--input-background)' }}
            >
              <option value="">Selecciona {termino.toLowerCase()}…</option>
              {ranchoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errRancho && <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Requerido</p>}
          </div>

          {/* Producto y fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>PRODUCTO</label>
              <input type="text" value={form.producto} onChange={set('producto')} placeholder="Nombre del producto"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>FECHA</label>
              <input type="date" value={form.fecha} onChange={set('fecha')}
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          {/* Material y sector */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>MATERIAL UTILIZADO</label>
              <input type="text" value={form.material_utilizado} onChange={set('material_utilizado')} placeholder="Ej: Cubeta"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>SECTOR</label>
              <input type="text" value={form.sector} onChange={set('sector')} placeholder="Ej: Empaque"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          {/* 3 Tomas */}
          {([1, 2, 3] as const).map((n) => {
            const horaKey = `hora${n}` as 'hora1' | 'hora2' | 'hora3'
            const ppmKey = `ppm${n}` as 'ppm1' | 'ppm2' | 'ppm3'
            const ajusteKey = `ajuste${n}` as 'ajuste1' | 'ajuste2' | 'ajuste3'
            return (
              <div key={n}>
                <label className="text-xs mb-2 block" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
                  TOMA {n}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Hora</label>
                    <input type="time" value={form[horaKey]} onChange={set(horaKey)}
                      className="w-full h-9 px-2 rounded-lg border text-sm text-foreground focus:outline-none"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>PPM</label>
                    <input type="number" min="0" step="0.1" value={form[ppmKey]} onChange={set(ppmKey)} placeholder="0.0"
                      className="w-full h-9 px-2 rounded-lg border text-sm text-foreground focus:outline-none"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Ajuste</label>
                    <input type="text" value={form[ajusteKey]} onChange={set(ajusteKey)} placeholder="Ej: +20ml"
                      className="w-full h-9 px-2 rounded-lg border text-sm text-foreground focus:outline-none"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
                  </div>
                </div>
              </div>
            )
          })}

          {/* Realizó */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>REALIZÓ</label>
            <input type="text" value={form.realizo} onChange={set('realizo')} placeholder="Nombre del responsable"
              className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
          </div>

          {/* Observaciones */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>OBSERVACIONES</label>
            <textarea value={form.observaciones} onChange={set('observaciones')} rows={2}
              placeholder="Observaciones…"
              className="w-full rounded-xl border px-3 py-2 text-sm text-foreground focus:outline-none resize-none"
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
