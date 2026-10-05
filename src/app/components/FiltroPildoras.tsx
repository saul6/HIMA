import { useId, type ReactNode } from "react"
import { motion, LayoutGroup, useReducedMotion } from "motion/react"
import { SPRING_SUAVE } from "@/lib/motion"
import { cn } from "@/app/components/ui/utils"

export interface FiltroPildorasOption<T extends string = string> {
  value: T
  label: ReactNode
}

interface FiltroPildorasProps<T extends string = string> {
  options: (FiltroPildorasOption<T> | T)[]
  value: T
  onChange: (value: T) => void
  /** Id del grupo — por defecto useId(). Pásalo explícito solo si necesitas
   *  coordinar el resaltado entre dos instancias (poco común). */
  groupId?: string
  className?: string
  /** Clases del estado NO seleccionado — cada pantalla conserva su look previo;
   *  solo el estado activo y el deslizamiento se unifican con el sidebar. */
  inactiveClassName?: string
}

const INACTIVE_DEFAULT = "bg-card border-border text-foreground hover:bg-muted"

function normalizar<T extends string>(opt: FiltroPildorasOption<T> | T): FiltroPildorasOption<T> {
  return typeof opt === "string" ? { value: opt, label: opt } : opt
}

// Píldoras de filtro de selección única con el mismo resaltado que el ítem
// activo del sidebar (Layout.tsx: bg var(--accent) + texto var(--accent-foreground)).
// Cada instancia va en su propio LayoutGroup (id único vía useId por defecto)
// para que el resaltado nunca salte entre grupos montados a la vez.
export function FiltroPildoras<T extends string = string>({
  options, value, onChange, groupId, className, inactiveClassName = INACTIVE_DEFAULT,
}: FiltroPildorasProps<T>) {
  const autoId = useId()
  const reducedMotion = useReducedMotion()

  return (
    <LayoutGroup id={groupId ?? autoId}>
      {options.map((raw) => {
        const opt = normalizar(raw)
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex-shrink-0 px-4 h-9 rounded-full whitespace-nowrap text-sm border transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active ? "border-transparent" : inactiveClassName,
              className,
            )}
            style={{
              color: active ? 'var(--accent-foreground)' : undefined,
              fontWeight: active ? 600 : 400,
              transitionDuration: 'var(--motion-fast)',
            }}
          >
            {active && (
              <motion.span
                layoutId="filtro-pildora-activa"
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: 'var(--accent)', zIndex: -1 }}
                transition={reducedMotion ? { duration: 0 } : SPRING_SUAVE}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        )
      })}
    </LayoutGroup>
  )
}
