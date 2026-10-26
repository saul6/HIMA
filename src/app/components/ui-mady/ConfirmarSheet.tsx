import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { BottomSheet } from '../BottomSheet'
import { Boton } from './Boton'

// Confirmación propia que reemplaza a window.confirm. Uso:
//   const { confirmar, confirmarElemento } = useConfirmar()
//   if (!(await confirmar({ titulo, descripcion, textoConfirmar }))) return
//   ...y renderizar {confirmarElemento} una vez en la pantalla.
// Escape, tocar fuera y el botón cerrar equivalen a Cancelar. El foco inicial
// va en Cancelar (la opción segura).

export interface OpcionesConfirmar {
  titulo: string
  descripcion?: string
  textoConfirmar: string
  textoCancelar?: string
  tono?: 'normal' | 'peligro'
}

interface ConfirmarSheetProps extends OpcionesConfirmar {
  abierto: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

// En claro, texto blanco sobre --destructive (≥ 4.5:1). En oscuro, --destructive
// es más claro y el blanco no alcanza: se usa el fondo oscuro como texto.
const CLASE_PELIGRO =
  'bg-destructive text-destructive-foreground dark:text-background hover:bg-destructive/90'

export function ConfirmarSheet({
  abierto,
  titulo,
  descripcion,
  textoConfirmar,
  textoCancelar = 'Cancelar',
  tono = 'normal',
  onConfirmar,
  onCancelar,
}: ConfirmarSheetProps) {
  const cancelarRef = useRef<HTMLButtonElement>(null)

  // BottomSheet enfoca por su cuenta el primer control al abrirse; el foco
  // en Cancelar se asienta después, en el siguiente cuadro.
  useEffect(() => {
    if (!abierto) return
    const id = requestAnimationFrame(() => cancelarRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(id)
  }, [abierto])

  return (
    <BottomSheet open={abierto} onClose={onCancelar} title={titulo}>
      <div className="px-4 py-4 flex flex-col gap-4">
        {descripcion && <p className="text-body text-muted-foreground">{descripcion}</p>}
        <div className="flex gap-3">
          <Boton ref={cancelarRef} type="button" variante="secundario" className="flex-1" onClick={onCancelar}>
            {textoCancelar}
          </Boton>
          <Boton
            type="button"
            className={tono === 'peligro' ? `flex-1 ${CLASE_PELIGRO}` : 'flex-1'}
            onClick={onConfirmar}
          >
            {textoConfirmar}
          </Boton>
        </div>
      </div>
    </BottomSheet>
  )
}

/** Devuelve `confirmar(opciones): Promise<boolean>` y el elemento a renderizar.
 * Si el componente se desmonta con el diálogo abierto, o se pide otro encima,
 * la promesa pendiente se resuelve en `false`. */
export function useConfirmar(): {
  confirmar: (opciones: OpcionesConfirmar) => Promise<boolean>
  confirmarElemento: ReactElement
} {
  const [estado, setEstado] = useState<OpcionesConfirmar | null>(null)
  const pendienteRef = useRef<((valor: boolean) => void) | null>(null)
  // Última opciones mostradas: el texto sigue visible mientras se cierra el diálogo.
  const ultimasRef = useRef<OpcionesConfirmar>({ titulo: '', textoConfirmar: '' })
  if (estado) ultimasRef.current = estado

  const cerrar = useCallback((valor: boolean) => {
    const resolver = pendienteRef.current
    pendienteRef.current = null
    setEstado(null)
    resolver?.(valor)
  }, [])

  const confirmar = useCallback((opciones: OpcionesConfirmar) => {
    pendienteRef.current?.(false)
    return new Promise<boolean>((resolver) => {
      pendienteRef.current = resolver
      setEstado(opciones)
    })
  }, [])

  useEffect(() => () => {
    pendienteRef.current?.(false)
    pendienteRef.current = null
  }, [])

  const confirmarElemento = (
    <ConfirmarSheet
      {...ultimasRef.current}
      abierto={estado !== null}
      onConfirmar={() => cerrar(true)}
      onCancelar={() => cerrar(false)}
    />
  )

  return { confirmar, confirmarElemento }
}
