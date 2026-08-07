import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, PackageOpen, Download, Plus, FileText, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useM42Movimientos } from '@/hooks/useM42Movimientos'
import { useModulosContext } from '@/context/ModulosContext'
import { supabase } from '@/lib/supabase'
import { generarMaterialEmpaquePDF } from '@/lib/pdf/m42/generarMaterialEmpaquePDF'
import { generarMaterialEmpaqueConsolidadoPDF } from '@/lib/pdf/m42/generarMaterialEmpaqueConsolidadoPDF'

const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
const tbl = (name: string) => (supabase as any).from(name)

interface FormState {
  rancho_id: string
  fecha: string
  empresa: string
  descripcion_material: string
  entrada: string
  salida: string
  total: string
  entrega: string
  recibe: string
  mat_integro: boolean
  mat_buen_estado: boolean
  mat_limpio: boolean
  mat_libre_olores: boolean
  mat_libre_plagas: boolean
  mat_otros: string
  tr_integro: boolean
  tr_buen_estado: boolean
  tr_limpio: boolean
  tr_libre_olores: boolean
  tr_libre_plagas: boolean
  tr_otros: string
  observaciones: string
}

const FORM_INICIAL: FormState = {
  rancho_id: '',
  fecha: hoyMX(),
  empresa: '',
  descripcion_material: '',
  entrada: '',
  salida: '',
  total: '',
  entrega: '',
  recibe: '',
  mat_integro: true,
  mat_buen_estado: true,
  mat_limpio: true,
  mat_libre_olores: true,
  mat_libre_plagas: true,
  mat_otros: '',
  tr_integro: true,
  tr_buen_estado: true,
  tr_limpio: true,
  tr_libre_olores: true,
  tr_libre_plagas: true,
  tr_otros: '',
  observaciones: '',
}

function SiNoToggle({ value, onChange, label, danger }: { value: boolean; onChange: (v: boolean) => void; label: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px]" style={{ color: !value && danger ? 'var(--agro-danger-text)' : 'inherit' }}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="px-3 py-1 rounded-full text-[11px] font-semibold min-w-[40px]"
        style={{
          backgroundColor: value ? 'var(--agro-success-fill)' : 'var(--agro-danger-fill)',
          color: value ? 'var(--agro-success-text)' : 'var(--agro-danger-text)',
        }}
      >
        {value ? 'Sí' : 'No'}
      </button>
    </div>
  )
}

