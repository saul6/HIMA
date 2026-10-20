import { type ReactNode, type RefObject, useEffect, useId, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { Portal } from '@/app/components/Portal'
import { sumarVentana, restarVentana } from '@/lib/offline/actualizacionSegura'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  /** Fixed viewport height (e.g. '85%'). Omit for auto height (max 85 vh). */
  height?: string
  /** When provided, renders a handle bar + title row with close button. */
  title?: string
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

// ── Accesibilidad de la ventana ─────────────────────────────────────────────
// Pila de ventanas abiertas: Escape y el atrapado de foco solo responden a la
// de arriba. El bloqueo del scroll del fondo es un contador para que, con
// ventanas encimadas, solo se restaure al cerrar la última.
const pilaVentanas: symbol[] = []
let bloqueosScroll = 0
let overflowPrevio = ''

function bloquearScroll() {
  if (bloqueosScroll++ === 0) {
    overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
}

function liberarScroll() {
  if (--bloqueosScroll === 0) document.body.style.overflow = overflowPrevio
}

const FOCUSABLES =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

function controlesEnfocables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLES)).filter(
    (el) => el.getClientRects().length > 0,
  )
}

// Un campo de texto como primer control abriría el teclado del celular al
// abrir la ventana: en ese caso el foco va al panel y no al campo.
function abreTeclado(el: HTMLElement) {
  if (el instanceof HTMLTextAreaElement) return true
  if (!(el instanceof HTMLInputElement)) return false
  return !['button', 'checkbox', 'radio', 'file', 'submit', 'reset', 'range', 'color'].includes(el.type)
}

function useVentanaAccesible(open: boolean, panelRef: RefObject<HTMLDivElement | null>, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (!open) return
    const id = Symbol('ventana')
    pilaVentanas.push(id)
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    bloquearScroll()

    const panel = panelRef.current
    if (panel && !panel.contains(document.activeElement)) {
      const primero = controlesEnfocables(panel)[0]
      if (primero && !abreTeclado(primero)) primero.focus({ preventScroll: true })
      else panel.focus({ preventScroll: true })
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (pilaVentanas[pilaVentanas.length - 1] !== id) return
      if (e.key === 'Escape') {
        // Radix (Select, Popover…) y los selectores nativos atienden su propio Escape.
        if (e.defaultPrevented || e.isComposing) return
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const lista = controlesEnfocables(panelRef.current)
      if (lista.length === 0) { e.preventDefault(); panelRef.current.focus(); return }
      const primero = lista[0]
      const ultimo = lista[lista.length - 1]
      const activo = document.activeElement
      if (e.shiftKey && (activo === primero || activo === panelRef.current)) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && activo === ultimo) { e.preventDefault(); primero.focus() }
      else if (!panelRef.current.contains(activo)) { e.preventDefault(); primero.focus() }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const i = pilaVentanas.indexOf(id)
      if (i >= 0) pilaVentanas.splice(i, 1)
      liberarScroll()
      if (previo && previo.isConnected) previo.focus({ preventScroll: true })
    }
  }, [open, panelRef])
}

function SheetHeader({ title, titleId, onClose }: { title: string; titleId: string; onClose: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
        <h2 id={titleId} className="text-base font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="p-3 -m-2 rounded-lg"><X className="w-5 h-5" /></button>
      </div>
    </>
  )
}

function StaticSheet({ open, onClose, height, title, children, raised }: {
  open: boolean
  onClose: () => void
  height?: string
  title?: string
  children: ReactNode
  raised?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useVentanaAccesible(open, panelRef, onClose)
  if (!open) return null
  return (
    <Portal>
      <div className="fixed inset-0 bg-black/40 z-40 sheet-fondo-entrada" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Ventana'}
        tabIndex={-1}
        className={`${PANEL_CLASS} ${raised ? 'bottom-3' : 'bottom-0'} sheet-entrada sheet-safe-bottom outline-none${height ? '' : ' sheet-max-h'}`}
        style={height ? { height } : undefined}
      >
        {title && <SheetHeader title={title} titleId={titleId} onClose={onClose} />}
        {children}
      </div>
    </Portal>
  )
}

/**
 * Móvil: panel anclado al fondo centrado en 390 px.
 * Escritorio (lg:): modal centrado en 560 px.
 */
export function BottomSheet({ open, onClose, height, title, children, animateFrom }: BottomSheetProps) {
  const reducedMotion = useReducedMotion()
  const panelAnimRef = useRef<HTMLDivElement>(null)
  // La variante estática y la reducida montan su propio hook (StaticSheet);
  // este solo atiende la variante animada.
  useVentanaAccesible(open && !!animateFrom && !reducedMotion, panelAnimRef, onClose)

  // Cuenta cuántas ventanas están abiertas para saber si es seguro actualizar el SW
  useEffect(() => {
    if (!open) return
    sumarVentana()
    return () => restarVentana()
  }, [open])

  if (!animateFrom) {
    // Comportamiento por defecto — idéntico al de siempre, sin motion.
    return <StaticSheet open={open} onClose={onClose} height={height} title={title}>{children}</StaticSheet>
  }

  if (reducedMotion) {
    // Misma variante visual (bottom-3), pero sin animación.
    return <StaticSheet open={open} onClose={onClose} height={height} title={title} raised>{children}</StaticSheet>
  }

  return (
    <Portal>
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            aria-hidden="true"
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ opacity: 0, transition: CLOSE_TRANSITION }}
          />
          <motion.div
            key="panel"
            ref={panelAnimRef}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? 'Menú'}
            tabIndex={-1}
            className={`${PANEL_CLASS} bottom-3 sheet-safe-bottom outline-none${height ? '' : ' sheet-max-h'}`}
            style={{
              ...(height ? { height } : {}),
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
    </Portal>
  )
}
