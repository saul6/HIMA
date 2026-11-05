import { Upload } from 'lucide-react'
import { ListaTarjetas } from '@/app/components/ui-mady/ListaTarjetas'
import { TarjetaRegistro } from '@/app/components/ui-mady/TarjetaRegistro'
import { motion, useReducedMotion } from 'motion/react'
import { entrada, fundidoEntrada, useEntradaPantalla } from '@/app/screens/auditor/motionAuditor'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { Boton } from '@/app/components/ui-mady/Boton'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { chk, useCarga, type ImportacionLista } from '@/hooks/useChecklistV2'
import { Chip, ErrorReintentar, TONOS } from './comun'
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
  const reducedMotion = useReducedMotion()
  if (carga.loading && !carga.data) return <ListaSkeleton rejilla rows={2} onReintentar={carga.recargar} />
  if (carga.error) return <ErrorReintentar mensaje={carga.error} onReintentar={carga.recargar} />
  const lista = carga.data ?? []
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Boton tamano="sm" onClick={onImportar}><Upload className="w-4 h-4" /> Importar</Boton>
      </div>
      {lista.length === 0 ? (
        <EstadoVacio titulo="Sin importaciones" ayuda="Importa un PDF o Word para llenar el catálogo." />
      ) : (
        <ListaTarjetas>
          {lista.map((m, n) => {
            const e = ESTADO[m.estado] ?? ESTADO.cancelada
            return (
              <motion.div key={m.id} className="min-w-0" {...entrada(n, reducedMotion)}>
              <TarjetaRegistro
                sinFirmas
                titulo={<span className="break-all">{m.archivo_nombre}</span>}
                tituloTexto={m.archivo_nombre}
                alHacerClic={() => onAbrir(m.id)}
                acciones={<Chip tono={e.tono}>{e.label}</Chip>}
                contenido={(
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.total_filas} renglones · {m.formato.toUpperCase()} · {fechaLarga(m.creado_en)}{m.creado_por ? ` · ${m.creado_por}` : ''}
                  </p>
                )}
              />
              </motion.div>
            )
          })}
        </ListaTarjetas>
      )}
    </div>
  )
}
