import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileUp } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Aviso, Chip, TONOS } from './comun'
import { chk, mensajeError } from '@/hooks/useChecklistV2'
import type { ArchivoLeido } from '@/lib/checklist/importar'

interface Props {
  open: boolean
  instalacionId: string
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

function Cuerpo({ instalacionId, onClose, onCreada }: Omit<Props, 'open'>) {
  const input = useRef<HTMLInputElement>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [archivo, setArchivo] = useState<ArchivoLeido | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function elegir(file: File | undefined) {
    if (!file) return
    setError(null); setArchivo(null); setLeyendo(true)
    try {
      // Carga perezosa: pdfjs-dist y mammoth solo se bajan al abrir el importador
      const { leerArchivo } = await import('@/lib/checklist/importar')
      const r = await leerArchivo(file)
      if (r.filas.length === 0) setError('No se encontraron renglones de documentos en el archivo. Revisa que tenga la tabla con encabezados (Nombre, Código…).')
      else setArchivo(r)
    } catch (e) {
      console.error('[checklist] leer archivo', e)
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo')
    } finally {
      setLeyendo(false)
      if (input.current) input.current.value = ''
    }
  }

  async function crear() {
    if (!archivo) return
    setSubiendo(true)
    try {
      const r = await chk.importacionCrear({
        instalacion: instalacionId, nombre: archivo.nombre, hash: archivo.hash, formato: archivo.formato, filas: archivo.filas,
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

  const conAlertas = archivo?.filas.filter(f => f.alertas.length > 0).length ?? 0

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
              <Chip>{archivo.filas.length} renglones</Chip>
              {conAlertas > 0 && <Chip tono={TONOS.info}>{conAlertas} con alertas</Chip>}
            </div>
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
        <Boton type="button" className="flex-1" cargando={subiendo} disabled={!archivo} onClick={crear}>Ver vista previa</Boton>
      </div>
    </>
  )
}
