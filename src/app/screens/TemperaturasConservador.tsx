import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Thermometer, Download, Plus, FileText, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { puedeEditarFechaLibre } from '@/lib/permisos'
import { useRanchos } from '@/hooks/useRanchos'
import { useM41TemperaturaConservador } from '@/hooks/useM41TemperaturaConservador'
import { useModulosContext } from '@/context/ModulosContext'
import { supabase } from '@/lib/supabase'
import { generarTemperaturaConservadorPDF } from '@/lib/pdf/m41/generarTemperaturaConservadorPDF'
import { generarTemperaturaConservadorConsolidadoPDF } from '@/lib/pdf/m41/generarTemperaturaConservadorConsolidadoPDF'

const hoyMX = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
const HORAS = Array.from({ length: 24 }, (_, i) => i + 1)

type LecturasState = Record<number, { temp: string; incidenciaId: string | null }>

interface FormState {
  rancho_id: string
  fecha: string
  temp_min: string
  temp_max: string
  observaciones: string
}

function isOutOfRange(tempStr: string, minStr: string, maxStr: string): boolean {
  if (!tempStr.trim()) return false
  const t = parseFloat(tempStr)
  if (isNaN(t)) return false
  if (minStr && !isNaN(parseFloat(minStr)) && t < parseFloat(minStr)) return true
  if (maxStr && !isNaN(parseFloat(maxStr)) && t > parseFloat(maxStr)) return true
  return false
}

function fmtFecha(iso: string): string {
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch { return iso }
}

