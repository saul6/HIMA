import { useState } from 'react'
import { toast } from 'sonner'
import { Boton } from '@/app/components/ui-mady/Boton'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { chk, useAccion, useCarga, type EstadoVinculo, type TipoVinculo, type Vinculo, type VinculoDocRef } from '@/hooks/useChecklistV2'
import { Aviso, Cargando, Chip, ErrorReintentar, TONOS } from './comun'
import { NOMBRE_SECCION_CORTO } from './secciones'

interface Props { instalacionId: string; version: number }

const TIPOS: Record<TipoVinculo, string> = { contexto: 'Contexto', parcial: 'Parcial', directo: 'Directo' }
const ESTADOS: { value: EstadoVinculo; label: string }[] = [
  { value: 'sugerido', label: 'Sugeridas' },
  { value: 'confirmado', label: 'Confirmadas' },
  { value: 'descartado', label: 'Descartadas' },
]

/** Relaciones entre documentos de tablas distintas: solo contexto. Se decide de una en una, nunca en lote. */
export function RelacionesTab({ instalacionId, version }: Props) {
  const [estado, setEstado] = useState<EstadoVinculo>('sugerido')
  const [local, setLocal] = useState(0)
  const carga = useCarga<Vinculo[]>(`${instalacionId}:${estado}:${version}:${local}`, () => chk.vinculosLista(instalacionId, estado))

  if (carga.loading && !carga.data) return <Cargando />
  if (carga.error) return <ErrorReintentar mensaje={carga.error} onReintentar={carga.recargar} />
  const lista = carga.data ?? []

  return (
    <div className="space-y-3">
      <Aviso>Las relaciones confirmadas solo se muestran como referencia dentro de la visita. Nunca copian el estado ni los comentarios de otro documento.</Aviso>
      <FiltroPildoras<string> groupId="chk-relaciones-estado" value={estado} onChange={v => setEstado(v as EstadoVinculo)} options={ESTADOS} />
      {lista.length === 0 ? (
        <EstadoVacio titulo={estado === 'sugerido' ? 'No hay relaciones sugeridas' : 'Sin relaciones en este estado'} ayuda="Las sugerencias nacen al importar un documento con candidatos de la Tabla 1." />
      ) : lista.map(v => <FilaVinculo key={v.id} v={v} onCambio={() => setLocal(n => n + 1)} />)}
    </div>
  )
}

function DocRef({ d, etiqueta }: { d: VinculoDocRef; etiqueta: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-foreground">{etiqueta} · {NOMBRE_SECCION_CORTO[d.seccion]}</p>
      <p className="text-sm font-semibold">{d.nombre}</p>
      {d.codigo && <p className="text-xs text-muted-foreground">{d.codigo}</p>}
    </div>
  )
}

function FilaVinculo({ v, onCambio }: { v: Vinculo; onCambio: () => void }) {
  const [tipo, setTipo] = useState<TipoVinculo>(v.tipo)
  const { ocupado, ejecutar } = useAccion()

  async function decidir(estado: EstadoVinculo) {
    const r = await ejecutar(() => chk.vinculoGuardar({ origen: v.origen.id, destino: v.destino.id, tipo, estado, nota: v.nota }))
    if (!r.ok) { toast.error(r.mensaje); return }
    toast.success(estado === 'confirmado' ? 'Relación confirmada' : estado === 'descartado' ? 'Relación descartada' : 'Relación guardada')
    onCambio()
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
      <div className="flex flex-col sm:flex-row gap-3">
        <DocRef d={v.origen} etiqueta="Documento" />
        <DocRef d={v.destino} etiqueta="Relacionado con" />
      </div>
      {v.nota && <p className="text-xs text-muted-foreground whitespace-pre-line">{v.nota}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Tipo de relación" className="h-9 rounded-lg border border-border-control bg-card px-2 text-xs" value={tipo} onChange={e => setTipo(e.target.value as TipoVinculo)}>
          {(Object.keys(TIPOS) as TipoVinculo[]).map(t => <option key={t} value={t}>{TIPOS[t]}</option>)}
        </select>
        {v.estado !== 'sugerido' && <Chip tono={v.estado === 'confirmado' ? TONOS.exito : TONOS.neutro}>{v.estado === 'confirmado' ? 'Confirmada' : 'Descartada'}{v.decidido_por ? ` · ${v.decidido_por}` : ''}</Chip>}
        <div className="ml-auto flex gap-2">
          {v.estado !== 'confirmado' && <Boton tamano="sm" cargando={ocupado} onClick={() => decidir('confirmado')}>Confirmar</Boton>}
          {v.estado !== 'descartado' && <Boton tamano="sm" variante="secundario" cargando={ocupado} onClick={() => decidir('descartado')}>Descartar</Boton>}
        </div>
      </div>
    </div>
  )
}