function fmtFecha(iso: string): string {
  try { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` } catch { return iso }
}

export function MaterialEmpaqueMovimientos() {
  const navigate = useNavigate()
  const { profile } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { movimientos, loading, error, refetch } = useM42Movimientos()

  const esSuperAdmin = profile?.rol === 'super_admin'
  const orgId = profile?.org_id ?? ''

  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_INICIAL)

  const [consolAbierto, setConsolAbierto] = useState(false)
  const [consolCargando, setConsolCargando] = useState(false)
  const [consolRanchoId, setConsolRanchoId] = useState('')
  const [consolDesde, setConsolDesde] = useState('')
  const [consolHasta, setConsolHasta] = useState('')

  const setF = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }))

  const abrirFormulario = useCallback(() => {
    setForm({ ...FORM_INICIAL, fecha: hoyMX() })
    setAbierto(true)
  }, [])

  const guardar = useCallback(async () => {
    if (!orgId || !form.rancho_id) {
      toast.error(`Selecciona una ${terminosSitio.singular.toLowerCase()}`)
      return
    }
    setCargando(true)
    try {
      // INSERT movimiento sin incidencia_id aún
      const { data: movData, error: eMov } = await tbl('m42_movimientos').insert({
        org_id: orgId,
        rancho_id: form.rancho_id,
        fecha: form.fecha,
        empresa: form.empresa.trim() || null,
        descripcion_material: form.descripcion_material.trim() || null,
        entrada: form.entrada ? parseFloat(form.entrada) : null,
        salida: form.salida ? parseFloat(form.salida) : null,
        total: form.total ? parseFloat(form.total) : null,
        entrega: form.entrega.trim() || null,
        recibe: form.recibe.trim() || null,
        mat_integro: form.mat_integro,
        mat_buen_estado: form.mat_buen_estado,
        mat_limpio: form.mat_limpio,
        mat_libre_olores: form.mat_libre_olores,
        mat_libre_plagas: form.mat_libre_plagas,
        mat_otros: form.mat_otros.trim() || null,
        tr_integro: form.tr_integro,
        tr_buen_estado: form.tr_buen_estado,
        tr_limpio: form.tr_limpio,
        tr_libre_olores: form.tr_libre_olores,
        tr_libre_plagas: form.tr_libre_plagas,
        tr_otros: form.tr_otros.trim() || null,
        observaciones: form.observaciones.trim() || null,
      }).select('id').single()

      if (eMov) {
        const msg = (eMov as any).message ?? String(eMov)
        if (msg.includes('FECHA_SOLO_HOY')) {
          toast.warning('Solo puedes registrar con la fecha de hoy')
          return
        }
        throw eMov
      }

      const movId = movData.id as string

      // Crear incidencia M13 si hay presencia de plagas
      const plagasMat = !form.mat_libre_plagas
      const plagasTr = !form.tr_libre_plagas
      if (plagasMat || plagasTr) {
        try {
          const { data: rep, error: eR } = await tbl('m13_reportes').insert({
            org_id: orgId,
            rancho_id: form.rancho_id,
            fecha: form.fecha,
            auditor_nombre: profile?.nombre_completo ?? null,
          }).select('id').single()
          if (eR) throw eR

          const partes: string[] = []
          if (plagasMat) partes.push('material de empaque')
          if (plagasTr) partes.push('transporte del material')
          const desc = `Presencia de plagas detectada en: ${partes.join(' y ')}`

          const { data: inc, error: eI } = await tbl('m13_incidencias').insert({
            reporte_id: rep.id,
            org_id: orgId,
            descripcion: desc,
            orden: 1,
          }).select('id').single()
          if (eI) throw eI

          await tbl('m42_movimientos').update({ incidencia_id: inc.id }).eq('id', movId)
        } catch { /* incidencia es best-effort, el movimiento ya fue guardado */ }
      }

      await refetch()
      setAbierto(false)
      toast.success('Movimiento guardado')
      await generarMaterialEmpaquePDF(movId, orgId)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('FECHA_SOLO_HOY')) {
        toast.warning('Solo puedes registrar con la fecha de hoy')
      } else {
        toast.error(msg || 'Error al guardar')
      }
    } finally {
      setCargando(false)
    }
  }, [orgId, form, profile?.nombre_completo, refetch, terminosSitio])

  const generarConsolidado = useCallback(async () => {
    if (!consolDesde || !consolHasta) { toast.error('Selecciona el rango de fechas'); return }
    setConsolCargando(true)
    try {
      const { data: orgData } = await tbl('organizaciones').select('nombre').eq('id', orgId).single()
      const orgNombre = (orgData as any)?.nombre ?? '—'
      await generarMaterialEmpaqueConsolidadoPDF(orgId, consolRanchoId || null, consolDesde, consolHasta, orgNombre)
      setConsolAbierto(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF consolidado')
    } finally {
      setConsolCargando(false)
    }
  }, [orgId, consolRanchoId, consolDesde, consolHasta])

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ChevronLeft size={20} />
        </button>
        <PackageOpen size={18} style={{ color: 'var(--primary)' }} />
        <h1 className="text-[15px] font-semibold flex-1">Material de Empaque</h1>
        <button
          onClick={() => setConsolAbierto(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          <Download size={13} />
          Consolidado
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-3">
        {loading && <p className="text-center text-sm py-8" style={{ color: 'var(--muted-foreground)' }}>Cargando...</p>}
        {error && <p className="text-center text-sm py-8" style={{ color: 'var(--agro-danger-text)' }}>{error}</p>}
        {!loading && !error && movimientos.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: 'var(--muted-foreground)' }}>
            Sin movimientos. Toca + para registrar.
          </p>
        )}
        {movimientos.map(m => (
          <div key={m.id} className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate">{m.rancho_nombre}</p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {fmtFecha(m.fecha)}{m.empresa ? ` · ${m.empresa}` : ''}
                </p>
                {m.descripcion_material && (
                  <p className="text-[12px] mt-1 truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {m.descripcion_material}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
                  {m.entrada != null && (
                    <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Ent: {m.entrada}</span>
                  )}
                  {m.salida != null && (
                    <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Sal: {m.salida}</span>
                  )}
                  {m.total != null && (
                    <span className="text-[11px] font-medium">Total: {m.total}</span>
                  )}
                </div>
                {(!m.mat_libre_plagas || !m.tr_libre_plagas) && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <AlertTriangle size={11} style={{ color: 'var(--agro-danger-text)' }} />
                    <span className="text-[11px] font-medium" style={{ color: 'var(--agro-danger-text)' }}>
                      Presencia de plagas — incidencia generada
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => generarMaterialEmpaquePDF(m.id, orgId).catch(e => toast.error(e.message))}
                className="p-2 rounded-lg flex-shrink-0"
                style={{ color: 'var(--primary)' }}
                title="Descargar PDF"
              >
                <FileText size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={abrirFormulario}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center z-10"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        <Plus size={24} color="white" />
      </button>

      {/* Formulario */}
      {abierto && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setAbierto(false) }}
        >
          <div
            className="rounded-t-[10px] flex flex-col overflow-hidden"
            style={{ backgroundColor: 'var(--card)', height: '85%' }}
          >
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
            </div>
            <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
              <h2 className="text-[15px] font-semibold">Nuevo movimiento</h2>
              <button onClick={() => setAbierto(false)} className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
                Cancelar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
              {/* Instalación */}
              <div>
                <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  {terminosSitio.singular} *
                </label>
                <select
                  value={form.rancho_id}
                  onChange={e => setF({ rancho_id: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-[13px] border"
                  style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                >
                  <option value="">Seleccionar...</option>
                  {(ranchos as any[]).map((r: any) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Fecha *</label>
                <input
                  type="date"
                  value={form.fecha}
                  min={esSuperAdmin ? undefined : hoyMX()}
                  max={esSuperAdmin ? undefined : hoyMX()}
                  onChange={e => { if (esSuperAdmin) setF({ fecha: e.target.value }) }}
                  className="w-full rounded-lg px-3 py-2 text-[13px] border"
                  style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                />
              </div>

              {/* Empresa */}
              <div>
                <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Empresa</label>
                <input
                  type="text"
                  value={form.empresa}
                  onChange={e => setF({ empresa: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-[13px] border"
                  style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                  placeholder="Nombre de la empresa"
                />
              </div>

              {/* Descripción del material */}
              <div>
                <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  Descripción del material
                </label>
                <input
                  type="text"
                  value={form.descripcion_material}
                  onChange={e => setF({ descripcion_material: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-[13px] border"
                  style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                  placeholder="Descripción del material de empaque"
                />
              </div>

              {/* Entrada / Salida / Total */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'entrada', label: 'Entrada' },
                  { key: 'salida',  label: 'Salida'  },
                  { key: 'total',   label: 'Total'   },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</label>
                    <input
                      type="number"
                      value={(form as any)[key]}
                      onChange={e => setF({ [key]: e.target.value } as any)}
                      className="w-full rounded-lg px-3 py-2 text-[13px] border text-center"
                      style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              {/* Entrega / Recibe */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Entrega</label>
                  <input
                    type="text"
                    value={form.entrega}
                    onChange={e => setF({ entrega: e.target.value })}
                    className="w-full rounded-lg px-3 py-2 text-[13px] border"
                    style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                    placeholder="Nombre"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Recibe</label>
                  <input
                    type="text"
                    value={form.recibe}
                    onChange={e => setF({ recibe: e.target.value })}
                    className="w-full rounded-lg px-3 py-2 text-[13px] border"
                    style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                    placeholder="Nombre"
                  />
                </div>
              </div>

              {/* Condición del material */}
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--muted)' }}>
                <p className="text-[12px] font-semibold mb-2">Condición del material</p>
                <SiNoToggle value={form.mat_integro}       onChange={v => setF({ mat_integro: v })}       label="Íntegro" />
                <SiNoToggle value={form.mat_buen_estado}   onChange={v => setF({ mat_buen_estado: v })}   label="En buen estado" />
                <SiNoToggle value={form.mat_limpio}        onChange={v => setF({ mat_limpio: v })}        label="Limpio" />
                <SiNoToggle value={form.mat_libre_olores}  onChange={v => setF({ mat_libre_olores: v })}  label="Libre de malos olores" />
                <SiNoToggle value={form.mat_libre_plagas}  onChange={v => setF({ mat_libre_plagas: v })}  label="Libre de plagas" danger />
                {!form.mat_libre_plagas && (
                  <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--agro-danger-fill)' }}>
                    <p className="text-[11px] font-medium" style={{ color: 'var(--agro-danger-text)' }}>
                      Se creará una incidencia M13 al guardar
                    </p>
                  </div>
                )}
                <div className="mt-2">
                  <label className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Otros (explique)</label>
                  <input
                    type="text"
                    value={form.mat_otros}
                    onChange={e => setF({ mat_otros: e.target.value })}
                    className="w-full rounded-lg px-3 py-1.5 text-[12px] border mt-1"
                    style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                    placeholder="Observación adicional"
                  />
                </div>
              </div>

              {/* Condición del transporte */}
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--muted)' }}>
                <p className="text-[12px] font-semibold mb-2">Condición del transporte</p>
                <SiNoToggle value={form.tr_integro}       onChange={v => setF({ tr_integro: v })}       label="Íntegro" />
                <SiNoToggle value={form.tr_buen_estado}   onChange={v => setF({ tr_buen_estado: v })}   label="En buen estado" />
                <SiNoToggle value={form.tr_limpio}        onChange={v => setF({ tr_limpio: v })}        label="Limpio" />
                <SiNoToggle value={form.tr_libre_olores}  onChange={v => setF({ tr_libre_olores: v })}  label="Libre de malos olores" />
                <SiNoToggle value={form.tr_libre_plagas}  onChange={v => setF({ tr_libre_plagas: v })}  label="Libre de plagas" danger />
                {!form.tr_libre_plagas && (
                  <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--agro-danger-fill)' }}>
                    <p className="text-[11px] font-medium" style={{ color: 'var(--agro-danger-text)' }}>
                      Se creará una incidencia M13 al guardar
                    </p>
                  </div>
                )}
                <div className="mt-2">
                  <label className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Otros (explique)</label>
                  <input
                    type="text"
                    value={form.tr_otros}
                    onChange={e => setF({ tr_otros: e.target.value })}
                    className="w-full rounded-lg px-3 py-1.5 text-[12px] border mt-1"
                    style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                    placeholder="Observación adicional"
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  Observaciones
                </label>
                <textarea
                  value={form.observaciones}
                  onChange={e => setF({ observaciones: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-[13px] border resize-none"
                  style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                />
              </div>

              <button
                onClick={guardar}
                disabled={cargando || !form.rancho_id}
                className="w-full py-3 rounded-xl text-[14px] font-semibold text-white"
                style={{ backgroundColor: cargando || !form.rancho_id ? 'var(--muted-foreground)' : 'var(--primary)' }}
              >
                {cargando ? 'Guardando...' : 'Guardar y descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consolidado */}
      {consolAbierto && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setConsolAbierto(false) }}
        >
          <div
            className="rounded-t-[10px] flex flex-col overflow-hidden"
            style={{ backgroundColor: 'var(--card)', height: '52%' }}
          >
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
            </div>
            <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
              <h2 className="text-[15px] font-semibold">Exportar consolidado</h2>
              <button onClick={() => setConsolAbierto(false)} className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
                Cancelar
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
              <div>
                <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  {terminosSitio.singular} (opcional)
                </label>
                <select
                  value={consolRanchoId}
                  onChange={e => setConsolRanchoId(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-[13px] border"
                  style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                >
                  <option value="">{terminosSitio.plural}</option>
                  {(ranchos as any[]).map((r: any) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Desde</label>
                  <input
                    type="date"
                    value={consolDesde}
                    onChange={e => setConsolDesde(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-[13px] border"
                    style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Hasta</label>
                  <input
                    type="date"
                    value={consolHasta}
                    onChange={e => setConsolHasta(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-[13px] border"
                    style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                  />
                </div>
              </div>
              <button
                onClick={generarConsolidado}
                disabled={consolCargando || !consolDesde || !consolHasta}
                className="w-full py-3 rounded-xl text-[14px] font-semibold text-white"
                style={{ backgroundColor: consolCargando || !consolDesde || !consolHasta ? 'var(--muted-foreground)' : 'var(--primary)' }}
              >
                {consolCargando ? 'Generando...' : 'Generar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
