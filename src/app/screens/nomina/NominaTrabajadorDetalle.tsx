import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Pencil } from 'lucide-react'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { FilaRegistro } from '@/app/components/ui-mady/FilaRegistro'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import {
  useNomActividadesCatalogo, useNomConfig, useNomPerfilesPago, useNomTarifas, useNomTrabajadores,
} from '@/hooks/useNomina'
import { useConexion } from '@/hooks/useConexion'
import { hoyMX } from '@/lib/fecha'
import { fechaCorta, formatoMoneda } from '@/lib/nomina/formato'
import { ETIQUETA_MODALIDAD, PerfilPagoSheet, TarifaSheet, TrabajadorSheet } from './SheetsCatalogos'
import { montoModalidad } from './NominaTrabajadores'
import type { NomTarifa } from '@/types/nomina.types'

type Sheet =
  | { tipo: 'editar' }
  | { tipo: 'modalidad' }
  | { tipo: 'tarifa'; actividadId?: string }
  | { tipo: 'quitar'; actividadId: string }
  | null

function Vigencia({ desde, hasta }: { desde: string; hasta: string | null }) {
  return <>{`desde ${fechaCorta(desde)} ${desde.slice(0, 4)}`}{hasta ? ` hasta ${fechaCorta(hasta)} ${hasta.slice(0, 4)}` : ''}</>
}

