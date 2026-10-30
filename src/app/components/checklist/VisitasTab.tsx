import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarPlus, FileDown } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Boton } from '@/app/components/ui-mady/Boton'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { Input } from '@/app/components/ui/input'
import { useAuthContext } from '@/context/AuthContext'
import { hoyMX } from '@/lib/fecha'
import { chk, useAccion, useCarga, type CatalogoEstado, type ChkAlcance, type VisitaLista } from '@/hooks/useChecklistV2'
import { Aviso, Cargando, CLASE_INPUT, Chip, ErrorReintentar, PieFormulario, TONOS } from './comun'
import { useColaboradoresChk } from './useColaboradores'
import { fechaLarga } from './constantes'
import { descargarReportePdf } from './pdfVisita'

interface Props {
  instalacionId: string
  alcances: ChkAlcance[]
  catalogoEstado: CatalogoEstado
  esAdmin: boolean
  puedeRevisar: boolean
  perfilId: string | undefined
  version: number
  codigoClave: string
  onAbrirVisita: (visitaId: string) => void
  onCambio: () => void
}

const ESTADO: Record<string, { label: string; tono: typeof TONOS.exito }> = {
  programada: { label: 'Programada', tono: TONOS.info },
  en_curso: { label: 'En curso', tono: TONOS.exito },
  cerrada: { label: 'Cerrada', tono: TONOS.neutro },
  cancelada: { label: 'Cancelada', tono: TONOS.neutro },
  realizada: { label: 'Visita anterior', tono: TONOS.neutro },
}

type Modo = { tipo: 'programar' } | { tipo: 'reprogramar'; visita: VisitaLista } | { tipo: 'cancelar'; visita: VisitaLista }

