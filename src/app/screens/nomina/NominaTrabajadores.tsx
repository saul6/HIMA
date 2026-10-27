import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Search, Users } from 'lucide-react'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { FilaRegistro } from '@/app/components/ui-mady/FilaRegistro'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { Boton } from '@/app/components/ui-mady/Boton'
import { useNomPerfilesPago, useNomTrabajadores } from '@/hooks/useNomina'
import { useConexion } from '@/hooks/useConexion'
import { hoyMX } from '@/lib/fecha'
import { formatoMoneda } from '@/lib/nomina/formato'
import { CLASE_INPUT } from './ui'
import { ETIQUETA_MODALIDAD, TrabajadorSheet } from './SheetsCatalogos'
import type { NomPerfilPago } from '@/types/nomina.types'

type Filtro = 'activos' | 'inactivos'

export function montoModalidad(p: NomPerfilPago | undefined): number | null {
  if (!p) return null
  return p.modalidad === 'fijo' ? p.sueldo_semanal : p.modalidad === 'jornada' ? p.tarifa_jornada : p.modalidad === 'hora' ? p.tarifa_hora : null
}

/** Perfil de pago que rige hoy (vigente_desde inclusiva, vigente_hasta exclusiva). */
export function perfilVigente(perfiles: NomPerfilPago[], trabajadorId: string, fecha = hoyMX()): NomPerfilPago | undefined {
  return perfiles
    .filter(p => p.trabajador_id === trabajadorId && p.vigente_desde <= fecha && (p.vigente_hasta === null || p.vigente_hasta > fecha))
    .sort((a, b) => (a.vigente_desde < b.vigente_desde ? 1 : -1))[0]
}

export function NominaTrabajadores() {
  const navigate = useNavigate()
  const { offline } = useConexion()
  const { datos: trabajadores, cargando, error, recargar } = useNomTrabajadores()
  const { datos: perfiles } = useNomPerfilesPago()
  const [filtro, setFiltro] = useState<Filtro>('activos')
  const [busqueda, setBusqueda] = useState('')
  const [nuevo, setNuevo] = useState(false)

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return trabajadores
      .filter(t => !t.solo_historico)
      .filter(t => (filtro === 'activos' ? t.activo : !t.activo))
      .filter(t => !q || t.nombre.toLowerCase().includes(q) || t.codigo.toLowerCase().includes(q))
  }, [trabajadores, filtro, busqueda])

  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader
        tituloFallback="Trabajadores"
        forzarTitulo="Trabajadores"
        onBack={() => navigate('/nomina')}
        acciones={
          <Boton tamano="sm" disabled={offline} onClick={() => setNuevo(true)}>
            <Plus className="size-4" /> Nuevo
          </Boton>
        }
      />
      <div className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o código"
            aria-label="Buscar trabajador"
            className={`${CLASE_INPUT} pl-9`}
          />
        </div>
        <FiltroPildoras<Filtro>
          options={[{ value: 'activos', label: 'Activos' }, { value: 'inactivos', label: 'Inactivos' }]}
          value={filtro}
          onChange={setFiltro}
        />

        {error && (
          <div className="rounded-xl bg-agro-danger-fill text-agro-danger-text text-sm px-3 py-3 space-y-2">
            <p>{error}</p>
            <Boton tamano="sm" variante="secundario" onClick={() => void recargar()}>Reintentar</Boton>
          </div>
        )}

        {!error && !cargando && lista.length === 0 && (
          <EstadoVacio
            icono={Users}
            titulo={busqueda ? 'Sin resultados' : filtro === 'activos' ? 'Aún no hay trabajadores activos' : 'No hay trabajadores inactivos'}
            ayuda={!busqueda && filtro === 'activos' ? 'Crea el primero con el botón Nuevo.' : undefined}
          />
        )}

        {lista.map(t => {
          const p = perfilVigente(perfiles, t.id)
          const monto = montoModalidad(p)
          return (
            <FilaRegistro
              key={t.id}
              icono={undefined}
              titulo={t.nombre}
              subtitulo={[t.codigo, t.puesto].filter(Boolean).join(' · ')}
              lineas={p
                ? <>{ETIQUETA_MODALIDAD[p.modalidad]}{monto != null && <> · {formatoMoneda(monto)}</>}</>
                : 'Sin modalidad asignada'}
              derecha={!t.activo ? <Etiqueta tono="neutral">Inactivo</Etiqueta> : undefined}
              chevron
              to={`/nomina/trabajadores/${t.id}`}
            />
          )
        })}
      </div>

      {nuevo && (
        <TrabajadorSheet
          onClose={() => setNuevo(false)}
          onGuardado={async id => { await recargar(); navigate(`/nomina/trabajadores/${id}`) }}
        />
      )}
    </div>
  )
}
