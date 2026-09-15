import { type ReactNode } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  /** Fixed viewport height (e.g. '85%'). Omit for auto height (max 85 vh). */
  height?: string
  children: ReactNode
}

/**
 * Móvil: panel anclado al fondo centrado en 390 px.
 * Escritorio (lg:): modal centrado en 560 px.
 */
export function BottomSheet({ open, onClose, height, children }: BottomSheetProps) {
  if (!open) return null
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      {/* Panel — bottom sheet on mobile, centered dialog on desktop */}
      <div
        className={[
          'fixed left-1/2 -translate-x-1/2 w-full bg-card flex flex-col z-50',
          'bottom-0 max-w-[390px] rounded-t-[0.625rem]',
          'md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:max-w-[560px] md:rounded-xl',
        ].join(' ')}
        style={height ? { height } : { maxHeight: '85vh' }}
      >
        {children}
      </div>
    </>
  )
}
