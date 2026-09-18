// ╔══════════════════════════════════════════════════════════════════════╗
// ║  M77 — Identificación de Empleados (REG-ASIP-26)                    ║
// ║  Directorio plano — alta, consulta y baja de empleados              ║
// ║  org_id SIEMPRE del contexto de auth, nunca del input               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { useState } from 'react'
import {
  ChevronLeft, Plus, X, Loader2, Users, TriangleAlert, Trash2,
} from 'lucide-react'
import { Link } from 'react-router'
import { BottomSheet } from '@/app/components/BottomSheet'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM77EmpleadosGG, type M77EmpleadoRegistro } from '@/hooks/useM77EmpleadosGG'
import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
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
  nombre: string
  fecha_ingreso: string
  telefono: string
  domicilio: string
  persona_contacto: string
  observaciones: string
}

function formInicial(): FormState {
  return {
    rancho_id: '',
    nombre: '',
    fecha_ingreso: hoy(),
    telefono: '',
    domicilio: '',
    persona_contacto: '',
    observaciones: '',
  }
}

export function EmpleadosGG() {
  const { profile, user } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { registros, loading, error, refetch } = useM77EmpleadosGG()

  const termino = terminosSitio.singular
  const [sheetNuevo, setSheetNuevo] = useState(false)
  const [form, setForm] = useState<FormState>(formInicial)
  const [errRancho, setErrRancho] = useState(false)
  const [errNombre, setErrNombre] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const setF = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  function abrirSheet() {
    setForm(formInicial())
    setErrRancho(false)
    setErrNombre(false)
    setSheetNuevo(true)
  }

  async function handleGuardar() {
    let valido = true
    if (!form.rancho_id) { setErrRancho(true); valido = false }
    if (!form.nombre.trim()) { setErrNombre(true); valido = false }
    if (!valido) return
    if (!profile?.org_id) { toast.error('Sin organización activa'); return }

    setGuardando(true)
    try {
      const { error: e } = await tbl('m77_empleados').insert({
        org_id: profile.org_id,
        rancho_id: form.rancho_id,
        nombre: form.nombre.trim(),
        fecha_ingreso: form.fecha_ingreso || null,
        telefono: form.telefono.trim() || null,
        domicilio: form.domicilio.trim() || null,
        persona_contacto: form.persona_contacto.trim() || null,
        observaciones: form.observaciones.trim() || null,
        creado_por: user?.id ?? null,
      })
      if (e) throw e
      toast.success('Empleado registrado')
      setSheetNuevo(false)
      await refetch()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar(reg: M77EmpleadoRegistro) {
    if (!profile?.org_id) return
    const esAdmin = profile.rol === 'admin_org' || profile.rol === 'super_admin'
    const esMio = reg.creado_por === user?.id
    if (!esAdmin && !esMio) { toast.error('No tienes permiso para eliminar este registro'); return }
    if (!confirm(`¿Eliminar el registro de "${reg.nombre}"? Esta acción no se puede deshacer.`)) return

    try {
      const { error } = await tbl('m77_empleados')
        .delete()
        .eq('id', reg.id)
        .eq('org_id', profile.org_id)
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
            <Users className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
              Identificación de Empleados
            </h1>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              M77 · REG-ASIP-26 · Seguridad
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
            <Users className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Sin empleados registrados</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Agrega el primer empleado con el botón +
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
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{reg.nombre}</span>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {reg.rancho_nombre}
                      </div>
                      {reg.fecha_ingreso && (
                        <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          Ingreso: {formatFecha(reg.fecha_ingreso)}
                        </div>
                      )}
                      {reg.telefono && (
                        <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          Tel: {reg.telefono}
                        </div>
                      )}
                      {reg.persona_contacto && (
                        <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          Contacto: {reg.persona_contacto}
                        </div>
                      )}
                    </div>
                    {(esAdmin || esMio) && (
                      <button
                        onClick={() => handleEliminar(reg)}
                        className="p-2 flex-shrink-0"
                        style={{ color: 'var(--muted-foreground)' }}
                        title="Eliminar empleado"
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
      <div className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
        <button
          onClick={abrirSheet}
          className="pointer-events-auto w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors"
          style={{ backgroundColor: 'var(--primary)' }}
          aria-label="Nuevo empleado"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Sheet */}
      <BottomSheet open={sheetNuevo} onClose={() => setSheetNuevo(false)} height="85%">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Registrar empleado</h2>
          <button onClick={() => setSheetNuevo(false)}>
            <X className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 pt-4">
          {/* Aviso firma */}
          <div
            className="flex items-start gap-2 rounded-xl p-3"
            style={{ backgroundColor: 'var(--agro-warning-fill)', border: '1px solid var(--agro-amber)' }}
          >
            <Users className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
            <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
              Firma física, no digital. El empleado debe firmar el documento impreso.
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

          {/* Nombre */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>NOMBRE COMPLETO *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => { setForm((f) => ({ ...f, nombre: e.target.value })); setErrNombre(false) }}
              placeholder="Nombre del empleado"
              className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
              style={{ borderColor: errNombre ? 'var(--agro-red)' : 'var(--border)', backgroundColor: 'var(--input-background)' }}
            />
            {errNombre && <p className="text-xs" style={{ color: 'var(--agro-red)' }}>Requerido</p>}
          </div>

          {/* Fecha ingreso y teléfono */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>FECHA INGRESO</label>
              <input type="date" value={form.fecha_ingreso} onChange={setF('fecha_ingreso')}
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>TELÉFONO</label>
              <input type="tel" value={form.telefono} onChange={setF('telefono')} placeholder="10 dígitos"
                className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
            </div>
          </div>

          {/* Domicilio */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>DOMICILIO</label>
            <textarea value={form.domicilio} onChange={setF('domicilio')} rows={2} placeholder="Dirección del empleado"
              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none resize-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
          </div>

          {/* Persona de contacto */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>PERSONA DE CONTACTO EN CASO DE EMERGENCIA</label>
            <input type="text" value={form.persona_contacto} onChange={setF('persona_contacto')} placeholder="Nombre y teléfono"
              className="w-full h-11 px-3 rounded-xl border text-sm text-foreground focus:outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
          </div>

          {/* Observaciones */}
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>OBSERVACIONES</label>
            <textarea value={form.observaciones} onChange={setF('observaciones')} rows={2} placeholder="Observaciones adicionales…"
              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none resize-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input-background)' }} />
          </div>
        </div>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleGuardar}
            disabled={guardando || !form.rancho_id || !form.nombre.trim()}
            className="w-full h-11 rounded-xl text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)', fontWeight: 600 }}
          >
            {guardando ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Guardar empleado'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
