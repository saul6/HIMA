// ╔══════════════════════════════════════════════════════════════════════╗
// ║  M77 — Identificación de Empleados (REG-ASIP-26)                    ║
// ║  Directorio plano — alta, consulta y baja de empleados              ║
// ║  org_id SIEMPRE del contexto de auth, nunca del input               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { useState } from 'react'
import {
  Plus, X, Loader2, Users, TriangleAlert, Trash2,
} from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM77EmpleadosGG, type M77EmpleadoRegistro } from '@/hooks/useM77EmpleadosGG'
import { supabase } from '@/lib/supabase'
import { Fab } from '@/app/components/Fab'
import { useContextoTarea } from '@/hooks/useContextoTarea'
import { BannerTareaOrigen } from '@/app/components/BannerTareaOrigen'
import { useFirmasRegistro } from '@/hooks/useFirmasRegistro'
import { FirmasRegistro } from '@/app/components/FirmasRegistro'
import { FirmaGatePaso } from '@/app/components/FirmaGatePaso'
import { PasoFirmaRegistro } from '@/app/components/PasoFirmaRegistro'
import { useFirmaContext } from '@/context/FirmaContext'

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
  const { ranchoInicial, tareaId } = useContextoTarea(ranchos)
  const { registros, loading, error, refetch } = useM77EmpleadosGG()

  const { obligatoria, tengoFirma } = useFirmaContext()
  const todosIds = registros.map(r => r.id)
  const { firmas, loading: loadingFirmas, refetch: refetchFirmas } = useFirmasRegistro('M77', todosIds)

  const termino = terminosSitio.singular
  const [sheetNuevo, setSheetNuevo] = useState(false)
  const [sheetPaso, setSheetPaso] = useState<'firma_gate' | 'form' | 'firma_decision'>('form')
  const [pendienteFirmaId, setPendienteFirmaId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(formInicial)
  const [errRancho, setErrRancho] = useState(false)
  const [errNombre, setErrNombre] = useState(false)
  const [guardando, setGuardando] = useState(false)

  function handleCerrarSheet() {
    setSheetNuevo(false)
    setSheetPaso('form')
    setPendienteFirmaId(null)
  }

  const setF = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  function abrirSheet() {
    setForm({ ...formInicial(), rancho_id: ranchoInicial ?? '' })
    setErrRancho(false)
    setErrNombre(false)
    setPendienteFirmaId(null)
    setSheetPaso(obligatoria && !tengoFirma ? 'firma_gate' : 'form')
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
      const { data, error: e } = await tbl('m77_empleados').insert({
        org_id: profile.org_id,
        rancho_id: form.rancho_id,
        nombre: form.nombre.trim(),
        fecha_ingreso: form.fecha_ingreso || null,
        telefono: form.telefono.trim() || null,
        domicilio: form.domicilio.trim() || null,
        persona_contacto: form.persona_contacto.trim() || null,
        observaciones: form.observaciones.trim() || null,
        creado_por: user?.id ?? null,
      }).select('id').single()
      if (e) throw e
      toast.success('Empleado registrado')
      await refetch()
      setPendienteFirmaId(data.id as string)
      setSheetPaso('firma_decision')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('FIRMA_REQUERIDA')) {
        setSheetPaso('firma_gate')
        return
      }
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

      <ModuloHeader tituloFallback="Identificación de Empleados" subtitulo="M77 · REG-ASIP-26 · Seguridad" />

      <BannerTareaOrigen tareaId={tareaId} />

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
                      {obligatoria && !firmas[reg.id]?.realizo && (
                        <span className="text-xs px-2 py-0.5 rounded font-medium mt-1 inline-block"
                          style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}>
                          Pendiente de firma
                        </span>
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
                  <FirmasRegistro
                    modulo="M77"
                    registroId={reg.id}
                    fechaRegistro={reg.fecha_ingreso ?? reg.created_at ?? ''}
                    firma={firmas[reg.id]}
                    loadingFirmas={loadingFirmas}
                    onFirmado={refetchFirmas}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* FAB */}
            <Fab onClick={abrirSheet} aria-label="Nuevo empleado" />

      {/* Sheet */}
      <BottomSheet open={sheetNuevo} onClose={handleCerrarSheet} height="85%">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
            {sheetPaso === 'firma_gate' ? 'Registra tu firma' : sheetPaso === 'firma_decision' ? 'Firmar registro' : 'Registrar empleado'}
          </h2>
          <button onClick={handleCerrarSheet}>
            <X className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {sheetPaso === 'firma_gate' && (
          <FirmaGatePaso onFirmaGuardada={() => setSheetPaso('form')} />
        )}

        {sheetPaso === 'firma_decision' && pendienteFirmaId && (
          <PasoFirmaRegistro
            modulo="M77"
            ids={[pendienteFirmaId]}
            descripcion={`Empleado: ${form.nombre}`}
            obligatoria={obligatoria}
            onFirmadoYPDF={async () => { handleCerrarSheet(); await refetchFirmas() }}
            onDespues={!obligatoria ? () => handleCerrarSheet() : undefined}
          />
        )}

        {sheetPaso === 'form' && (<><div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 pt-4">
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
        </>)}
      </BottomSheet>
    </div>
  )
}
