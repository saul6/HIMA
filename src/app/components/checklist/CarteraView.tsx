import { useState } from 'react'
import { Building2, ChevronRight, MapPin, Pencil, Plus } from 'lucide-react'
import { Boton } from '@/app/components/ui-mady/Boton'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { TarjetaContador } from '@/app/components/ui-mady/TarjetaContador'
import { ListaTarjetas } from '@/app/components/ui-mady/ListaTarjetas'
import { TarjetaRegistro } from '@/app/components/ui-mady/TarjetaRegistro'
import { Fab } from '@/app/components/Fab'
import { iconoTipoInstalacion } from './iconoTipoInstalacion'
import { useSectoresChk, type CarteraCliente, type CarteraInstalacion } from '@/hooks/useChecklistV2'
import { Chip, ChipCatalogo, TONOS } from './comun'
import { ClienteSheet, InstalacionSheet } from './CarteraSheets'
import { fechaLarga } from './constantes'
import { useEsEscritorio } from './useEsEscritorio'

interface Props {
  cartera: CarteraCliente[]
  esAdmin: boolean
  onAbrir: (instalacionId: string) => void
  onRecargar: () => void
}

export function CarteraView({ cartera, esAdmin, onAbrir, onRecargar }: Props) {
  const esEscritorio = useEsEscritorio()
  const [clienteSheet, setClienteSheet] = useState<{ abierto: boolean; cliente: CarteraCliente | null }>({ abierto: false, cliente: null })
  const [instSheet, setInstSheet] = useState<{ abierto: boolean; cliente: CarteraCliente | null; inst: CarteraInstalacion | null }>({ abierto: false, cliente: null, inst: null })

  // Indicadores: solo con los datos que la cartera ya trae.
  const todas = cartera.flatMap(c => c.instalaciones)
  const enBorrador = todas.filter(i => i.catalogo_estado === 'borrador').length
  const incidenciasAbiertas = todas.reduce((n, i) => n + i.incidencias_abiertas, 0)

  return (
    <div className={`space-y-6 ${esAdmin ? 'pb-24' : ''}`}>
      {esEscritorio && cartera.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <TarjetaContador etiqueta="Clientes" valor={cartera.length} />
          <TarjetaContador etiqueta="Instalaciones" valor={todas.length} />
          <TarjetaContador etiqueta="Catálogos en borrador" valor={enBorrador} />
          <TarjetaContador etiqueta="Incidencias abiertas" valor={incidenciasAbiertas} tono={incidenciasAbiertas > 0 ? 'alertaTexto' : 'normal'} />
        </div>
      )}

      {cartera.length === 0 && (
        <EstadoVacio
          icono={Building2}
          titulo="Aún no hay clientes"
          ayuda={esAdmin ? 'Crea un cliente y su primera instalación para empezar.' : 'El administrador debe dar de alta a los clientes.'}
        />
      )}

      {cartera.map(c => (
        <section key={c.id} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <TituloSeccion as="h2" className="mb-0 truncate">{c.nombre}</TituloSeccion>
              {esEscritorio && (
                <p className="text-xs text-muted-foreground truncate">
                  {[c.contacto, `${c.instalaciones.length} ${c.instalaciones.length === 1 ? 'instalación' : 'instalaciones'}`].filter(Boolean).join(' · ')}
                </p>
              )}
              {c.linked_org_nombre && <p className="text-xs text-muted-foreground truncate">M.A.D.Y: {c.linked_org_nombre}</p>}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!c.activo && <Chip>Inactivo</Chip>}
              {esAdmin && (
                <>
                  <button type="button" aria-label={`Editar ${c.nombre}`} className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
                    onClick={() => setClienteSheet({ abierto: true, cliente: c })}>
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <Boton tamano="sm" variante="secundario" onClick={() => setInstSheet({ abierto: true, cliente: c, inst: null })}>
                    <Plus className="w-4 h-4" /> Instalación
                  </Boton>
                </>
              )}
            </div>
          </div>

          {c.instalaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Sin instalaciones.</p>
          ) : esEscritorio ? (
            <ListaTarjetas>
              {c.instalaciones.map(i => (
                <TarjetaInstalacionEscritorio
                  key={i.id}
                  inst={i}
                  esAdmin={esAdmin}
                  onAbrir={() => onAbrir(i.id)}
                  onEditar={() => setInstSheet({ abierto: true, cliente: c, inst: i })}
                />
              ))}
            </ListaTarjetas>
          ) : (
            <div className="grid gap-3 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {c.instalaciones.map(i => (
                <TarjetaInstalacion
                  key={i.id}
                  inst={i}
                  esAdmin={esAdmin}
                  onAbrir={() => onAbrir(i.id)}
                  onEditar={() => setInstSheet({ abierto: true, cliente: c, inst: i })}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      {esAdmin && <Fab aria-label="Nuevo cliente" onClick={() => setClienteSheet({ abierto: true, cliente: null })} />}

      <ClienteSheet open={clienteSheet.abierto} cliente={clienteSheet.cliente} onClose={() => setClienteSheet(s => ({ ...s, abierto: false }))} onGuardado={onRecargar} />
      <InstalacionSheet open={instSheet.abierto} cliente={instSheet.cliente} instalacion={instSheet.inst} onClose={() => setInstSheet(s => ({ ...s, abierto: false }))} onGuardado={onRecargar} onCreada={onAbrir} />
    </div>
  )
}

function useIconoInstalacion(inst: CarteraInstalacion) {
  const sectores = useSectoresChk()
  if (!inst.sector_clave) return MapPin
  return iconoTipoInstalacion(inst.sector_clave, inst.sector_nombre, sectores.find(s => s.clave === inst.sector_clave)?.icono)
}

function LineaVisita({ inst }: { inst: CarteraInstalacion }) {
  const enCurso = inst.visita_en_curso
  const proxima = inst.proxima_visita
  return (
    <div className="text-xs text-muted-foreground space-y-0.5">
      {enCurso ? (
        <p className="font-semibold" style={{ color: 'var(--agro-success-text)' }}>
          Visita en curso · {fechaLarga(enCurso.fecha)}{enCurso.asesor ? ` · ${enCurso.asesor}` : ''}
        </p>
      ) : proxima ? (
        <p>Próxima visita: {fechaLarga(proxima.fecha)}{proxima.asesor ? ` · ${proxima.asesor}` : ''}</p>
      ) : (
        <p>Sin visita programada</p>
      )}
      {inst.ultima_visita && <p>Última visita: {fechaLarga(inst.ultima_visita.fecha)}</p>}
    </div>
  )
}

function ChipsInstalacion({ inst }: { inst: CarteraInstalacion }) {
  return (
    <>
      <ChipCatalogo estado={inst.catalogo_estado} />
      {!inst.activo && <Chip>Inactiva</Chip>}
      {inst.catalogo_estado !== 'sin_catalogo' && <Chip>{inst.documentos} documentos</Chip>}
      {inst.por_confirmar > 0 && <Chip tono={TONOS.info}>{inst.por_confirmar} por confirmar</Chip>}
      {inst.incidencias_abiertas > 0 && <Chip tono={TONOS.peligro}>{inst.incidencias_abiertas} incidencias abiertas</Chip>}
    </>
  )
}

/** Escritorio: tarjeta estándar. La zona del título abre el detalle; "Editar instalación" queda fuera de esa zona. */
function TarjetaInstalacionEscritorio({ inst, esAdmin, onAbrir, onEditar }: { inst: CarteraInstalacion; esAdmin: boolean; onAbrir: () => void; onEditar: () => void }) {
  const Icono = useIconoInstalacion(inst)
  const etiquetaTipo = inst.sector_nombre ?? inst.tipo
  const textoTipo = [etiquetaTipo, inst.ubicacion].filter(Boolean).join(' · ')
  return (
    <TarjetaRegistro
      sinFirmas
      meta={textoTipo ? [
        <span key="tipo" className="inline-flex items-center gap-1">
          <Icono className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {textoTipo}
        </span>,
      ] : []}
      titulo={inst.nombre}
      tituloTexto={inst.nombre}
      chips={<ChipsInstalacion inst={inst} />}
      alHacerClic={onAbrir}
      acciones={<ChevronRight className="w-4 h-4 text-muted-foreground mt-1" aria-hidden="true" />}
      contenido={<div className="mt-2"><LineaVisita inst={inst} /></div>}
      pie={esAdmin ? (
        <button type="button" onClick={onEditar} className="mt-3 rounded-sm text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" style={{ color: 'var(--primary)' }}>
          Editar instalación
        </button>
      ) : undefined}
    />
  )
}

function TarjetaInstalacion({ inst, esAdmin, onAbrir, onEditar }: { inst: CarteraInstalacion; esAdmin: boolean; onAbrir: () => void; onEditar: () => void }) {
  const Icono = useIconoInstalacion(inst)
  const etiquetaTipo = inst.sector_nombre ?? inst.tipo
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <button type="button" onClick={onAbrir} className="w-full text-left flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground truncate">{inst.nombre}</p>
          {(etiquetaTipo || inst.ubicacion) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <Icono className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
              {[etiquetaTipo, inst.ubicacion].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
      </button>

      <div className="flex flex-wrap gap-1.5">
        <ChipsInstalacion inst={inst} />
      </div>

      <LineaVisita inst={inst} />

      {esAdmin && (
        <button type="button" onClick={onEditar} className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
          Editar instalación
        </button>
      )}
    </div>
  )
}
