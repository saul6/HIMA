import { useState } from 'react'
import { toast } from 'sonner'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Boton } from '@/app/components/ui-mady/Boton'
import { chk, useAccion, type ChkAlcance } from '@/hooks/useChecklistV2'
import { Aviso, CLASE_INPUT, Chip } from './comun'

interface Props {
  open: boolean
  instalacionId: string
  alcances: ChkAlcance[]
  onClose: () => void
  onCambio: () => void
}

/** Alta y edición de los alcances de una instalación (solo administración). */
export function AlcancesSheet({ open, instalacionId, alcances, onClose, onCambio }: Props) {
  const [nombre, setNombre] = useState('')
  const [editando, setEditando] = useState<ChkAlcance | null>(null)
  const { ocupado, ejecutar, reiniciar } = useAccion()

  function limpiar() { setNombre(''); setEditando(null); reiniciar() }

  async function guardar(datos: { id: string | null; nombre: string; activo: boolean }) {
    const r = await ejecutar(() => chk.alcanceGuardar({ id: datos.id, instalacion: instalacionId, nombre: datos.nombre, activo: datos.activo }))
    if (!r.ok) { toast.error(r.mensaje); return }
    toast.success('Alcance guardado')
    limpiar()
    onCambio()
  }

  return (
    <BottomSheet open={open} onClose={onClose} height="85%" title="Alcances de la instalación">
      {open && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <Aviso>Un alcance es un subconjunto de la instalación con su propio catálogo y sus propias visitas. Los documentos sin alcance son compartidos.</Aviso>

          <div className="space-y-2">
            {alcances.length === 0 && <p className="text-sm text-muted-foreground">Esta instalación no tiene alcances.</p>}
            {alcances.map(a => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                <p className="text-sm font-semibold flex-1 min-w-0 truncate">{a.nombre}</p>
                {!a.activo && <Chip>Inactivo</Chip>}
                <button type="button" className="text-xs font-semibold" style={{ color: 'var(--primary)' }}
                  onClick={() => { setEditando(a); setNombre(a.nombre) }}>Renombrar</button>
                <button type="button" className="text-xs font-semibold" style={{ color: 'var(--primary)' }} disabled={ocupado}
                  onClick={() => guardar({ id: a.id, nombre: a.nombre, activo: !a.activo })}>{a.activo ? 'Desactivar' : 'Activar'}</button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">{editando ? `Nuevo nombre para "${editando.nombre}"` : 'Nuevo alcance'}</span>
              <input className={CLASE_INPUT} value={nombre} maxLength={80} onChange={e => setNombre(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <Boton cargando={ocupado} disabled={nombre.trim().length < 2}
                onClick={() => guardar({ id: editando?.id ?? null, nombre: nombre.trim(), activo: editando?.activo ?? true })}>
                {editando ? 'Guardar nombre' : 'Agregar alcance'}
              </Boton>
              {editando && <Boton variante="secundario" onClick={limpiar}>Cancelar</Boton>}
            </div>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
