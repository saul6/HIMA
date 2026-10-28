// Vista "Mis revisiones" del cliente ligado: visitas cerradas con su PDF e incidencias con "Reportar corrección".
import { useState } from 'react'
import { toast } from 'sonner'
import { FileDown } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Boton } from '@/app/components/ui-mady/Boton'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { chk, useAccion, useCarga, type PortalConsultoria, type PortalIncidencia } from '@/hooks/useChecklistV2'
import { CLASE_TEXTAREA, Cargando, Chip, ErrorReintentar, PieFormulario, TONOS } from './comun'
import { SeguimientosLista, etiquetaEstadoIncidencia } from './IncidenciasTab'
import { fechaLarga } from './constantes'

export function PortalCliente() {
  const carga = useCarga<PortalConsultoria[]>('portal', () => chk.clientePortal())
  const [reportar, setReportar] = useState<PortalIncidencia | null>(null)
  const [pdf, setPdf] = useState<string | null>(null)

  async function bajarPdf(id: string) {
    setPdf(id)
    try {
      const { generarReporteVisitaPDF } = await import('@/lib/pdf/m80/generarReporteVisitaPDF')
      await generarReporteVisitaPDF(id)
    } catch (e) { console.error(e); toast.error('No se pudo generar el PDF') } finally { setPdf(null) }
  }

  if (carga.loading && !carga.data) return <Cargando />
  if (carga.error) return <ErrorReintentar mensaje={carga.error} onReintentar={carga.recargar} />
  const lista = carga.data ?? []
  const hayInst = lista.some(c => c.instalaciones.length > 0)
  if (!hayInst) return <EstadoVacio titulo="Aún no hay revisiones" ayuda="Cuando tu consultoría cierre una visita, aparecerá aquí." />

  return (
    <div className="space-y-6">
      {lista.map(c => (
        <div key={c.consultoria} className="space-y-4">
          <TituloSeccion as="h2" className="mb-0">{c.consultoria}</TituloSeccion>
          {c.instalaciones.map(i => (
            <section key={i.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-sm font-semibold">{i.nombre}</p>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Visitas cerradas</p>
                {i.visitas.length === 0 ? <p className="text-xs text-muted-foreground">Sin visitas cerradas.</p> : i.visitas.map(v => (
                  <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{fechaLarga(v.fecha)}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.asesor ?? ''}{v.resumen ? ` · ${v.resumen.correctos} correctos · ${v.resumen.con_incidencia} con incidencia` : ''}{v.tipo_cierre ? ` · ${v.tipo_cierre}` : ''}
                      </p>
                    </div>
                    <Boton tamano="sm" variante="secundario" cargando={pdf === v.id} onClick={() => bajarPdf(v.id)}><FileDown className="w-4 h-4" /> PDF</Boton>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Incidencias</p>
                {i.incidencias.length === 0 ? <p className="text-xs text-muted-foreground">Sin incidencias.</p> : i.incidencias.map(x => {
                  const e = etiquetaEstadoIncidencia(x.estado)
                  return (
                    <div key={x.id} className="rounded-lg border border-border p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{[x.codigo, x.documento].filter(Boolean).join(' · ')}</p>
                        <Chip tono={e.tono}>{e.label}</Chip>
                      </div>
                      <p className="text-sm">{x.descripcion}</p>
                      <p className="text-xs text-muted-foreground">
                        {x.origen_fecha ? `Detectada el ${fechaLarga(x.origen_fecha)}` : ''}{x.responsable ? ` · Responsable: ${x.responsable}` : ''}{x.fecha_compromiso ? ` · Compromiso: ${fechaLarga(x.fecha_compromiso)}` : ''}
                      </p>
                      <SeguimientosLista items={x.seguimientos} />
                      {x.estado !== 'cerrada' && x.estado !== 'correccion_reportada' && (
                        <Boton tamano="sm" variante="secundario" onClick={() => setReportar(x)}>Reportar corrección</Boton>
                      )}
                      {x.estado === 'correccion_reportada' && <p className="text-xs" style={{ color: TONOS.info.text }}>Corrección reportada: la consultoría la revisará.</p>}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      ))}

      <BottomSheet open={!!reportar} onClose={() => setReportar(null)} title="Reportar corrección">
        {reportar && <FormReportar incidencia={reportar} onClose={() => setReportar(null)} onGuardado={() => void carga.recargar()} />}
      </BottomSheet>
    </div>
  )
}

function FormReportar({ incidencia, onClose, onGuardado }: { incidencia: PortalIncidencia; onClose: () => void; onGuardado: () => void }) {
  const [texto, setTexto] = useState('')
  const { ocupado, ejecutar } = useAccion()
  async function guardar() {
    if (texto.trim().length < 3) { toast.warning('Describe qué se corrigió (mínimo 3 caracteres)'); return }
    const r = await ejecutar(eventId => chk.clienteReportar(incidencia.id, texto.trim(), eventId))
    if (!r.ok) { toast.error(r.mensaje); return }
    toast.success('Corrección reportada. La consultoría la revisará.')
    onGuardado(); onClose()
  }
  return (
    <>
      <div className="px-4 py-4 space-y-3">
        <p className="text-sm">{incidencia.descripcion}</p>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">¿Qué se corrigió?</span>
          <textarea className={CLASE_TEXTAREA} value={texto} maxLength={2000} onChange={e => setTexto(e.target.value)} />
        </label>
        <p className="text-xs text-muted-foreground">Solo la consultoría puede cerrar la incidencia.</p>
      </div>
      <PieFormulario onCancelar={onClose} onGuardar={guardar} textoGuardar="Reportar" cargando={ocupado} />
    </>
  )
}