export function NominaTrabajadorDetalle() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { offline } = useConexion()
  const { datos: trabajadores, cargando, recargar: recargarTrab } = useNomTrabajadores()
  const { datos: perfiles, recargar: recargarPerfiles } = useNomPerfilesPago(id)
  const { datos: tarifas, recargar: recargarTarifas } = useNomTarifas()
  const { datos: catalogo } = useNomActividadesCatalogo()
  const { datos: config } = useNomConfig()
  const [sheet, setSheet] = useState<Sheet>(null)

  const t = trabajadores.find(x => x.id === id)
  const hoy = hoyMX()
  const moneda = config?.moneda ?? 'MXN'
  const vigente = perfiles.find(p => p.vigente_desde <= hoy && (p.vigente_hasta === null || p.vigente_hasta > hoy))
  const ultima = perfiles[0]

  // Tarifas personales agrupadas por actividad.
  const porActividad = useMemo(() => {
    const propias = tarifas.filter(x => x.trabajador_id === id)
    const mapa = new Map<string, NomTarifa[]>()
    for (const x of propias) mapa.set(x.actividad_id, [...(mapa.get(x.actividad_id) ?? []), x])
    return [...mapa.entries()].map(([actividadId, lista]) => ({
      actividadId,
      nombre: catalogo.find(a => a.id === actividadId)?.nombre ?? 'Actividad',
      unidad: catalogo.find(a => a.id === actividadId)?.unidad ?? '',
      vigente: lista.find(x => x.vigente_desde <= hoy && (x.vigente_hasta === null || x.vigente_hasta > hoy)),
      historial: lista.filter(x => !(x.vigente_desde <= hoy && (x.vigente_hasta === null || x.vigente_hasta > hoy))),
    })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [tarifas, catalogo, id, hoy])

  if (!cargando && !t) {
    return (
      <div className="min-h-full pb-safe-nav">
        <ModuloHeader tituloFallback="Trabajador" onBack={() => navigate('/nomina/trabajadores')} />
        <EstadoVacio titulo="No se encontró el trabajador" accion={<Boton onClick={() => navigate('/nomina/trabajadores')}>Volver a Trabajadores</Boton>} />
      </div>
    )
  }

  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader
        tituloFallback="Trabajador"
        forzarTitulo={t?.nombre ?? 'Trabajador'}
        subtitulo={t?.codigo}
        onBack={() => navigate('/nomina/trabajadores')}
        acciones={
          <Boton variante="icono" aria-label="Editar trabajador" disabled={offline || !t} onClick={() => setSheet({ tipo: 'editar' })}>
            <Pencil className="size-4" />
          </Boton>
        }
      />
      <div className="px-4 py-4 space-y-6 max-w-3xl mx-auto">
        {t && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{t.puesto || 'Sin puesto'}</span>
              <Etiqueta tono={t.activo ? 'menta' : 'neutral'}>{t.activo ? 'Activo' : 'Inactivo'}</Etiqueta>
            </div>
            <p className="text-xs text-muted-foreground">
              Alta {fechaCorta(t.fecha_alta)} {t.fecha_alta.slice(0, 4)}
              {t.fecha_baja && <> · Baja {fechaCorta(t.fecha_baja)} {t.fecha_baja.slice(0, 4)}</>}
            </p>
            <p className="text-xs text-muted-foreground">{t.profile_id ? 'Con usuario ligado: ve sus vouchers' : 'Sin usuario ligado'}</p>
            {t.notas && <p className="text-xs text-muted-foreground">{t.notas}</p>}
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-2">
            <TituloSeccion className="mb-0">Modalidad</TituloSeccion>
            <Boton tamano="sm" variante="secundario" disabled={offline} onClick={() => setSheet({ tipo: 'modalidad' })}>
              Cambiar desde…
            </Boton>
          </div>
          {vigente ? (
            <div className="rounded-xl border border-agro-menta bg-agro-info-fill p-3">
              <p className="text-sm font-semibold text-agro-info-text">
                {ETIQUETA_MODALIDAD[vigente.modalidad]}
                {montoModalidad(vigente) != null && <> · {formatoMoneda(montoModalidad(vigente), moneda)}</>}
              </p>
              <p className="text-xs text-agro-info-text"><Vigencia desde={vigente.vigente_desde} hasta={null} /></p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin modalidad vigente.</p>
          )}
          {perfiles.filter(p => p !== vigente).length > 0 && (
            <div className="mt-3">
              <TituloSeccion variante="subtitulo" className="mb-1">Historial</TituloSeccion>
              {perfiles.filter(p => p !== vigente).map(p => (
                <FilaRegistro
                  key={p.id}
                  icono={null}
                  titulo={ETIQUETA_MODALIDAD[p.modalidad]}
                  subtitulo={<Vigencia desde={p.vigente_desde} hasta={p.vigente_hasta} />}
                  derecha={montoModalidad(p) != null ? <span className="text-sm tabular-nums">{formatoMoneda(montoModalidad(p), moneda)}</span> : undefined}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <TituloSeccion className="mb-0">Tarifas personales</TituloSeccion>
            <Boton tamano="sm" variante="secundario" disabled={offline} onClick={() => setSheet({ tipo: 'tarifa' })}>
              Fijar tarifa
            </Boton>
          </div>
          <p className="text-xs text-muted-foreground mb-1">Ganan sobre la tarifa general de la actividad.</p>
          {porActividad.length === 0 && <p className="text-sm text-muted-foreground py-2">Sin tarifas personales.</p>}
          {porActividad.map(g => (
            <div key={g.actividadId} className="border-b border-border py-2">
              <FilaRegistro
                icono={null}
                titulo={g.nombre}
                subtitulo={g.vigente
                  ? <><Vigencia desde={g.vigente.vigente_desde} hasta={null} /></>
                  : 'Sin tarifa personal vigente'}
                derecha={g.vigente ? <span className="text-sm font-semibold tabular-nums">{formatoMoneda(g.vigente.monto, moneda)}{g.unidad ? ` / ${g.unidad}` : ''}</span> : undefined}
                acciones={
                  <>
                    <Boton tamano="sm" variante="secundario" disabled={offline} onClick={() => setSheet({ tipo: 'tarifa', actividadId: g.actividadId })}>
                      Cambiar
                    </Boton>
                    {g.vigente && (
                      <Boton tamano="sm" variante="secundario" disabled={offline} onClick={() => setSheet({ tipo: 'quitar', actividadId: g.actividadId })}>
                        Quitar
                      </Boton>
                    )}
                  </>
                }
              />
              {g.historial.length > 0 && (
                <ul className="pl-3 text-xs text-muted-foreground space-y-0.5">
                  {g.historial.map(h => (
                    <li key={h.id}>
                      {formatoMoneda(h.monto, moneda)} · <Vigencia desde={h.vigente_desde} hasta={h.vigente_hasta} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      </div>

      {sheet?.tipo === 'editar' && t && (
        <TrabajadorSheet trabajador={t} onClose={() => setSheet(null)} onGuardado={async () => { await recargarTrab() }} />
      )}
      {sheet?.tipo === 'modalidad' && (
        <PerfilPagoSheet trabajadorId={id} ultima={ultima} onClose={() => setSheet(null)} onGuardado={async () => { await recargarPerfiles() }} />
      )}
      {(sheet?.tipo === 'tarifa' || sheet?.tipo === 'quitar') && (
        <TarifaSheet
          trabajadorId={id}
          actividades={catalogo}
          actividadId={sheet.actividadId}
          quitar={sheet.tipo === 'quitar'}
          onClose={() => setSheet(null)}
          onGuardado={async () => { await recargarTarifas() }}
        />
      )}
    </div>
  )
}
