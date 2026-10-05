import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// `position: fixed` solo se ancla al viewport si ningún ancestro tiene
// `transform` (ni siquiera uno "en reposo" como translateY(0px), que motion
// deja inline tras animar). Layout anima el contenedor del <Outlet/> con
// motion, así que cualquier ventana `fixed` montada dentro de una pantalla
// necesita salir del árbol vía portal para no quedar recortada/desplazada.
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}
