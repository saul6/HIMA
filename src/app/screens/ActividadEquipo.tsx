import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { RefreshCw, TriangleAlert, X, AlertTriangle, FileText, Activity, SearchX } from 'lucide-react'
import { toast } from 'sonner'
import { useActividadEquipo } from '@/hooks/useActividadEquipo'
import type { ActividadItem, FiltroSolo } from '@/hooks/useActividadEquipo'
import { useRanchos } from '@/hooks/useRanchos'
import { useMostrarCarga } from '@/hooks/useMostrarCarga'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { marcarCorreccion } from '@/lib/queries'
import { traducirErrorBd } from '@/lib/erroresBd'
import { hoyMX } from '@/lib/fecha'
import { fechaCorta, fechaHora } from '@/lib/formato'
import { pdfRefDeActividad } from '@/lib/actividadPdf'
import { generarBlobParaRef } from '@/lib/pdf/generarBlobHistorial'
import { resolverIcono } from '@/app/components/iconos-modulos'
import { BottomSheet } from '@/app/components/BottomSheet'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { EncabezadoPantalla } from '@/app/components/EncabezadoPantalla'
import { FilaRegistro } from '@/app/components/ui-mady/FilaRegistro'
import { TarjetaContador } from '@/app/components/ui-mady/TarjetaContador'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { Boton } from '@/app/components/ui-mady/Boton'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'

// ── Fechas (todo en 'YYYY-MM-DD', sin pasar por UTC) ──────────────────────────

type Periodo = '7d' | '30d' | 'mes' | 'mes_pasado'

const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: '7d', etiqueta: '7 días' },
  { valor: '30d', etiqueta: '30 días' },
  { valor: 'mes', etiqueta: 'Este mes' },
  { valor: 'mes_pasado', etiqueta: 'Mes pasado' },
]

function aIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  return aIso(new Date(Date.UTC(a, m - 1, d + dias)))
}

function rangoPeriodo(p: Periodo, hoy: string): { desde: string; hasta: string } {
  const [a, m] = hoy.split('-').map(Number)
  if (p === '7d') return { desde: sumarDias(hoy, -6), hasta: hoy }
  if (p === '30d') return { desde: sumarDias(hoy, -29), hasta: hoy }
  if (p === 'mes') return { desde: aIso(new Date(Date.UTC(a, m - 1, 1))), hasta: hoy }
  return {
    desde: aIso(new Date(Date.UTC(a, m - 2, 1))),
    hasta: aIso(new Date(Date.UTC(a, m - 1, 0))),
  }
}

