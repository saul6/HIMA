import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { useConexion } from '@/hooks/useConexion'
import {
  useNomCalculo, useNomCaptura, useNomConfig, useNomCuentas, useNomPendientesSemana, useNomPerfilesPago, useNomPrestamos, useNomTrabajadores,
} from '@/hooks/useNomina'
import { hoyMX } from '@/lib/fecha'
import { domingoDe, lunesDe, maxFecha, minFecha, rangoSemana } from '@/lib/nomina/formato'
import { CapturaTab } from './CapturaTab'
import { CorteTab } from './CorteTab'
import type { CtxSemana } from './contexto'

type Pestana = 'captura' | 'corte'

export function NominaTrabajadorSemana() {
  const { trabajadorId = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { offline } = useConexion()
  const hoy = hoyMX()
  const lunes = lunesDe(params.get('fecha') || hoy)
  const domingo = domingoDe(lunes)

  const [pestana, setPestana] = useState<Pestana>('captura')
  const [foco, setFoco] = useState<string | null>(null)

  const { datos: trabajadores } = useNomTrabajadores()
  const { datos: config } = useNomConfig()
  const { datos: perfiles } = useNomPerfilesPago(trabajadorId)
  const calculo = useNomCalculo(trabajadorId, lunes)
  const periodoId = calculo.datos?.periodo_id ?? null
  const captura = useNomCaptura(trabajadorId, periodoId)
  const prestamos = useNomPrestamos(trabajadorId)
  const cuentas = useNomCuentas(trabajadorId)
  const pendientes = useNomPendientesSemana(lunes)

  const trabajador = trabajadores.find(t => t.id === trabajadorId) ?? null
  const aprobada = calculo.datos?.aprobado === true
  const cerrada = pendientes.datos?.estado === 'cerrado'
  const moneda = (calculo.datos?.aprobado ? calculo.datos.corte.calculo?.moneda : calculo.datos?.calculo.moneda) ?? config?.moneda ?? 'MXN'

  const modalidad = useMemo(() => {
    const vig = perfiles
      .filter(p => p.vigente_desde <= domingo && (p.vigente_hasta === null || p.vigente_hasta > lunes))
      .sort((a, b) => (a.vigente_desde < b.vigente_desde ? 1 : -1))[0]
    return vig?.modalidad ?? null
  }, [perfiles, lunes, domingo])

  const recargarCalculo = calculo.recargar
  const recargarCaptura = captura.recargar
  const recargarPrestamos = prestamos.recargar
  const recargarCuentas = cuentas.recargar
  const recargarPendientes = pendientes.recargar
  // Tras cualquier cambio se vuelve a pedir el corte (y lo que depende de él).
  const recargarTodo = useCallback(async () => {
    await recargarCalculo()
    await Promise.all([recargarCaptura(), recargarPrestamos(), recargarCuentas(), recargarPendientes()])
  }, [recargarCalculo, recargarCaptura, recargarPrestamos, recargarCuentas, recargarPendientes])

  const min = maxFecha(maxFecha(config?.fecha_arranque ?? lunes, trabajador?.fecha_alta ?? lunes), lunes)
  const max = minFecha(hoy, domingo)

  const ctx: CtxSemana = {
    trabajadorId, trabajador, lunes, domingo, periodoId, aprobada, cerrada, moneda, min, max, modalidad, recargar: recargarTodo,
  }

  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader
        tituloFallback="Semana del trabajador"
        forzarTitulo={trabajador?.nombre ?? 'Trabajador'}
        subtitulo={rangoSemana(lunes)}
        onBack={() => navigate(`/nomina?fecha=${lunes}`)}
      />
      <div className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
        {offline && (
          <p className="rounded-xl bg-agro-info-fill text-agro-info-text text-xs px-3 py-2">
            Sin conexión: este módulo requiere internet para consultar y guardar.
          </p>
        )}
        <FiltroPildoras<Pestana>
          options={[{ value: 'captura', label: 'Captura' }, { value: 'corte', label: 'Corte' }]}
          value={pestana}
          onChange={setPestana}
        />
        {pestana === 'captura' ? (
          <CapturaTab
            ctx={ctx}
            captura={captura}
            foco={foco}
            onFocoAtendido={() => setFoco(null)}
            onCambio={recargarTodo}
          />
        ) : (
          <CorteTab
            ctx={ctx}
            calculo={calculo}
            prestamos={prestamos}
            cuentas={cuentas.datos}
            ajustes={captura.datos.ajustes}
            onIrActividad={id => { setFoco(id); setPestana('captura') }}
            onCambio={recargarTodo}
          />
        )}
      </div>
    </div>
  )
}
