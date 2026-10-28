import { Upload } from 'lucide-react'
import { Boton } from '@/app/components/ui-mady/Boton'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { chk, useCarga, type ImportacionLista } from '@/hooks/useChecklistV2'
import { Cargando, Chip, ErrorReintentar, TONOS } from './comun'
import { fechaLarga } from './constantes'

interface Props {
  instalacionId: string
  /** Cambia cuando se aplica o cancela una importación, para recargar la lista. */
  version: number
  onAbrir: (importacionId: string) => void
  onImportar: () => void
}

const ESTADO: Record<string, { label: string; tono: typeof TONOS.exito }> = {
  revision: { label: 'En revisión', tono: TONOS.info },
  aplicada: { label: 'Aplicada', tono: TONOS.exito },
  cancelada: { label: 'Cancelada', tono: TONOS.neutro },
}

export function ImportacionesTab({ instalacionId, version, onAbrir, onImportar }: Props) {
  const carga = useCarga<ImportacionLista[]>(`${instalacionId}:${version}`, () => chk.importaciones(instalacionId))
  if (carga.loading && !carga.data) return <Cargando />
  if (carga.error) return <ErrorReintentar mensaje={carga.error} onReintentar={carga.recargar} />
  const lista = carga.data ?? []
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Boton tamano="sm" onClick={onImportar}><Upload className="w-4 h-4" /> Importar</Boton>
      </div>
      {lista.length === 0 ? (
        <EstadoVacio titulo="Sin importaciones" ayuda="Importa un PDF o Word para llenar el catálogo." />
      ) : lista.map(m => {
        const e = ESTADO[m.estado] ?? ESTADO.cancelada
        return (
          <button key={m.id} type="button" onClick={() => onAbrir(m.id)} className="w-full text-left rounded-xl border border-border bg-card p-3 space-y-1 hover:bg-muted/50">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold break-all">{m.archivo_nombre}</p>
              <Chip tono={e.tono}>{e.label}</Chip>
            </div>
            <p className="text-xs text-muted-foreground">
              {m.total_filas} renglones · {m.formato.toUpperCase()} · {fechaLarga(m.creado_en)}{m.creado_por ? ` · ${m.creado_por}` : ''}
            </p>
          </button>
        )
      })}
    </div>
  )
}
