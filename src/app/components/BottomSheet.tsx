import { type ReactNode } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  /** Fixed viewport height (e.g. '85%'). Omit for auto height (max 85 vh). */
  height?: string
  children: ReactNode
}

/**
 * Posiciona un panel en la parte inferior de la pantalla, centrado y limitado
 * al mismo ancho máximo que el contenedor principal (390 px).
 * El overlay cubre toda la ventana; el panel queda centrado horizontalmente.
 */
export function BottomSheet({ open, onClose, height, children }: BottomSheetProps) {
  if (!open) return null
  return (
    <>
      {/* Overlay full-screen */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      {/* Panel centrado al ancho mobile */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-card flex flex-col z-50"
        style={{
          borderRadius: '0.625rem 0.625rem 0 0',
          ...(height ? { height } : { maxHeight: '85vh' }),
        }}
      >
        {children}
      </div>
    </>
  )
}
