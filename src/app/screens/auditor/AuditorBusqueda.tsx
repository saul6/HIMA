import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import {
  Search, Building2, MapPin, ClipboardCheck,
  AlertTriangle, CheckSquare, FileText, Loader2,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/app/components/ui/command'
import { supabase } from '@/lib/supabase'
import { ahora, ms, emitirEvento } from '@/lib/telemetria'

interface BusquedaResultado {
  tipo: 'ORGANIZACION' | 'RANCHO' | 'AUDITORIA' | 'HALLAZGO' | 'ACCION' | 'EVIDENCIA'
  id: string
  org_id: string
  titulo: string
  subtitulo: string | null
  route: string
  fecha: string | null
}

const TIPO_CONFIG: Record<
  BusquedaResultado['tipo'],
  { label: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }
> = {
  ORGANIZACION: { label: 'Organizaciones', Icon: Building2 },
  RANCHO:       { label: 'Sitios',          Icon: MapPin },
  AUDITORIA:    { label: 'Auditorías',      Icon: ClipboardCheck },
  HALLAZGO:     { label: 'No conformidades', Icon: AlertTriangle },
  ACCION:       { label: 'Acciones correctivas', Icon: CheckSquare },
  EVIDENCIA:    { label: 'Evidencias',      Icon: FileText },
}

const TIPO_ORDER: BusquedaResultado['tipo'][] = [
  'ORGANIZACION', 'RANCHO', 'AUDITORIA', 'HALLAZGO', 'ACCION', 'EVIDENCIA',
]

export function AuditorBusqueda() {
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<BusquedaResultado[]>([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResultados([])
      setCargando(false)
      return
    }

    setCargando(true)
    const timer = setTimeout(async () => {
      const t0 = ahora()
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc('aud_buscar', { p_q: q, p_limit: 30 })
        if (error) throw error
        setResultados((data as BusquedaResultado[]) ?? [])
        emitirEvento('lat_search', ms(t0))
      } catch (e) {
        console.error('[AuditorBusqueda]', e)
        setResultados([])
      } finally {
        setCargando(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  function handleSelect(route: string) {
    setAbierto(false)
    setQuery('')
    navigate(route)
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setQuery('')
      setResultados([])
      setCargando(false)
    }
    setAbierto(open)
  }

  const q = query.trim()
  const grupos = !cargando && q.length >= 2
    ? TIPO_ORDER
        .map(tipo => ({ tipo, items: resultados.filter(r => r.tipo === tipo) }))
        .filter(g => g.items.length > 0)
    : []

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Buscar"
      >
        <Search size={16} style={{ color: 'var(--muted-foreground)' }} />
      </button>

      <Dialog open={abierto} onOpenChange={handleOpenChange}>
        <DialogContent className="overflow-hidden p-0 gap-0 max-w-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>Búsqueda global</DialogTitle>
            <DialogDescription>
              Busca organizaciones, sitios, auditorías, no conformidades y acciones correctivas.
            </DialogDescription>
          </DialogHeader>

          <Command
            shouldFilter={false}
            className={[
              '[&_[cmdk-group-heading]]:text-muted-foreground',
              '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5',
              '[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium',
              '[&_[cmdk-group]]:px-2',
              '[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0',
              '**:data-[slot=command-input-wrapper]:pr-10',
            ].join(' ')}
          >
            <CommandInput
              placeholder="Buscar criterio, organización, sitio..."
              value={query}
              onValueChange={setQuery}
              autoFocus
            />

            <CommandList className="max-h-[60vh]">

              {/* Cargando */}
              {cargando && (
                <div className="flex items-center justify-center py-10">
                  <Loader2
                    size={18}
                    className="animate-spin"
                    style={{ color: 'var(--muted-foreground)' }}
                  />
                </div>
              )}

              {/* Sin query */}
              {!cargando && q.length === 0 && (
                <div className="py-10 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Busca por criterio, organización, sitio o auditoría
                </div>
              )}

              {/* Muy corto */}
              {!cargando && q.length === 1 && (
                <div className="py-10 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Escribe al menos 2 caracteres
                </div>
              )}

              {/* Sin resultados */}
              {!cargando && q.length >= 2 && grupos.length === 0 && (
                <CommandEmpty>Sin coincidencias para &ldquo;{q}&rdquo;</CommandEmpty>
              )}

              {/* Resultados agrupados */}
              {grupos.map(({ tipo, items }) => {
                const { label, Icon } = TIPO_CONFIG[tipo]
                return (
                  <CommandGroup key={tipo} heading={label}>
                    {items.map(item => (
                      <CommandItem
                        key={`${tipo}-${item.id}`}
                        value={`${tipo}-${item.id}`}
                        onSelect={() => handleSelect(item.route)}
                        className="flex items-start gap-3 py-2.5 cursor-pointer"
                      >
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: 'var(--muted)' }}
                        >
                          <Icon size={13} style={{ color: 'var(--muted-foreground)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium leading-tight truncate"
                            style={{ color: 'var(--foreground)' }}
                          >
                            {item.titulo}
                          </p>
                          {item.subtitulo && (
                            <p
                              className="text-xs mt-0.5 truncate"
                              style={{ color: 'var(--muted-foreground)' }}
                            >
                              {item.subtitulo}
                            </p>
                          )}
                          {item.fecha && (
                            <p
                              className="text-[10px] mt-0.5"
                              style={{ color: 'var(--muted-foreground)', opacity: 0.7 }}
                            >
                              {new Date(item.fecha).toLocaleDateString('es-MX', {
                                day: 'numeric', month: 'short', year: 'numeric',
                              })}
                            </p>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              })}

            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
