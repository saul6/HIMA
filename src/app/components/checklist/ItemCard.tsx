import { ClipboardCheck } from 'lucide-react'
import type { ChkItem } from '@/hooks/useChecklist'
import { codigoFormato } from '@/lib/codigoFormato'
import { ESTADO_REVISION_LABEL, TONO_ESTADO, TONO_NOTA, haceDias } from './constantes'

export function codigoItem(item: ChkItem, codigoClave: string): string | null {
  return item.codigo_formato ? codigoFormato(item.codigo_formato, codigoClave) : null
}

export function NotasItem({ item }: { item: ChkItem }) {
  if (!item.notas?.length) return null
  return (
    <ul className="space-y-1.5">
      {item.notas.map((n, i) => {
        const t = TONO_NOTA[n.tipo] ?? TONO_NOTA.faltan_registros
        const Icono = t.icono
        return (
          <li
            key={`${n.tipo}-${i}`}
            className="flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs"
            style={{ backgroundColor: t.fill, color: t.text }}
          >
            <Icono className="w-3.5 h-3.5 mt-px flex-shrink-0" />
            <span className="min-w-0">{n.texto}</span>
          </li>
        )
      })}
    </ul>
  )
}

interface Props {
  item: ChkItem
  codigoClave: string
  puedeEditar: boolean
  onAbrir: () => void
  onRevisar: () => void
}

export function ItemCard({ item, codigoClave, puedeEditar, onAbrir, onRevisar }: Props) {
  const codigo = codigoItem(item, codigoClave)
  const rev = item.ultima_revision
  const tono = rev ? TONO_ESTADO[rev.estado] : null
  const responsable = item.responsable_nombre ?? item.responsable_texto

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir() } }}
      className="bg-card rounded-xl border border-border p-4 space-y-2.5 cursor-pointer transition-colors hover:bg-muted/40 active:scale-[0.995]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {codigo && <p className="text-[11px] text-muted-foreground">{codigo}</p>}
          <p className="text-sm text-foreground leading-snug" style={{ fontWeight: 600 }}>{item.nombre}</p>
          {responsable && <p className="text-xs text-muted-foreground mt-0.5">{responsable}</p>}
        </div>
        <div className="flex-shrink-0 text-right space-y-1">
          {rev && tono ? (
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[11px]"
              style={{ backgroundColor: tono.fill, color: tono.text, fontWeight: 600 }}
            >
              {ESTADO_REVISION_LABEL[rev.estado]}
            </span>
          ) : (
            <span className="inline-block rounded-full px-2 py-0.5 text-[11px] bg-muted text-muted-foreground" style={{ fontWeight: 600 }}>
              Sin revisar
            </span>
          )}
          {rev && <p className="text-[11px] text-muted-foreground">{haceDias(item.dias_sin_revisar)}</p>}
        </div>
      </div>

      <NotasItem item={item} />

      {puedeEditar && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRevisar() }}
            className="h-8 px-3 rounded-lg text-xs border border-border inline-flex items-center gap-1.5 transition-colors hover:bg-muted active:scale-[0.97]"
            style={{ fontWeight: 600, color: 'var(--primary)' }}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Revisar
          </button>
        </div>
      )}
    </div>
  )
}
