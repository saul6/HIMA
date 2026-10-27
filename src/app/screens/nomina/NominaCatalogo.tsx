import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Lock, Plus } from 'lucide-react'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { FilaRegistro } from '@/app/components/ui-mady/FilaRegistro'
import {
  nomina, useNomActividadesCatalogo, useNomConceptos, useNomConfig, useNomTarifas,
} from '@/hooks/useNomina'
import { useConexion } from '@/hooks/useConexion'
import { hoyMX } from '@/lib/fecha'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { fechaCorta, formatoMoneda } from '@/lib/nomina/formato'
import { CampoSeleccion, CampoTexto, CuerpoSheet, leerNumero } from './ui'
import { TarifaSheet } from './SheetsCatalogos'
import type { ModoActividad, NomActividadCatalogo, NomConcepto, NomTarifa, TipoConcepto } from '@/types/nomina.types'

type Pestana = 'actividades' | 'conceptos'

const ETIQUETA_MODO: Record<ModoActividad, string> = {
  cantidad: 'Por cantidad',
  importe_pactado: 'Importe pactado',
  informativa: 'Informativa',
}
const ETIQUETA_TIPO: Record<TipoConcepto, string> = {
  percepcion: 'Percepción',
  deduccion: 'Descuento',
  reembolso: 'Reembolso',
  memo: 'Informativo',
}

const vigenteHoy = (t: NomTarifa, hoy: string) => t.vigente_desde <= hoy && (t.vigente_hasta === null || t.vigente_hasta > hoy)

type Sheet =
  | { tipo: 'actividad'; item?: NomActividadCatalogo }
  | { tipo: 'tarifa'; actividadId: string }
  | { tipo: 'concepto'; item?: NomConcepto }
  | null