/** Día calendario ('YYYY-MM-DD') de un timestamp, en hora de México. */
function diaMX(ts: string): string {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

function encabezadoDia(dia: string, hoy: string): string {
  if (dia === hoy) return 'Hoy'
  if (dia === sumarDias(hoy, -1)) return 'Ayer'
  return fechaCorta(dia)
}

function fechaSinAnio(iso: string): string {
  return fechaCorta(iso).replace(/ \d{4}$/, '')
}

// ── Fila ──────────────────────────────────────────────────────────────────────

function lineaDos(item: ActividadItem): string {
  const partes: string[] = []
  if (item.creado_por_nombre) partes.push(item.creado_por_nombre)
  if (item.hora_exacta) partes.push(fechaHora(item.creado_en).slice(-5))
  if (item.tipo === 'dia' && item.fecha !== diaMX(item.creado_en)) partes.push(`Día ${fechaSinAnio(item.fecha)}`)
  if (item.tipo === 'jornada' && item.ids.length > 1) partes.push(`${item.ids.length} registros`)
  return partes.join(' · ')
}

const FIRMA_ETIQUETA = {
  firmado: { tono: 'menta', texto: 'Firmado' },
  falta_verifico: { tono: 'sky', texto: 'Falta verificó' },
  sin_firma: { tono: 'neutral', texto: 'Sin firma' },
} as const

interface FilaActividadProps {
  item: ActividadItem
  icono: string | undefined
  generando: boolean
  onMarcar: (item: ActividadItem) => void
  onPdf: (item: ActividadItem) => void
  onAbrir: (item: ActividadItem) => void
}

function FilaActividad({ item, icono, generando, onMarcar, onPdf, onAbrir }: FilaActividadProps) {
  const firma = FIRMA_ETIQUETA[item.firma]
  const tienePdf = pdfRefDeActividad(item) !== null
  const Icono = resolverIcono(icono ?? '')
  const inicial = item.creado_por_nombre?.trim().charAt(0).toUpperCase()

  return (
    <FilaRegistro
      icono={inicial ?? <Icono size={16} aria-hidden="true" />}
      tono={item.requiere_correccion ? 'resaltado' : 'normal'}
      onClick={() => onAbrir(item)}
      etiquetas={
        <>
          <Etiqueta tono={firma.tono}>{firma.texto}</Etiqueta>
          {item.requiere_correccion && <Etiqueta tono="rojo">Por corregir</Etiqueta>}
        </>
      }
      titulo={
        <>
          {item.modulo_nombre}
          {item.rancho_nombre && (
            <span className="ml-2 font-normal text-muted-foreground">{item.rancho_nombre}</span>
          )}
        </>
      }
      subtitulo={lineaDos(item)}
      acciones={
        <div className="flex shrink-0 items-center gap-1">
          {tienePdf && (
            <Boton variante="icono" aria-label="Ver PDF" cargando={generando} onClick={() => onPdf(item)}>
              <FileText className="size-4" aria-hidden="true" />
            </Boton>
          )}
          {item.puede_marcar && (
            <Boton variante="secundario" tamano="sm" onClick={() => onMarcar(item)}>
              {item.requiere_correccion ? 'Desmarcar' : 'Marcar'}
            </Boton>
          )}
        </div>
      }
    >
      {item.requiere_correccion && item.comentario_correccion && (
        <p className="pb-3 text-xs text-agro-info-text">{item.comentario_correccion}</p>
      )}
    </FilaRegistro>
  )
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

const CLASE_SELECT =
  'h-10 w-full min-w-0 rounded-lg border border-border-control bg-input-background px-3 text-sm focus:border-primary focus:outline-none'

// Auditorías (M14–M18) y checklist (M80) no pasan por actividad_equipo.
const MODULOS_FUERA = new Set(['M14', 'M15', 'M16', 'M17', 'M18', 'M80'])

export function ActividadEquipo() {
  const navigate = useNavigate()
  const { profile, codigoClave } = useAuthContext()
  const { modulos, terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const esAdmin = profile?.rol === 'admin_org' || profile?.rol === 'super_admin'

  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [usuario, setUsuario] = useState('')
  const [modulo, setModulo] = useState('')
  const [rancho, setRancho] = useState('')
  const [solo, setSolo] = useState<FiltroSolo | ''>('')

  const hoy = hoyMX()
  const { desde, hasta } = useMemo(() => rangoPeriodo(periodo, hoy), [periodo, hoy])

  const { items, resumen, totalFiltrado, truncado, empleados, loading, error, refetch } =
    useActividadEquipo({ desde, hasta, usuario, modulo, rancho, solo })
  const mostrarSkeleton = useMostrarCarga(loading, items.length > 0)

  const [itemSeleccionado, setItemSeleccionado] = useState<ActividadItem | null>(null)
  const [comentario, setComentario] = useState('')
  const [marcando, setMarcando] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState<string | null>(null)

  const modulosFiltro = useMemo(() => {
    const vistos = new Set<string>()
    return modulos
      .filter((m) => {
        if (MODULOS_FUERA.has(m.codigo) || vistos.has(m.codigo)) return false
        vistos.add(m.codigo)
        return true
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [modulos])

  const iconoPorModulo = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const m of modulos) mapa.set(m.codigo, m.icono)
    return mapa
  }, [modulos])

  const grupos = useMemo(() => {
    const ordenados = [...items].sort((a, b) => b.creado_en.localeCompare(a.creado_en))
    const out: { dia: string; items: ActividadItem[] }[] = []
    for (const it of ordenados) {
      const dia = diaMX(it.creado_en)
      const ultimo = out[out.length - 1]
      if (ultimo && ultimo.dia === dia) ultimo.items.push(it)
      else out.push({ dia, items: [it] })
    }
    return out
  }, [items])

  const hayFiltros = !!(usuario || modulo || rancho || solo)

  function limpiar() {
    setUsuario('')
    setModulo('')
    setRancho('')
    setSolo('')
    setPeriodo('30d')
  }

  function alternarSolo(valor: FiltroSolo) {
    setSolo((actual) => (actual === valor ? '' : valor))
  }

  function abrirSheet(item: ActividadItem) {
    setItemSeleccionado(item)
    setComentario(item.comentario_correccion ?? '')
  }

  function cerrarSheet() {
    setItemSeleccionado(null)
    setComentario('')
  }

  async function handlePdf(item: ActividadItem) {
    const ref = pdfRefDeActividad(item)
    if (!ref || !profile?.org_id) return
    setGenerandoPdf(item.clave)
    try {
      const blob = await generarBlobParaRef(ref, profile.org_id, codigoClave)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${item.modulo.toLowerCase()}-${item.fecha.replaceAll('-', '')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setGenerandoPdf(null)
    }
  }

  async function handleMarcar(requiere: boolean) {
    if (!itemSeleccionado) return
    if (requiere && !comentario.trim()) {
      toast.warning('Escribe un comentario explicando qué debe corregirse.')
      return
    }
    setMarcando(true)
    try {
      await marcarCorreccion(itemSeleccionado.tabla, itemSeleccionado.ids, requiere, comentario.trim())
      toast.success(requiere ? 'Registro marcado para corrección' : 'Corrección desmarcada')
      cerrarSheet()
      refetch()
    } catch (err: unknown) {
      const msg = (err as { message?: string } | null)?.message ?? ''
      const traducido = traducirErrorBd(msg)
      if (traducido) toast.error(traducido)
      else if (msg.toLowerCase().includes('rls') || msg.toLowerCase().includes('permission')) {
        toast.error('No tienes permiso para marcar este registro.')
      } else {
        toast.error('No se pudo actualizar el registro.')
      }
    } finally {
      setMarcando(false)
    }
  }

  const botonActualizar = (
    <button
      onClick={refetch}
      className="p-2 text-muted-foreground transition-colors hover:text-primary"
      aria-label="Actualizar"
      disabled={loading}
    >
      <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
    </button>
  )

  if (!esAdmin) {
    return (
      <div className="min-h-full pb-safe-nav">
        <EncabezadoPantalla titulo="Actividad" alRegresar={() => navigate(-1)} />
        <EstadoVacio icono={Activity} titulo="Solo el administrador puede ver la actividad del equipo" />
      </div>
    )
  }

  return (
    <div className="min-h-full pb-safe-nav">
      <EncabezadoPantalla
        titulo="Actividad"
        alRegresar={() => navigate(-1)}
        accionesEscritorio="contenido"
        acciones={botonActualizar}
      />

      <div className="mx-auto w-full space-y-4 p-4 lg:max-w-[960px]">
        <div className="hidden justify-end md:flex">{botonActualizar}</div>

        {/* Resumen */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TarjetaContador etiqueta="Hoy" valor={resumen.hoy} indice={0} />
          <TarjetaContador etiqueta="Esta semana" valor={resumen.semana} indice={1} />
          <TarjetaContador
            etiqueta="Sin verificar"
            valor={resumen.sin_verificar}
            variante="seleccionable"
            activo={solo === 'sin_verificar'}
            onClick={() => alternarSolo('sin_verificar')}
            indice={2}
          />
          <TarjetaContador
            etiqueta="Por corregir"
            valor={resumen.por_corregir}
            tono={resumen.por_corregir > 0 ? 'alerta' : 'normal'}
            variante="seleccionable"
            activo={solo === 'correccion'}
            onClick={() => alternarSolo('correccion')}
            indice={3}
          />
        </div>

        {/* Filtros */}
        <div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <select aria-label="Colaborador" value={usuario} onChange={(e) => setUsuario(e.target.value)} className={CLASE_SELECT}>
              <option value="">Todos los colaboradores</option>
              {empleados.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre_completo}</option>
              ))}
            </select>
            <select aria-label="Módulo" value={modulo} onChange={(e) => setModulo(e.target.value)} className={CLASE_SELECT}>
              <option value="">Todos los módulos</option>
              {modulosFiltro.map((m) => (
                <option key={m.codigo} value={m.codigo}>{m.nombre}</option>
              ))}
            </select>
            <select aria-label={terminosSitio.singular} value={rancho} onChange={(e) => setRancho(e.target.value)} className={CLASE_SELECT}>
              <option value="">{terminosSitio.plural}</option>
              {ranchos.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
            <select aria-label="Periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className={CLASE_SELECT}>
              {PERIODOS.map((p) => (
                <option key={p.valor} value={p.valor}>{p.etiqueta}</option>
              ))}
            </select>
          </div>
          {hayFiltros && (
            <button onClick={limpiar} className="mt-2 text-xs text-muted-foreground underline">
              Limpiar
            </button>
          )}
        </div>

        {/* Lista */}
        {error ? (
          <div className="flex flex-col items-center gap-3 rounded-xl p-4" style={{ backgroundColor: 'var(--agro-danger-fill)' }}>
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 flex-shrink-0 text-agro-danger-text" />
              <p className="text-xs text-agro-danger-text">Error al cargar la actividad. Verifica tu conexión.</p>
            </div>
            <Boton variante="secundario" tamano="sm" onClick={refetch}>Reintentar</Boton>
          </div>
        ) : mostrarSkeleton ? (
          <ListaSkeleton />
        ) : loading && items.length === 0 ? null : items.length === 0 ? (
          hayFiltros ? (
            <EstadoVacio
              icono={SearchX}
              titulo="Ningún registro con estos filtros"
              accion={<Boton variante="secundario" tamano="sm" onClick={limpiar}>Limpiar</Boton>}
            />
          ) : (
            <EstadoVacio icono={Activity} titulo="Sin actividad" ayuda="Tu equipo aún no ha registrado nada en este periodo." />
          )
        ) : (
          <div className="space-y-4">
            {grupos.map((g) => (
              <section key={g.dia}>
                <TituloSeccion as="h2" variante="subtitulo" className="mb-1 px-1">
                  {encabezadoDia(g.dia, hoy)}
                </TituloSeccion>
                <div>
                  {g.items.map((item) => (
                    <FilaActividad
                      key={item.clave}
                      item={item}
                      icono={iconoPorModulo.get(item.modulo)}
                      generando={generandoPdf === item.clave}
                      onMarcar={abrirSheet}
                      onPdf={handlePdf}
                      onAbrir={(it) => navigate(it.ruta)}
                    />
                  ))}
                </div>
              </section>
            ))}
            {truncado && (
              <p className="px-1 text-center text-xs text-muted-foreground">
                Mostrando {items.length} de {totalFiltrado}. Ajusta los filtros para ver el resto.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom Sheet — marcar/desmarcar corrección */}
      <BottomSheet open={!!itemSeleccionado} onClose={cerrarSheet}>
        {itemSeleccionado && (
          <>
            <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 pb-3 pt-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-foreground">
                  {itemSeleccionado.requiere_correccion ? 'Gestionar corrección' : 'Marcar para corrección'}
                </h2>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[
                    itemSeleccionado.modulo_nombre,
                    itemSeleccionado.rancho_nombre,
                    fechaSinAnio(itemSeleccionado.fecha) +
                      (itemSeleccionado.ids.length > 1 ? `, ${itemSeleccionado.ids.length} registros` : ''),
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={cerrarSheet} className="-m-2 ml-2 p-3">
                <X className="size-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {itemSeleccionado.creado_por_nombre && (
                <div className="text-sm text-muted-foreground">
                  Registrado por: <span className="font-semibold text-foreground">{itemSeleccionado.creado_por_nombre}</span>
                </div>
              )}

              {itemSeleccionado.requiere_correccion && itemSeleccionado.marcado_en && (
                <div className="rounded-lg bg-agro-info-fill px-3 py-2 text-xs text-agro-info-text">
                  Marcado el {fechaHora(itemSeleccionado.marcado_en)}
                  {itemSeleccionado.marcado_por_nombre ? ` por ${itemSeleccionado.marcado_por_nombre}` : ''}
                </div>
              )}

              <div>
                <label htmlFor="comentario-correccion" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  {itemSeleccionado.requiere_correccion ? 'Actualizar comentario' : 'Qué debe corregirse *'}
                </label>
                <textarea
                  id="comentario-correccion"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Describe qué está mal o qué debe corregirse..."
                  className="w-full resize-none rounded-lg border border-border-control bg-input-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">{comentario.length}/500</p>
              </div>
            </div>

            <div className="flex-shrink-0 space-y-2 border-t border-border p-4">
              {itemSeleccionado.requiere_correccion ? (
                <>
                  <Boton className="w-full" cargando={marcando} onClick={() => handleMarcar(true)}>
                    Actualizar comentario
                  </Boton>
                  <Boton variante="secundario" className="w-full" disabled={marcando} onClick={() => handleMarcar(false)}>
                    Desmarcar corrección
                  </Boton>
                </>
              ) : (
                <Boton className="w-full" cargando={marcando} onClick={() => handleMarcar(true)}>
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  Marcar para corrección
                </Boton>
              )}
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  )
}
