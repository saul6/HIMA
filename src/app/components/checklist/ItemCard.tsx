import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronDown, ClipboardCheck } from 'lucide-react'
import { FRECUENCIAS, FRECUENCIA_PUNTO_LABEL, type ChkItem, type ChkNota } from '@/hooks/useChecklist'
import { codigoFormato } from '@/lib/codigoFormato'
import { ESTADO_REVISION_LABEL, TONO_ESTADO, TONO_NOTA, haceDias } from './constantes'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'

export function codigoItem(item: ChkItem, codigoClave: string): string | null {
  return item.codigo_formato ? codigoFormato(item.codigo_formato, codigoClave) : null
}

function detalleFaltan(d: NonNullable<ChkNota['detalle']>[number]): string {
  const frec = FRECUENCIA_PUNTO_LABEL[d.frecuencia] ?? d.frecuencia
  return `${d.item} · ${frec} · ${d.faltan} ${d.faltan === 1 ? 'día' : 'días'}`
}

/** "Cada día · POE-SAN-06 Rev. 02" / "Cada día · sugerida" / "Cada día" */
export function textoFrecuencia(item: ChkItem): string | null {
  if (!item.frecuencia || item.tipo === 'documento') return null
  const base = FRECUENCIAS.find(f => f.value === item.frecuencia)?.label
  if (!base) return null
  if (item.frecuencia_origen === 'sugerida') return `${base} · sugerida`
  if (item.frecuencia_fuente && item.frecuencia_origen && item.frecuencia_origen !== 'admin') return `${base} · ${item.frecuencia_fuente}`
  return base
}

const NOTAS_VISIBLES = 3

/** `limite`: máximo de notas visibles (el resto, tras "Ver N más"). Sin límite se muestran todas. */
export function NotasItem({ item, limite }: { item: ChkItem; limite?: number }) {
  const navigate = useNavigate()
  const [abiertas, setAbiertas] = useState<Record<number, boolean>>({})
  const [verTodas, setVerTodas] = useState(false)
  if (!item.notas?.length) return null
  const total = item.notas.length
  const recortar = limite !== undefined && total > limite && !verTodas
  const visibles = recortar ? item.notas.slice(0, limite) : item.notas
  return (
    <ul className="space-y-1.5">
      {visibles.map((n, i) => {
        const t = TONO_NOTA[n.tipo] ?? TONO_NOTA.faltan_registros
        const Icono = t.icono
        const expandible = n.tipo === 'faltan_items' && !!n.detalle?.length
        const abierta = !!abiertas[i]
        const cuerpo = (
          <>
            <Icono className="w-3.5 h-3.5 mt-px flex-shrink-0" />
            <span className="min-w-0 flex-1 text-left">{n.texto}</span>
            {expandible && <ChevronDown className={`w-3.5 h-3.5 mt-px flex-shrink-0 transition-transform ${abierta ? 'rotate-180' : ''}`} />}
          </>
        )
        return (
          <li
            key={`${n.tipo}-${i}`}
            className="rounded-lg px-2.5 py-1.5 text-xs"
            style={{ backgroundColor: t.fill, color: t.text }}
          >
            {expandible ? (
              <button
                type="button"
                aria-expanded={abierta}
                onClick={e => { e.stopPropagation(); setAbiertas(a => ({ ...a, [i]: !a[i] })) }}
                className="w-full flex items-start gap-2"
              >
                {cuerpo}
              </button>
            ) : (
              <div className="flex items-start gap-2">{cuerpo}</div>
            )}
            {expandible && abierta && (
              <ul className="mt-1.5 ml-5 space-y-0.5">
                {n.detalle!.map((d, j) => <li key={j}>{detalleFaltan(d)}</li>)}
              </ul>
            )}
            {n.tipo === 'config_pendiente' && item.modulo_ruta && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); navigate(item.modulo_ruta!) }}
                className="mt-1 ml-5 underline font-semibold"
              >
                Abrir formato
              </button>
            )}
          </li>
        )
      })}
      {limite !== undefined && total > limite && (
        <li>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setVerTodas(v => !v) }}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground font-semibold"
          >
            {verTodas ? 'Ver menos' : `Ver ${total - limite} más`}
          </button>
        </li>
      )}
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
      className="bg-card rounded-xl border border-border p-4 space-y-2.5 h-full cursor-pointer transition-colors hover:bg-muted/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {codigo && <p className="text-caption text-muted-foreground">{codigo}</p>}
          <p className="text-sm text-foreground leading-snug font-semibold">{item.nombre}</p>
          {responsable && <p className="text-xs text-muted-foreground mt-0.5">{responsable}</p>}
          {textoFrecuencia(item) && <p className="text-xs text-muted-foreground mt-0.5">{textoFrecuencia(item)}</p>}
        </div>
        <div className="flex-shrink-0 text-right space-y-1">
          {rev && tono ? (
            <span
              className="inline-block rounded-full px-2 py-0.5 text-caption font-semibold"
              style={{ backgroundColor: tono.fill, color: tono.text }}
            >
              {ESTADO_REVISION_LABEL[rev.estado]}
            </span>
          ) : (
            <Etiqueta tono="neutral">
              Sin revisar
            </Etiqueta>
          )}
          {rev && <p className="text-caption text-muted-foreground">{haceDias(item.dias_sin_revisar)}</p>}
        </div>
      </div>

      <NotasItem item={item} limite={NOTAS_VISIBLES} />

      {puedeEditar && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRevisar() }}
            className="h-8 px-3 rounded-lg text-xs border border-border inline-flex items-center gap-1.5 transition-colors hover:bg-muted font-semibold"
            style={{ color: 'var(--primary)' }}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Revisar
          </button>
        </div>
      )}
    </div>
  )
}
