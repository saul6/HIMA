import { type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  /** Fixed viewport height (e.g. '85%'). Omit for auto height (max 85 vh). */
  height?: string
  children: ReactNode
  /**
   * Variante opt-in — NO cambia el comportamiento por defecto (omitir esta
   * prop, como hacen el resto de los ~68 usos, deja el sheet exactamente
   * igual: sin animación, montaje/desmontaje instantáneo).
   * 'bottom-left': el panel EMERGE desde la esquina inferior-izquierda al
   * abrir y se REABSORBE hacia ahí al cerrar — vía motion + AnimatePresence,
   * así el exit se anima antes de desmontar (con `if (!open) return null`
   * puro no hay forma de animar el cierre). Pensado para el menú del
   * isotipo en Layout.tsx, que abre desde un FAB ahí. Respeta
   * prefers-reduced-motion (sin animación si está activo).
   */
  animateFrom?: 'bottom-left'
}

// Centrado horizontal por inset-x-0 + mx-auto (no por transform: translateX)
// a propósito: la variante animada escribe su propio `transform` inline
// (scale/x/y del spring) vía motion, y un inline `transform` pisa por
// completo cualquier transform que viniera de una clase (-translate-x-1/2),
// rompiendo el centrado en cuanto arranca la animación. inset+margin no
// usa transform, así que no compite con motion. Sin cambio visual para la
// variante estática (mismo resultado, solo otra técnica de centrado).
const PANEL_CLASS = [
  'fixed inset-x-0 mx-auto w-full bg-card flex flex-col z-50',
  'max-w-[390px] rounded-t-[0.625rem]',
  'md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:max-w-[560px] md:rounded-xl',
].join(' ')

// Abre con un spring vivo pero elegante: crece, rebasa ~2% y asienta (medido
// con motion/react — no exagerado, un solo overshoot chico + una corrección
// mínima, nunca varios rebotes visibles). Cierra con un ease-in rápido: un
// cierre no necesita "rebotar", solo asentar limpio y veloz hacia el botón.
const SPRING_OPEN = { type: 'spring', stiffness: 380, damping: 18 } as const
const CLOSE_TRANSITION = { duration: 0.2, ease: [0.4, 0, 1, 1] as const }
// Stagger sutil de los ítems del menú (ver Layout.tsx) — solo al abrir,
// acompañando el spring; nunca en el cierre (se vería lento).
const STAGGER = { staggerChildren: 0.035, delayChildren: 0.05 }

export const fabMenuItemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const } },
}

function StaticSheet({ open, onClose, height, children, raised }: {
  open: boolean
  onClose: () => void
  height?: string
  children: ReactNode
  raised?: boolean
}) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div
        className={`${PANEL_CLASS} ${raised ? 'bottom-3' : 'bottom-0'}`}
        style={height ? { height } : { maxHeight: '85vh' }}
      >
        {children}
      </div>
    </>
  )
}

/**
 * Móvil: panel anclado al fondo centrado en 390 px.
 * Escritorio (lg:): modal centrado en 560 px.
 */
export function BottomSheet({ open, onClose, height, children, animateFrom }: BottomSheetProps) {
  const reducedMotion = useReducedMotion()

  if (!animateFrom) {
    // Comportamiento por defecto — idéntico al de siempre, sin motion.
    return <StaticSheet open={open} onClose={onClose} height={height}>{children}</StaticSheet>
  }

  if (reducedMotion) {
    // Misma variante visual (bottom-3), pero sin animación.
    return <StaticSheet open={open} onClose={onClose} height={height} raised>{children}</StaticSheet>
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ opacity: 0, transition: CLOSE_TRANSITION }}
          />
          <motion.div
            key="panel"
            className={`${PANEL_CLASS} bottom-3`}
            style={{
              ...(height ? { height } : { maxHeight: '85vh' }),
              transformOrigin: 'bottom left',
            }}
            variants={{
              hidden: { opacity: 0, scale: 0.9, x: -12, y: 12 },
              visible: {
                opacity: 1, scale: 1, x: 0, y: 0,
                transition: { ...SPRING_OPEN, staggerChildren: STAGGER.staggerChildren, delayChildren: STAGGER.delayChildren },
              },
            }}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, scale: 0.9, x: -12, y: 12, transition: CLOSE_TRANSITION }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