export function VisitasTab({ instalacionId, alcances, catalogoEstado, esAdmin, puedeRevisar, perfilId, version, codigoClave, onAbrirVisita, onCambio }: Props) {
  const carga = useCarga<VisitaLista[]>(`${instalacionId}:${version}`, () => chk.visLista(instalacionId))
  const [modo, setModo] = useState<Modo | null>(null)
  const [pdf, setPdf] = useState<string | null>(null)
  const abrir = useAccion()

  if (carga.loading && !carga.data) return <Cargando />
  if (carga.error) return <ErrorReintentar mensaje={carga.error} onReintentar={carga.recargar} />
  const visitas = carga.data ?? []

  async function abrirVisita(v: VisitaLista) {
    const r = await abrir.ejecutar(eventId => chk.visAbrir(v.id, eventId))
    if (!r.ok) { toast.error(r.mensaje); return }
    onCambio()
    onAbrirVisita(v.id)
  }

  async function bajarPdf(v: VisitaLista) {
    setPdf(v.id)
    try { await descargarReportePdf(v, codigoClave) } catch (e) { console.error(e); toast.error('No se pudo generar el PDF') } finally { setPdf(null) }
  }

  // Puede haber una visita en curso por alcance (sin alcances: una sola)
  const hayAbiertaEn = (v: VisitaLista) => visitas.some(x => x.estado === 'en_curso' && x.id !== v.id && x.alcance_id === v.alcance_id)
  const hayAbierta = visitas.some(v => v.estado === 'en_curso')

  return (
    <div className="space-y-3">
      {esAdmin && (
        <div className="flex justify-end">
          <Boton tamano="sm" disabled={catalogoEstado !== 'aprobado'} onClick={() => setModo({ tipo: 'programar' })}>
            <CalendarPlus className="w-4 h-4" /> Programar visita
          </Boton>
        </div>
      )}
      {catalogoEstado !== 'aprobado' && <Aviso>Solo con el catálogo aprobado se pueden programar visitas.</Aviso>}
      {hayAbierta && <Aviso>{alcances.length > 0 ? 'Hay visitas en curso: solo se permite una por alcance.' : 'Hay una visita en curso: ciérrala antes de abrir otra.'}</Aviso>}

      {visitas.length === 0 ? (
        <EstadoVacio titulo="Sin visitas" ayuda="Las visitas se programan manualmente; nunca se crean solas." />
      ) : visitas.map(v => {
        const e = ESTADO[v.estado] ?? ESTADO.cerrada
        const mia = v.asesor_id === perfilId
        const reprog = v.eventos.filter(x => x.tipo.includes('reprogram')).length
        return (
          <div key={v.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{fechaLarga(v.fecha)}{v.alcance ? ` · ${v.alcance}` : ''}</p>
                <p className="text-xs text-muted-foreground">{v.asesor ?? 'Sin asesora asignada'}{reprog > 0 ? ` · reprogramada ${reprog} ${reprog === 1 ? 'vez' : 'veces'}` : ''}</p>
              </div>
              <Chip tono={e.tono}>{e.label}</Chip>
            </div>
            {v.nota && <p className="text-xs text-muted-foreground">{v.nota}</p>}
            {v.resumen && (
              <p className="text-xs text-muted-foreground">
                {v.resumen.correctos} correctos · {v.resumen.con_incidencia} con incidencia · {v.resumen.sin_revisar} sin revisar
                {v.tipo_cierre ? ` · cierre ${v.tipo_cierre}` : ''}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {v.estado === 'programada' && puedeRevisar && (esAdmin || mia) && (
                <Boton tamano="sm" cargando={abrir.ocupado} disabled={hayAbiertaEn(v)} onClick={() => abrirVisita(v)}>Abrir visita</Boton>
              )}
              {v.estado === 'en_curso' && <Boton tamano="sm" onClick={() => onAbrirVisita(v.id)}>Continuar</Boton>}
              {v.estado === 'programada' && esAdmin && (
                <>
                  <Boton tamano="sm" variante="secundario" onClick={() => setModo({ tipo: 'reprogramar', visita: v })}>Reprogramar</Boton>
                  <Boton tamano="sm" variante="secundario" onClick={() => setModo({ tipo: 'cancelar', visita: v })}>Cancelar</Boton>
                </>
              )}
              {(v.estado === 'cerrada' || v.estado === 'realizada') && (
                <Boton tamano="sm" variante="secundario" cargando={pdf === v.id} onClick={() => bajarPdf(v)}>
                  <FileDown className="w-4 h-4" /> PDF
                </Boton>
              )}
            </div>
          </div>
        )
      })}

      <VisitaAccionSheet modo={modo} instalacionId={instalacionId} alcances={alcances} onClose={() => setModo(null)} onGuardado={onCambio} />
    </div>
  )
}

// ── Programar / reprogramar / cancelar ───────────────────────────────────────

interface AccionProps {
  modo: Modo | null
  instalacionId: string
  alcances: ChkAlcance[]
  onClose: () => void
  onGuardado: () => void
}

function VisitaAccionSheet({ modo, ...resto }: AccionProps) {
  const titulo = !modo ? '' : modo.tipo === 'programar' ? 'Programar visita' : modo.tipo === 'reprogramar' ? 'Reprogramar visita' : 'Cancelar visita'
  return (
    <BottomSheet open={!!modo} onClose={resto.onClose} height={modo?.tipo === 'cancelar' ? undefined : '85%'} title={titulo}>
      {modo && <Formulario modo={modo} {...resto} />}
    </BottomSheet>
  )
}

function Formulario({ modo, instalacionId, alcances, onClose, onGuardado }: AccionProps & { modo: Modo }) {
  const { profile } = useAuthContext()
  const esSuper = profile?.rol === 'super_admin'
  const { colaboradores } = useColaboradoresChk(modo.tipo !== 'cancelar')
  const asesores = colaboradores.filter(c => c.rol === 'admin_org' || c.rol === 'asesor_tecnico')
  const inicial = modo.tipo === 'programar' ? null : modo.visita
  const [fecha, setFecha] = useState(inicial?.fecha.slice(0, 10) ?? hoyMX())
  const [asesor, setAsesor] = useState(inicial?.asesor_id ?? profile?.id ?? '')
  const activos = alcances.filter(a => a.activo)
  const [alcance, setAlcance] = useState('')
  const [texto, setTexto] = useState(modo.tipo === 'programar' ? '' : '')
  const { ocupado, ejecutar } = useAccion()
  const motivoObligatorio = modo.tipo !== 'programar'

  async function guardar() {
    if (modo.tipo !== 'cancelar') {
      if (!fecha) { toast.warning('Indica la fecha'); return }
      if (!esSuper && fecha < hoyMX()) { toast.warning('La fecha no puede ser anterior a hoy'); return }
    }
    if (modo.tipo === 'programar' && activos.length > 0 && !alcance) { toast.warning('Elige el alcance de la visita'); return }
    if (motivoObligatorio && texto.trim().length < 3) { toast.warning('El motivo es obligatorio'); return }
    const r = await ejecutar(eventId => {
      if (modo.tipo === 'programar') return chk.visProgramar({ instalacion: instalacionId, fecha, asesor: asesor || profile?.id || null, nota: texto.trim() || null, alcance: alcance || null, eventId })
      if (modo.tipo === 'reprogramar') return chk.visReprogramar({ visita: modo.visita.id, fecha, asesor: asesor || profile?.id || null, motivo: texto.trim(), eventId })
      return chk.visCancelar({ visita: modo.visita.id, motivo: texto.trim(), eventId })
    })
    if (!r.ok) { toast.error(r.mensaje); return }
    toast.success(modo.tipo === 'programar' ? 'Visita programada' : modo.tipo === 'reprogramar' ? 'Visita reprogramada' : 'Visita cancelada')
    onGuardado()
    onClose()
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {modo.tipo === 'programar' && activos.length > 0 && (
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Alcance (obligatorio)</span>
            <select className={CLASE_INPUT} value={alcance} onChange={e => setAlcance(e.target.value)}>
              <option value="">Elige un alcance</option>
              {activos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </label>
        )}
        {modo.tipo !== 'cancelar' && (
          <>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Fecha</span>
              <input type="date" className={CLASE_INPUT} value={fecha} min={esSuper ? undefined : hoyMX()} onChange={e => setFecha(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Asesora asignada</span>
              <select className={CLASE_INPUT} value={asesor} onChange={e => setAsesor(e.target.value)}>
                {asesores.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </label>
          </>
        )}
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">{motivoObligatorio ? 'Motivo (obligatorio)' : 'Nota (opcional)'}</span>
          <Input value={texto} maxLength={300} onChange={e => setTexto(e.target.value)} />
        </label>
      </div>
      <PieFormulario onCancelar={onClose} onGuardar={guardar} cargando={ocupado}
        textoGuardar={modo.tipo === 'programar' ? 'Programar' : modo.tipo === 'reprogramar' ? 'Reprogramar' : 'Cancelar visita'} />
    </>
  )
}
