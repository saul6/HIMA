import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/app/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover'
import { cn } from '@/app/components/ui/utils'
import type { CatalogoProducto } from '@/types/database.types'

// Orden canónico de categorías
const CATEGORIAS = [
  'Insecticidas',
  'Fungicidas',
  'Herbicidas',
  'Reguladores',
  'Biorracionales',
  'Nematicidas',
  'Adherentes',
] as const

interface Props {
  productos: CatalogoProducto[]
  value: string                  // productId actualmente seleccionado
  onSelect: (id: string) => void
  disabled?: boolean
  productosEnInventario?: string[]
}

export function ProductoCombobox({ productos, value, onSelect, disabled, productosEnInventario }: Props) {
  const [open, setOpen] = useState(false)
  const selected = productos.find(p => p.id === value)

  const handleSelect = (id: string) => {
    onSelect(id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full h-11 px-3 rounded-lg border border-border bg-input-background',
            'flex items-center justify-between gap-2 text-sm text-left',
            'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            !selected && 'text-muted-foreground',
          )}
        >
          <span className="flex-1 truncate">
            {selected ? selected.nombre_comercial : 'Buscar producto…'}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      {/*
        w-[var(--radix-popover-trigger-width)] hace que el popover tenga
        exactamente el ancho del trigger — nunca desborda los 390 px.
        min-w-[220px] como guardia mínima por si el trigger es muy estrecho.
      */}
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-0"
      >
        <Command
          filter={(itemValue, search) => {
            // itemValue tiene forma "nombre|ingrediente" → filtra en ambos campos
            const q = search.toLowerCase()
            return itemValue.toLowerCase().includes(q) ? 1 : 0
          }}
        >
          <CommandInput placeholder="Buscar por nombre o ingrediente…" />

          <CommandList className="max-h-[60vh] overflow-y-auto overflow-x-hidden">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              Sin resultados para esta búsqueda.
            </CommandEmpty>

            {/* ── En tu inventario (Sprint 3) ─────────────────────────────── */}
            {productosEnInventario && productosEnInventario.length > 0 && (() => {
              const enStock = productos.filter(p => productosEnInventario.includes(p.id))
              if (enStock.length === 0) return null
              return (
                <CommandGroup heading="En tu inventario">
                  {enStock.map(p => (
                    <ProductoItem
                      key={p.id}
                      producto={p}
                      isSelected={value === p.id}
                      onSelect={() => handleSelect(p.id)}
                    />
                  ))}
                </CommandGroup>
              )
            })()}

            {/* ── Grupos por categoría ─────────────────────────────────────── */}
            {CATEGORIAS.map(cat => {
              const items = productos.filter(p => p.categoria === cat)
              if (items.length === 0) return null
              return (
                <CommandGroup key={cat} heading={cat}>
                  {items.map(p => (
                    <ProductoItem
                      key={p.id}
                      producto={p}
                      isSelected={value === p.id}
                      onSelect={() => handleSelect(p.id)}
                    />
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ── Ítem individual ───────────────────────────────────────────────────────────

function ProductoItem({
  producto: p,
  isSelected,
  onSelect,
}: {
  producto: CatalogoProducto
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <CommandItem
      // El valor incluye ingrediente_activo para que el filtro de cmdk lo capture
      value={`${p.nombre_comercial}|${p.ingrediente_activo}`}
      onSelect={onSelect}
      className={cn(
        'flex items-start gap-2 py-2 cursor-pointer',
        // Item activo / seleccionado con color primario del design system
        'data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary',
        isSelected && 'bg-primary/10',
      )}
    >
      <Check
        className={cn(
          'mt-0.5 size-4 shrink-0 text-primary',
          isSelected ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm leading-tight truncate">{p.nombre_comercial}</span>
        <span className="text-xs text-muted-foreground leading-tight truncate">
          {p.ingrediente_activo}
        </span>
      </div>
    </CommandItem>
  )
}