export function NominaCatalogo() {
  const navigate = useNavigate()
  const { offline } = useConexion()
  const { datos: actividades, recargar: recargarAct, cargando } = useNomActividadesCatalogo()
  const { datos: tarifas, recargar: recargarTar } = useNomTarifas()
  const { datos: conceptos, recargar: recargarCon } = useNomConceptos()
  const { datos: config } = useNomConfig()
  const [pestana, setPestana] = useState<Pestana>('actividades')
  const [verArchivadas, setVerArchivadas] = useState(false)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [abierta, setAbierta] = useState<string | null>(null)

  const hoy = hoyMX()
  const moneda = config?.moneda ?? 'MXN'
  const generales = useMemo(() => tarifas.filter(t => t.trabajador_id === null), [tarifas])
  const visibles = actividades.filter(a => verArchivadas || !a.archivada)
  const sinTarifa = actividades.filter(a => !a.archivada && a.modo === 'cantidad' && !generales.some(t => t.actividad_id === a.id && vigenteHoy(t, hoy)))

  return (
    <div className="min-h-full pb-safe-nav">
      <ModuloHeader
        tituloFallback="Catálogo"
        forzarTitulo="Catálogo"
        onBack={() => navigate('/nomina')}
        acciones={
          <Boton
            tamano="sm"
            disabled={offline}
            onClick={() => setSheet(pestana === 'actividades' ? { tipo: 'actividad' } : { tipo: 'concepto' })}
          >
            <Plus className="size-4" /> Nuevo
          </Boton>
        }
      />
      <div className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
        <FiltroPildoras<Pestana>
          options={[{ value: 'actividades', label: 'Actividades' }, { value: 'conceptos', label: 'Conceptos' }]}
          value={pestana}
          onChange={setPestana}
        />

        {pestana === 'actividades' && (
          <>
            {sinTarifa.length > 0 && (
              <p className="rounded-xl bg-agro-danger-fill text-agro-danger-text text-sm px-3 py-2" role="alert">
                {sinTarifa.length === 1 ? '1 actividad por cantidad no tiene tarifa' : `${sinTarifa.length} actividades por cantidad no tienen tarifa`}:
                no se podrá aprobar un corte que las use.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" checked={verArchivadas} onChange={e => setVerArchivadas(e.target.checked)} />
              Ver archivadas
            </label>
            {!cargando && visibles.length === 0 && (
              <EstadoVacio titulo="Aún no hay actividades" ayuda="Crea la primera con el botón Nuevo." />
            )}
            {visibles.map(a => {
              const hist = generales.filter(t => t.actividad_id === a.id)
              const vigente = hist.find(t => vigenteHoy(t, hoy))
              const abiertaAqui = abierta === a.id
              return (
                <FilaRegistro
                  key={a.id}
                  variante="tarjeta"
                  titulo={a.nombre}
                  subtitulo={[a.codigo, a.categoria, a.unidad].filter(Boolean).join(' · ')}
                  etiquetas={
                    <>
                      <Etiqueta tono="sky">{ETIQUETA_MODO[a.modo]}</Etiqueta>
                      {a.archivada && <Etiqueta tono="neutral">Archivada</Etiqueta>}
                    </>
                  }
                  lineas={
                    a.modo === 'cantidad'
                      ? vigente
                        ? <>Tarifa general {formatoMoneda(vigente.monto, moneda)} / {a.unidad} · desde {fechaCorta(vigente.vigente_desde)} {vigente.vigente_desde.slice(0, 4)}</>
                        : <span className="text-agro-danger-text font-semibold">Sin tarifa: no se podrá aprobar</span>
                      : undefined
                  }
                  acciones={
                    <>
                      <Boton tamano="sm" variante="secundario" disabled={offline} onClick={() => setSheet({ tipo: 'actividad', item: a })}>Editar</Boton>
                      {a.modo === 'cantidad' && (
                        <Boton tamano="sm" variante="secundario" disabled={offline} onClick={() => setSheet({ tipo: 'tarifa', actividadId: a.id })}>
                          Nueva tarifa desde…
                        </Boton>
                      )}
                      {a.modo === 'cantidad' && hist.length > 0 && (
                        <Boton tamano="sm" variante="secundario" onClick={() => setAbierta(abiertaAqui ? null : a.id)}>
                          {abiertaAqui ? 'Ocultar historial' : 'Historial'}
                        </Boton>
                      )}
                    </>
                  }
                  detalle={abiertaAqui ? (
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {hist.map(h => (
                        <li key={h.id}>
                          {formatoMoneda(h.monto, moneda)} · desde {fechaCorta(h.vigente_desde)} {h.vigente_desde.slice(0, 4)}
                          {h.vigente_hasta && <> hasta {fechaCorta(h.vigente_hasta)} {h.vigente_hasta.slice(0, 4)}</>}
                          {h.motivo && <> · {h.motivo}</>}
                        </li>
                      ))}
                    </ul>
                  ) : undefined}
                />
              )
            })}
          </>
        )}

        {pestana === 'conceptos' && (
          <>
            <p className="text-xs text-muted-foreground">Los conceptos de sistema no se pueden modificar.</p>
            {conceptos.map(c => (
              <FilaRegistro
                key={c.id}
                icono={c.sistema ? <Lock className="size-4" /> : undefined}
                titulo={c.nombre}
                subtitulo={ETIQUETA_TIPO[c.tipo]}
                derecha={c.archivado ? <Etiqueta tono="neutral">Archivado</Etiqueta> : undefined}
                chevron={!c.sistema}
                onClick={c.sistema || offline ? undefined : () => setSheet({ tipo: 'concepto', item: c })}
              />
            ))}
          </>
        )}
      </div>

      {sheet?.tipo === 'actividad' && (
        <ActividadCatalogoSheet item={sheet.item} onClose={() => setSheet(null)} onGuardado={recargarAct} />
      )}
      {sheet?.tipo === 'tarifa' && (
        <TarifaSheet
          trabajadorId={null}
          actividades={actividades}
          actividadId={sheet.actividadId}
          onClose={() => setSheet(null)}
          onGuardado={recargarTar}
        />
      )}
      {sheet?.tipo === 'concepto' && (
        <ConceptoSheet item={sheet.item} onClose={() => setSheet(null)} onGuardado={recargarCon} />
      )}
    </div>
  )
}

function ActividadCatalogoSheet({ item, onClose, onGuardado }: {
  item?: NomActividadCatalogo
  onClose: () => void
  onGuardado: () => void | Promise<void>
}) {
  const [nombre, setNombre] = useState(item?.nombre ?? '')
  const [codigo, setCodigo] = useState(item?.codigo ?? '')
  const [categoria, setCategoria] = useState(item?.categoria ?? '')
  const [unidad, setUnidad] = useState(item?.unidad ?? 'jornal')
  const [modo, setModo] = useState<ModoActividad>(item?.modo ?? 'cantidad')
  const [sinonimos, setSinonimos] = useState((item?.sinonimos ?? []).join(', '))
  const [orden, setOrden] = useState(String(item?.orden ?? 0))
  const [archivada, setArchivada] = useState(item?.archivada ?? false)
  const [modoBloqueado, setModoBloqueado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function enviar(sobre: { modo: ModoActividad; archivada: boolean }) {
    setGuardando(true)
    try {
      const n = leerNumero(orden)
      await nomina.guardarActividadCatalogo({
        id: item?.id ?? null,
        nombre: nombre.trim(),
        modo: sobre.modo,
        unidad: unidad.trim(),
        codigo: codigo.trim() || null,
        categoria: categoria.trim() || null,
        sinonimos: sinonimos.split(',').map(s => s.trim()).filter(Boolean),
        orden: Number.isFinite(n) ? Math.round(n) : 0,
        archivada: sobre.archivada,
      })
      toast.success('Actividad guardada')
      await onGuardado()
      onClose()
    } catch (e) {
      const codigoErr = avisarErrorNomina(e, 'No se pudo guardar la actividad')
      if (codigoErr === 'RECLASIFICAR_USADA') setModoBloqueado(true)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title={item ? 'Editar actividad' : 'Nueva actividad'}>
      <CuerpoSheet
        textoGuardar="Guardar"
        onGuardar={() => void enviar({ modo, archivada })}
        cargando={guardando}
        deshabilitado={!nombre.trim() || !unidad.trim()}
      >
        <CampoTexto etiqueta="Nombre" valor={nombre} onChange={setNombre} requerido maxLength={120} />
        <CampoTexto etiqueta="Código" valor={codigo} onChange={setCodigo} maxLength={20} />
        <CampoTexto etiqueta="Categoría" valor={categoria} onChange={setCategoria} maxLength={60} />
        <CampoTexto etiqueta="Unidad (jornal, caja, hora…)" valor={unidad} onChange={setUnidad} requerido maxLength={30} />
        <CampoSeleccion
          etiqueta="Modo de pago"
          valor={modo}
          onChange={v => setModo(v as ModoActividad)}
          requerido
          opciones={(Object.keys(ETIQUETA_MODO) as ModoActividad[]).map(k => ({ valor: k, etiqueta: ETIQUETA_MODO[k] }))}
        />
        <p className="text-xs text-muted-foreground">
          {modo === 'cantidad' && 'Se paga cantidad × tarifa.'}
          {modo === 'importe_pactado' && 'El administrador captura el monto y el motivo en cada registro.'}
          {modo === 'informativa' && 'Aparece en el corte pero no suma al pago.'}
        </p>
        <CampoTexto etiqueta="Sinónimos (separados por coma)" valor={sinonimos} onChange={setSinonimos} />
        <CampoTexto etiqueta="Orden" tipo="number" valor={orden} onChange={setOrden} />
        {item && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" checked={archivada} onChange={e => setArchivada(e.target.checked)} />
            Archivada (no se borra; deja de ofrecerse al capturar)
          </label>
        )}
        {modoBloqueado && item && (
          <div className="rounded-xl bg-agro-info-fill text-agro-info-text text-sm p-3 space-y-2">
            <p>Esta actividad ya tiene registros: no se puede cambiar su modo. Archívala y crea otra con el modo que necesitas.</p>
            <Boton tamano="sm" variante="secundario" onClick={() => void enviar({ modo: item.modo, archivada: true })}>
              Archivar esta actividad
            </Boton>
          </div>
        )}
      </CuerpoSheet>
    </BottomSheet>
  )
}

function ConceptoSheet({ item, onClose, onGuardado }: {
  item?: NomConcepto
  onClose: () => void
  onGuardado: () => void | Promise<void>
}) {
  const [nombre, setNombre] = useState(item?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoConcepto>(item?.tipo ?? 'percepcion')
  const [archivado, setArchivado] = useState(item?.archivado ?? false)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    try {
      await nomina.guardarConcepto({ id: item?.id ?? null, nombre: nombre.trim(), tipo, clave: item?.clave ?? null, archivado })
      toast.success('Concepto guardado')
      await onGuardado()
      onClose()
    } catch (e) {
      avisarErrorNomina(e, 'No se pudo guardar el concepto')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title={item ? 'Editar concepto' : 'Nuevo concepto'}>
      <CuerpoSheet textoGuardar="Guardar" onGuardar={guardar} cargando={guardando} deshabilitado={!nombre.trim()}>
        <CampoTexto etiqueta="Nombre" valor={nombre} onChange={setNombre} requerido maxLength={80} />
        <CampoSeleccion
          etiqueta="Tipo"
          valor={tipo}
          onChange={v => setTipo(v as TipoConcepto)}
          requerido
          opciones={(Object.keys(ETIQUETA_TIPO) as TipoConcepto[]).map(k => ({ valor: k, etiqueta: ETIQUETA_TIPO[k] }))}
        />
        {item && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" checked={archivado} onChange={e => setArchivado(e.target.checked)} />
            Archivado
          </label>
        )}
      </CuerpoSheet>
    </BottomSheet>
  )
}
