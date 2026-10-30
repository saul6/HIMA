import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileUp } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Aviso, CLASE_INPUT, Chip, TONOS } from './comun'
import { chk, mensajeError, type ChkAlcance } from '@/hooks/useChecklistV2'
import type { ArchivoLeido } from '@/lib/checklist/importar'
import { construirFilasTablas } from '@/lib/checklist/importar/tresTablas'

interface Props {
  open: boolean
  instalacionId: string
  /** alcances activos de la instalación */
  alcances: ChkAlcance[]
  onClose: () => void
  /** Importación creada: se abre la vista previa. */
  onCreada: (importacionId: string) => void
}

export function ImportarSheet({ open, ...resto }: Props) {
  return (
    <BottomSheet open={open} onClose={resto.onClose} height="85%" title="Importar catálogo">
      {open && <Cuerpo {...resto} />}
    </BottomSheet>
  )
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function Cuerpo({ instalacionId, alcances, onClose, onCreada }: Omit<Props, 'open'>) {
  const input = useRef<HTMLInputElement>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [archivo, setArchivo] = useState<ArchivoLeido | null>(null)
  const [error, setError] = useState<string | null>(null)
  // alcance elegido para cada columna de fecha de la Tabla 1 ('' = sin asignar)
  const [columnas, setColumnas] = useState<string[]>([])

  async function elegir(file: File | undefined) {
    if (!file) return
    setError(null); setArchivo(null); setLeyendo(true)
    try {
      // Carga perezosa: pdfjs-dist y mammoth solo se bajan al abrir el importador
      const { leerArchivo } = await import('@/lib/checklist/importar')
      const r = await leerArchivo(file)
      const hayTablas = !!r.tablas && r.tablas.t1.length + r.tablas.t2.length + r.tablas.t3.length > 0
      if (r.filas.length === 0 && !hayTablas) setError('No se encontraron renglones de documentos en el archivo. Revisa que tenga la tabla con encabezados (Nombre, Código…).')
      else {
        setArchivo(r)
        // Propuesta: la columna cuyo encabezado nombra a un alcance; con una sola columna y un solo alcance, ese alcance
        const cols = r.tablas?.columnasFecha ?? []
        setColumnas(cols.map(c => alcances.find(a => sinAcentos(c).includes(sinAcentos(a.nombre)))?.id ?? (cols.length === 1 && alcances.length === 1 ? alcances[0].id : '')))
      }
    } catch (e) {
      console.error('[checklist] leer archivo', e)
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo')
    } finally {
      setLeyendo(false)
      if (input.current) input.current.value = ''
    }
  }

  const tablas = archivo?.tablas
  const pideColumnas = !!tablas && tablas.t1.length > 0 && (tablas.columnasFecha.length > 1 || alcances.length > 0)
  const columnasListas = !pideColumnas || (tablas!.columnasFecha.length > 1 ? columnas.some(c => c) : true)
  // Filas finales: con alcances elegidos se arman de nuevo; si no, las que ya trajo el archivo
  const filas = useMemo(() => {
    if (!archivo) return []
    if (!tablas || !pideColumnas) return archivo.filas
    return construirFilasTablas(tablas, { alcancePorColumna: columnas.map(c => c || null), alcances })
  }, [archivo, tablas, pideColumnas, columnas, alcances])

  async function crear() {
    if (!archivo) return
    setSubiendo(true)
    try {
      const r = await chk.importacionCrear({
        instalacion: instalacionId, nombre: archivo.nombre, hash: archivo.hash, formato: archivo.formato, filas,
      })
      toast.success('Archivo leído. Revisa la vista previa antes de aplicar.')
      onClose()
      onCreada(r.importacion_id)
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setSubiendo(false)
    }
  }

  const conAlertas = filas.filter(f => f.alertas.length > 0).length ?? 0

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Sube el checklist de documentos en PDF (con texto) o Word. Nada se guarda en el catálogo hasta que revises cada renglón y apliques.
        </p>
        <input ref={input} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only" id="chk-archivo" onChange={e => void elegir(e.target.files?.[0])} />
        <Boton type="button" variante="secundario" cargando={leyendo} onClick={() => input.current?.click()}>
          <FileUp className="w-4 h-4" /> {archivo ? 'Elegir otro archivo' : 'Elegir archivo (.pdf o .docx, máx. 10 MB)'}
        </Boton>
        {leyendo && <p className="text-sm text-muted-foreground" role="status">Leyendo el archivo…</p>}
        {error && <Aviso>{error}</Aviso>}
        {archivo && (
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <p className="text-sm font-semibold break-all">{archivo.nombre}</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip>{filas.length} renglones</Chip>
              {tablas && <Chip>Tabla 1 · {filas.filter(f => f.datos.seccion === 1).length}</Chip>}
              {tablas && <Chip>Tabla 2 · {filas.filter(f => f.datos.seccion === 2).length}</Chip>}
              {tablas && tablas.t3.length > 0 && <Chip>Tabla 3 · {filas.filter(f => f.datos.seccion === 3).length}</Chip>}
              {conAlertas > 0 && <Chip tono={TONOS.info}>{conAlertas} con alertas</Chip>}
            </div>
            {pideColumnas && tablas && (
              <div className="space-y-2">
                <p className="text-xs font-semibold">¿Qué columna de fecha corresponde a qué alcance?</p>
                {tablas.columnasFecha.map((titulo, i) => (
                  <label key={i} className="block space-y-1">
                    <span className="text-xs text-muted-foreground">Columna “{titulo}”</span>
                    <select className={CLASE_INPUT} value={columnas[i] ?? ''} onChange={e => setColumnas(cs => cs.map((c, k) => (k === i ? e.target.value : c)))}>
                      <option value="">{tablas.columnasFecha.length > 1 ? 'No importar esta columna' : 'Compartido (sin alcance)'}</option>
                      {alcances.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </label>
                ))}
                {tablas.columnasFecha.length > 1 && <p className="text-xs text-muted-foreground">La Tabla 1 se crea una vez por alcance, cada una con su fecha. La Tabla 2 se importa una sola vez como compartida.</p>}
                {!columnasListas && <Aviso>Asigna al menos una columna a un alcance.</Aviso>}
              </div>
            )}
            {archivo.omitidas.length > 0 && (
              <Aviso>
                <p className="font-semibold">No se importaron en esta entrega:</p>
                <ul className="list-disc pl-4">{archivo.omitidas.map((o, i) => <li key={i}>{o}</li>)}</ul>
              </Aviso>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-3 px-4 py-3 border-t border-border">
        <Boton type="button" variante="secundario" className="flex-1" onClick={onClose}>Cancelar</Boton>
        <Boton type="button" className="flex-1" cargando={subiendo} disabled={!archivo || !columnasListas || filas.length === 0} onClick={crear}>Ver vista previa</Boton>
      </div>
    </>
  )
}
