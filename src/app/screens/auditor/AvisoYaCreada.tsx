import type { ReactNode } from 'react'
import { Boton } from '@/app/components/ui-mady/Boton'
import { AVISO_YA_CREADA } from './crearAuditoria'

interface Props {
  onAbrir: () => void
  /** Crea una segunda auditoría con una solicitud nueva; solo si la persona lo pide. */
  onCrearOtra: () => void
  creando: boolean
  abriendo?: boolean
  /** Botones propios de la pantalla, antes de los del aviso. */
  children?: ReactNode
}

// Aviso fijo en el pie del formulario cuando la solicitud ya había creado una auditoría.
export function AvisoYaCreada({ onAbrir, onCrearOtra, creando, abriendo = false, children }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <p
        role="alert"
        className="text-sm rounded-xl px-3 py-2"
        style={{ backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}
      >
        {AVISO_YA_CREADA}
      </p>
      <div className="flex gap-2">
        {children}
        <Boton variante="secundario" onClick={onCrearOtra} cargando={creando} disabled={abriendo} className="flex-1">
          Crear otra
        </Boton>
        <Boton onClick={onAbrir} cargando={abriendo} disabled={creando} className="flex-1">
          Abrir
        </Boton>
      </div>
    </div>
  )
}
