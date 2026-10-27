import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Search, X } from 'lucide-react'
import { BottomSheet } from '@/app/components/BottomSheet'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { nomina } from '@/hooks/useNomina'
import { avisarErrorNomina } from '@/lib/nomina/errores'
import { leerCantidad, leerMonto, r2, r4 } from '@/lib/nomina/formato'
import { CLASE_INPUT, CampoMonto, CampoSeleccion, CampoTexto, CampoTextoLargo, CuerpoSheet, useLlave } from './ui'
import type { CtxSemana } from './contexto'
import type { NomActividad, NomActividadCatalogo } from '@/types/nomina.types'

export interface InicialActividad {
  actividadId?: string
  cantidad?: number
  ranchoId?: string | null
}

interface Props {
  ctx: CtxSemana
  catalogo: NomActividadCatalogo[]
  ranchos: { id: string; nombre: string }[]
  editar?: NomActividad
  inicial?: InicialActividad
  onClose: () => void
}

function normalizar(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const AYUDA_MODO: Record<string, string> = {
  cantidad: 'Se paga cantidad × tarifa.',
  importe_pactado: 'Se paga el importe que captures.',
  informativa: 'No suma al pago.',
}

export function ActividadSheet({ ctx, catalogo, ranchos, editar, inicial, onClose }: Props) {
  const { llave, renovar } = useLlave()
  const fechaInicial = editar?.fecha ?? (ctx.max >= ctx.min ? ctx.max : ctx.min)
  const [fecha, setFecha] = useState(fechaInicial)
  const [actividadId, setActividadId] = useState(editar?.actividad_id ?? inicial?.actividadId ?? '')
  const [busqueda, setBusqueda] = useState('')
  const [cantidad, setCantidad] = useState(String(editar?.cantidad ?? inicial?.cantidad ?? 1))
  const [especial, setEspecial] = useState(editar?.importe_pactado != null)
  const [importe, setImporte] = useState(editar?.importe_pactado != null ? String(editar.importe_pactado) : '')
  const [motivoPactado, setMotivoPactado] = useState(editar?.motivo_pactado ?? '')
  const [ranchoId, setRanchoId] = useState(editar?.rancho_id ?? inicial?.ranchoId ?? '')
  const [nota, setNota] = useState(editar?.nota ?? '')
  const [guardando, setGuardando] = useState(false)

  const seleccionada = catalogo.find(a => a.id === actividadId) ?? null
  const modo = seleccionada?.modo
  const pideImporte = modo === 'importe_pactado' || (modo === 'cantidad' && especial)

  const grupos = useMemo(() => {
    const q = normalizar(busqueda.trim())
    const filtradas = catalogo.filter(a => {
      if (a.archivada && a.id !== actividadId) return false
      if (!q) return true
      return [a.nombre, a.codigo ?? '', ...(a.sinonimos ?? [])].some(t => normalizar(t).includes(q))
    })
    const porCat = new Map<string, NomActividadCatalogo[]>()
    for (const a of filtradas) {
      const c = a.categoria?.trim() || 'Sin categoría'
      porCat.set(c, [...(porCat.get(c) ?? []), a])
    }
    return [...porCat.entries()].sort((x, y) => x[0].localeCompare(y[0], 'es'))
  }, [catalogo, busqueda, actividadId])

  const cant = leerCantidad(cantidad)
  const imp = leerMonto(importe)
  const incompleto =
    !seleccionada ||
    (modo !== 'importe_pactado' && !(cant > 0)) ||
    (pideImporte && !(imp > 0)) ||
    (pideImporte && motivoPactado.trim().length < 3) ||
    !fecha

  async function guardar() {
    if (!seleccionada || incompleto) return
    setGuardando(true)
    const comun = {
      fecha,
      actividad: seleccionada.id,
      cantidad: modo === 'importe_pactado' ? 1 : r4(cant),
      importePactado: pideImporte ? r2(imp) : null,
      motivoPactado: pideImporte ? motivoPactado.trim() : null,
      ranchoId: ranchoId || null,
      nota: nota.trim() || null,
    }
    try {
      if (editar) {
        await nomina.editarActividad({ id: editar.id, version: editar.version, ...comun })
        toast.success('Actividad actualizada')
      } else {
        const r = await nomina.registrarActividad({
          trabajador: ctx.trabajadorId, clientOperationId: llave(), ...comun,
        })
        renovar()
        toast.success(r.duplicada ? 'La actividad ya estaba registrada' : 'Actividad registrada')
      }
      await ctx.recargar()
      onClose()
    } catch (e) {
      const codigo = avisarErrorNomina(e, 'No se pudo guardar la actividad')
      if (codigo === 'VERSION_CONFLICT') {
        await ctx.recargar()
        onClose()
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} height="85%" title={editar ? 'Editar actividad' : 'Nueva actividad'}>
      <CuerpoSheet textoGuardar="Guardar" onGuardar={guardar} cargando={guardando} deshabilitado={incompleto}>
        <CampoTexto etiqueta="Fecha" tipo="date" valor={fecha} onChange={setFecha} min={ctx.min} max={ctx.max} requerido />

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">
            Actividad<span aria-hidden="true"> *</span>
          </p>
          {seleccionada ? (
            <div className="flex items-center gap-2 rounded-xl border border-border-control px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{seleccionada.nombre}</p>
                <p className="text-xs text-muted-foreground">{AYUDA_MODO[seleccionada.modo]}</p>
              </div>
              {!editar && (
                <button type="button" aria-label="Cambiar actividad" className="p-1" onClick={() => setActividadId('')}>
                  <X className="size-4 text-muted-foreground" />
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
                <input
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o código"
                  aria-label="Buscar actividad"
                  className={`${CLASE_INPUT} pl-9`}
                />
              </div>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-border">
                {grupos.length === 0 && <p className="p-3 text-xs text-muted-foreground">Sin resultados</p>}
                {grupos.map(([cat, lista]) => (
                  <div key={cat}>
                    <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground">{cat}</p>
                    {lista.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setActividadId(a.id)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span className="truncate">{a.nombre}</span>
                        {a.modo === 'informativa' && <Etiqueta tono="neutral">No suma</Etiqueta>}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {seleccionada && modo !== 'importe_pactado' && (
          <CampoMonto
            cantidad
            etiqueta={`Cantidad${seleccionada.unidad ? ` (${seleccionada.unidad})` : ''}`}
            valor={cantidad}
            onChange={setCantidad}
            requerido
          />
        )}

        {modo === 'cantidad' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={especial} onChange={e => setEspecial(e.target.checked)} className="size-4" />
            Precio especial para este evento
          </label>
        )}

        {pideImporte && (
          <>
            <CampoMonto
              etiqueta={modo === 'importe_pactado' ? 'Importe pactado' : 'Importe especial (total del evento)'}
              valor={importe}
              onChange={setImporte}
              requerido
            />
            <CampoTextoLargo etiqueta="Motivo del importe" valor={motivoPactado} onChange={setMotivoPactado} requerido />
          </>
        )}

        <CampoSeleccion
          etiqueta="Sitio"
          valor={ranchoId}
          onChange={setRanchoId}
          vacio="Sin sitio"
          opciones={ranchos.map(r => ({ valor: r.id, etiqueta: r.nombre }))}
        />
        <CampoTextoLargo etiqueta="Nota" valor={nota} onChange={setNota} />
      </CuerpoSheet>
    </BottomSheet>
  )
}
