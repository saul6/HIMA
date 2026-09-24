import { type ReactNode, useEffect, useState } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  /** Fixed viewport height (e.g. '85%'). Omit for auto height (max 85 vh). */
  height?: string
  children: ReactNode
  /**
   * Variante opt-in — NO cambia el comportamiento por defecto (omitir esta
   * prop, como hacen el resto de los ~69 usos, deja el sheet exactamente
   * igual: sin animación, aparece/desaparece de inmediato).
   * 'bottom-left': crece/encoge (~280ms, escala + fade) desde la esquina
   * inferior-izquierda — pensado para el menú del isotipo en Layout.tsx,
   * que abre desde un FAB ahí. Respeta prefers-reduced-motion.
   */
  origin?: 'default' | 'bottom-left'
}

const ANIM_MS = 280

const PANEL_BASE = [
  'fixed left-1/2 -translate-x-1/2 w-full bg-card flex flex-col z-50',
  'max-w-[390px] rounded-t-[0.625rem]',
  'md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:max-w-[560px] md:rounded-xl',
]

/**
 * Móvil: panel anclado al fondo centrado en 390 px.
 * Escritorio (lg:): modal centrado en 560 px.
 */
export function BottomSheet({ open, onClose, height, children, origin = 'default' }: BottomSheetProps) {
  // Comportamiento por defecto — idéntico al de siempre, sin estado ni
  // efectos extra (ningún otro uso de BottomSheet pasa `origin`).
  if (origin === 'default') {
    if (!open) return null
    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
        <div
          className={[...PANEL_BASE, 'bottom-0'].join(' ')}
          style={height ? { height } : { maxHeight: '85vh' }}
        >
          {children}
        </div>
      </>
    )
  }

  return (
    <BottomSheetBottomLeft open={open} onClose={onClose} height={height}>
      {children}
    </BottomSheetBottomLeft>
  )
}

function BottomSheetBottomLeft({ open, onClose, height, children }: Omit<BottomSheetProps, 'origin'>) {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setMounted(true)
      if (reducedMotion) { setVisible(true); return }
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(raf)
    }
    setVisible(false)
    if (reducedMotion) { setMounted(false); return }
    const t = setTimeout(() => setMounted(false), ANIM_MS)
    return () => clearTimeout(t)
  }, [open, reducedMotion])

  if (!mounted) return null

  const panelStyle: React.CSSProperties = {
    ...(height ? { height } : { maxHeight: '85vh' }),
    ...(reducedMotion ? {} : {
      transformOrigin: 'bottom left',
      transition: `transform ${ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${ANIM_MS}ms ease`,
      transform: visible ? 'scale(1)' : 'scale(0.3)',
      opacity: visible ? 1 : 0,
    }),
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        style={reducedMotion ? undefined : {
          transition: `opacity ${ANIM_MS}ms ease`,
          opacity: visible ? 1 : 0,
        }}
      />
      {/* bottom-3 (en vez de bottom-0): sube el sheet un poco del borde,
          sutil, solo en esta variante — no toca el resto de los usos. */}
      <div className={[...PANEL_BASE, 'bottom-3'].join(' ')} style={panelStyle}>
        {children}
      </div>
    </>
  )
}