export function TemperaturasConservador() {
  const navigate = useNavigate()
  const { profile, user, codigoClave } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { registros, loading, error, refetch } = useM41TemperaturaConservador()

  const esSuperAdmin = profile?.rol === 'super_admin'
  const puedeEditarFecha = esSuperAdmin || puedeEditarFechaLibre(user?.email)
  const orgId = profile?.org_id ?? ''

  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [form, setForm] = useState<FormState>({ rancho_id: '', fecha: hoyMX(), temp_min: '', temp_max: '', observaciones: '' })
  const [lecturas, setLecturas] = useState<LecturasState>({})
  const [registroExistenteId, setRegistroExistenteId] = useState<string | null>(null)
  const [cargandoLecturas, setCargandoLecturas] = useState(false)

  const [consolAbierto, setConsolAbierto] = useState(false)
  const [consolCargando, setConsolCargando] = useState(false)
  const [consolRanchoId, setConsolRanchoId] = useState('')
  const [consolDesde, setConsolDesde] = useState('')
  const [consolHasta, setConsolHasta] = useState('')

  const abrirFormulario = useCallback(() => {
    const hoy = hoyMX()
    setForm({ rancho_id: '', fecha: hoy, temp_min: '', temp_max: '', observaciones: '' })
    setLecturas({})
    setRegistroExistenteId(null)
    setAbierto(true)
  }, [])

  const handleRanchoChange = useCallback(async (ranchoId: string, fecha: string) => {
    setForm(f => ({ ...f, rancho_id: ranchoId, temp_min: '', temp_max: '', observaciones: '' }))
    setLecturas({})
    setRegistroExistenteId(null)
    if (!ranchoId) return

    const existing = registros.find(r => r.rancho_id === ranchoId && r.fecha === fecha)
    if (existing) {
      setRegistroExistenteId(existing.id)
      setForm(f => ({
        ...f,
        rancho_id: ranchoId,
        temp_min: existing.temp_min != null ? String(existing.temp_min) : '',
        temp_max: existing.temp_max != null ? String(existing.temp_max) : '',
      }))
      setCargandoLecturas(true)
      try {
        const { data: lects, error: eL } = await (supabase as any)
          .from('m41_lecturas')
          .select('hora, temperatura, incidencia_id')
          .eq('registro_id', existing.id)
          .order('hora')
        if (eL) throw eL
        const map: LecturasState = {}
        for (const l of (lects ?? []) as any[]) {
          map[l.hora] = { temp: l.temperatura != null ? String(l.temperatura) : '', incidenciaId: l.incidencia_id ?? null }
        }
        setLecturas(map)
      } catch { /* silencio */ } finally {
        setCargandoLecturas(false)
      }
    } else {
      const last = registros.find(r => r.rancho_id === ranchoId)
      if (last) {
        setForm(f => ({
          ...f,
          rancho_id: ranchoId,
          temp_min: last.temp_min != null ? String(last.temp_min) : '',
          temp_max: last.temp_max != null ? String(last.temp_max) : '',
        }))
      }
    }
  }, [registros])

  const guardar = useCallback(async () => {
    if (!orgId || !form.rancho_id) { toast.error(`Selecciona una ${terminosSitio.singular.toLowerCase()}`); return }
    setCargando(true)
    try {
      let regId: string
      if (registroExistenteId) {
        const { error } = await (supabase as any)
          .from('m41_registros')
          .update({
            temp_min: form.temp_min ? parseFloat(form.temp_min) : null,
            temp_max: form.temp_max ? parseFloat(form.temp_max) : null,
            observaciones: form.observaciones.trim() || null,
          })
          .eq('id', registroExistenteId)
        if (error) throw error
        regId = registroExistenteId
      } else {
        const { data: ins, error } = await (supabase as any)
          .from('m41_registros')
          .insert({
            org_id: orgId,
            rancho_id: form.rancho_id,
            fecha: form.fecha,
            temp_min: form.temp_min ? parseFloat(form.temp_min) : null,
            temp_max: form.temp_max ? parseFloat(form.temp_max) : null,
            observaciones: form.observaciones.trim() || null,
          })
          .select('id').single()
        if (error) {
          if ((error as any).code === '23505') {
            toast.warning(`Ya existe un registro para esta ${terminosSitio.singular.toLowerCase()} hoy. Selecciónala de nuevo para editar.`)
            return
          }
          throw error
        }
        regId = ins.id
      }

      // Detectar lecturas fuera de rango sin incidencia previa
      const horasConTemp = HORAS.filter(h => (lecturas[h]?.temp ?? '').trim() !== '')
      const nuevasOOR = horasConTemp.filter(h =>
        isOutOfRange(lecturas[h].temp, form.temp_min, form.temp_max) && !lecturas[h]?.incidenciaId
      )

      const incMap: Record<number, string> = {}
      if (nuevasOOR.length > 0) {
        const { data: rep, error: eR } = await (supabase as any)
          .from('m13_reportes')
          .insert({ org_id: orgId, rancho_id: form.rancho_id, fecha: form.fecha, auditor_nombre: profile?.nombre_completo ?? null })
          .select('id').single()
        if (eR) throw eR
        for (const hora of nuevasOOR) {
          const t = parseFloat(lecturas[hora].temp)
          const minLabel = form.temp_min ? `${form.temp_min} – ` : ''
          const maxLabel = form.temp_max ? `${form.temp_max} C` : ''
          const desc = `Temperatura fuera de rango a las ${String(hora).padStart(2, '0')}:00 hs: ${t} C (objetivo: ${minLabel}${maxLabel})`
          const { data: inc, error: eI } = await (supabase as any)
            .from('m13_incidencias')
            .insert({ reporte_id: rep.id, org_id: orgId, descripcion: desc, orden: hora })
            .select('id').single()
          if (eI) throw eI
          incMap[hora] = inc.id
        }
      }

      if (horasConTemp.length > 0) {
        const rows = horasConTemp.map(h => ({
          registro_id: regId,
          org_id: orgId,
          hora: h,
          temperatura: parseFloat(lecturas[h].temp),
          incidencia_id: incMap[h] ?? lecturas[h]?.incidenciaId ?? null,
        }))
        const { error: eU } = await (supabase as any)
          .from('m41_lecturas')
          .upsert(rows, { onConflict: 'registro_id,hora' })
        if (eU) throw eU
      }

      await refetch()
      setAbierto(false)
      toast.success('Registro guardado')
      await generarTemperaturaConservadorPDF(regId, orgId, codigoClave)
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
  }, [orgId, form, lecturas, registroExistenteId, profile?.nombre_completo, refetch, terminosSitio])

  const generarConsolidado = useCallback(async () => {
    if (!consolDesde || !consolHasta) { toast.error('Selecciona el rango de fechas'); return }
    setConsolCargando(true)
    try {
      const { data: orgData } = await (supabase as any)
        .from('organizaciones').select('nombre').eq('id', orgId).single()
      const orgNombre = (orgData as any)?.nombre ?? '—'
      const ranchoSel = consolRanchoId ? ranchos.find((r: any) => r.id === consolRanchoId) : null
      const instalNombre = (ranchoSel as any)?.nombre ?? terminosSitio.plural
      await generarTemperaturaConservadorConsolidadoPDF(orgId, consolRanchoId || null, consolDesde, consolHasta, instalNombre, orgNombre, codigoClave)
      setConsolAbierto(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF consolidado')
    } finally {
      setConsolCargando(false)
    }
  }, [orgId, consolRanchoId, consolDesde, consolHasta, ranchos, terminosSitio, codigoClave])

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ChevronLeft size={20} />
        </button>
        <Thermometer size={18} style={{ color: 'var(--primary)' }} />
        <h1 className="text-[15px] font-semibold flex-1">Temperaturas del Conservador</h1>
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
        {loading && (
          <p className="text-center text-sm py-8" style={{ color: 'var(--muted-foreground)' }}>Cargando...</p>
        )}
        {error && (
          <p className="text-center text-sm py-8" style={{ color: 'var(--agro-danger-text)' }}>{error}</p>
        )}
        {!loading && !error && registros.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: 'var(--muted-foreground)' }}>
            Sin registros. Toca + para agregar.
          </p>
        )}
        {registros.map(r => (
          <div key={r.id} className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate">{r.rancho_nombre}</p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{fmtFecha(r.fecha)}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
                  {(r.temp_min != null || r.temp_max != null) && (
                    <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                      Rango: {r.temp_min ?? '—'} – {r.temp_max ?? '—'} °C
                    </span>
                  )}
                  <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                    {r.lecturas_count} lectura{r.lecturas_count !== 1 ? 's' : ''}
                  </span>
                </div>
                {r.fuera_de_rango && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <AlertTriangle size={11} style={{ color: 'var(--agro-danger-text)' }} />
                    <span className="text-[11px] font-medium" style={{ color: 'var(--agro-danger-text)' }}>
                      Con incidencias
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => generarTemperaturaConservadorPDF(r.id, orgId).catch(e => toast.error(e.message))}
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
              <h2 className="text-[15px] font-semibold">
                {registroExistenteId ? 'Actualizar registro' : 'Nuevo registro'}
              </h2>
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
                  onChange={e => handleRanchoChange(e.target.value, form.fecha)}
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
                <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  Fecha *
                </label>
                <input
                  type="date"
                  value={form.fecha}
                  min={puedeEditarFecha ? undefined : hoyMX()}
                  max={puedeEditarFecha ? undefined : hoyMX()}
                  onChange={e => { if (puedeEditarFecha) setForm(f => ({ ...f, fecha: e.target.value })) }}
                  className="w-full rounded-lg px-3 py-2 text-[13px] border"
                  style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                />
              </div>

              {/* Rango objetivo */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>
                    Temp. mínima (°C)
                  </label>
                  <input
                    type="number"
                    value={form.temp_min}
                    onChange={e => setForm(f => ({ ...f, temp_min: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 text-[13px] border"
                    style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                    placeholder="ej. 2"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>
                    Temp. máxima (°C)
                  </label>
                  <input
                    type="number"
                    value={form.temp_max}
                    onChange={e => setForm(f => ({ ...f, temp_max: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 text-[13px] border"
                    style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border)' }}
                    placeholder="ej. 8"
                  />
                </div>
              </div>

              {/* Grid de 24 horas */}
              <div>
                <label className="text-[12px] font-medium block mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  Lecturas por hora
                </label>
                {cargandoLecturas ? (
                  <p className="text-[12px] py-2" style={{ color: 'var(--muted-foreground)' }}>Cargando lecturas...</p>
                ) : (
                  <div className="overflow-x-auto -mx-5 px-5">
                    <div style={{ minWidth: 1380 }}>
                      {/* Etiquetas de horas */}
                      <div className="flex mb-1">
                        <div style={{ width: 48, flexShrink: 0 }} />
                        {HORAS.map(h => (
                          <div
                            key={h}
                            style={{ width: 54, flexShrink: 0, textAlign: 'center', fontSize: 10, color: 'var(--muted-foreground)' }}
                          >
                            {String(h).padStart(2, '0')}:00
                          </div>
                        ))}
                      </div>
                      {/* Inputs de temperatura */}
                      <div className="flex items-center">
                        <div style={{ width: 48, flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>
                          °C
                        </div>
                        {HORAS.map(h => {
                          const val = lecturas[h]?.temp ?? ''
                          const oor = isOutOfRange(val, form.temp_min, form.temp_max)
                          return (
                            <div key={h} style={{ width: 54, flexShrink: 0, padding: '0 2px' }}>
                              <input
                                type="number"
                                value={val}
                                onChange={e => setLecturas(prev => ({
                                  ...prev,
                                  [h]: { temp: e.target.value, incidenciaId: prev[h]?.incidenciaId ?? null },
                                }))}
                                placeholder="—"
                                style={{
                                  width: '100%',
                                  height: 34,
                                  textAlign: 'center',
                                  fontSize: 12,
                                  borderRadius: 6,
                                  border: `1px solid ${oor ? 'var(--agro-danger-text)' : 'var(--border)'}`,
                                  backgroundColor: oor ? 'var(--agro-danger-fill)' : 'var(--input-background)',
                                  color: oor ? 'var(--agro-danger-text)' : 'inherit',
                                  outline: 'none',
                                }}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Observaciones */}
              <div>
                <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  Observaciones
                </label>
                <textarea
                  value={form.observaciones}
                  onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
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
                {cargando ? 'Guardando...' : registroExistenteId ? 'Actualizar y descargar PDF' : 'Guardar y descargar PDF'}
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
