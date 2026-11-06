import { useState, useCallback, useMemo } from "react"
import { motion, useReducedMotion } from "motion/react"
import {
  Search,
  ChevronDown,
  ExternalLink,
  FileText,
} from "lucide-react"
import { toast } from "sonner"
import { useAuthContext } from "@/context/AuthContext"
import { useRanchos } from "@/hooks/useRanchos"
import { useCatalogoProductos } from "@/hooks/useCatalogoProductos"
import { useInventario } from "@/hooks/useInventario"
import {
  getMovimientosProducto,
  registrarMovimiento,
  type MovimientoConRancho,
} from "@/lib/queries"
import { generarInventarioReg01PDF } from "@/lib/pdf/m2/generarInventarioReg01PDF"
import { ProductoCombobox } from "@/app/components/nueva-aplicacion/ProductoCombobox"
import { FormField } from "@/app/components/FormField"
import { FormSelect } from "@/app/components/FormSelect"
import type { TipoMovimiento, InventarioSaldoRancho, InventarioSaldoProductor, Rancho } from "@/types/database.types"
import { useModulosContext } from '@/context/ModulosContext'
import { Fab } from '@/app/components/Fab'
import { BottomSheet } from '@/app/components/BottomSheet'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { EncabezadoPantalla } from '@/app/components/EncabezadoPantalla'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DUR, EASE_OUT, useEntradaPantalla } from '@/lib/motion'
import { ListaTarjetas, ListaAncho } from '@/app/components/ui-mady/ListaTarjetas'
import { TarjetaRegistro } from '@/app/components/ui-mady/TarjetaRegistro'
import { SelectorSegmentado } from '@/app/components/ui-mady/SelectorSegmentado'
import { PieFormulario } from '@/app/components/ui-mady/PieFormulario'
import { Campo } from '@/app/components/ui-mady/Campo'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { limiteTexto } from '@/lib/limitesTexto'

const LOW_STOCK = 5

type Vista = "rancho" | "productor"

function fmtSaldo(saldo: number): string {
  return Number.isInteger(saldo) ? String(saldo) : saldo.toFixed(2)
}

function StatusBadge({ saldo }: { saldo: number }) {
  if (Number(saldo) <= 0) {
    return <Etiqueta tono="error">Agotado</Etiqueta>
  }
  if (Number(saldo) < LOW_STOCK) {
    return <Etiqueta tono="sky">Bajo</Etiqueta>
  }
  return <Etiqueta tono="menta">Disponible</Etiqueta>
}

function TipoBadge({ tipo }: { tipo: TipoMovimiento }) {
  if (tipo === "entrada") {
    return (
      <Etiqueta tono="menta">
        Entrada
      </Etiqueta>
    )
  }
  if (tipo === "salida") {
    return (
      <Etiqueta tono="error">
        Salida
      </Etiqueta>
    )
  }
  return (
    <Etiqueta tono="neutral">
      Ajuste
    </Etiqueta>
  )
}

function HistorialInline({
  movimientos,
  loading,
  ranchoVisible,
}: {
  movimientos: MovimientoConRancho[]
  loading: boolean
  ranchoVisible: boolean
}) {
  if (loading) {
    return (
      <div className="border-t border-border p-4 bg-muted">
        <div className="space-y-2" aria-busy="true" aria-label="Cargando historial">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
    )
  }
  if (movimientos.length === 0) {
    return (
      <div className="border-t border-border p-4 bg-muted">
        <p className="text-xs text-muted-foreground">Sin movimientos registrados.</p>
      </div>
    )
  }
  return (
    <div className="border-t border-border p-4 bg-muted space-y-2">
      <h4 className="text-xs text-muted-foreground mb-2 font-semibold">
        HISTORIAL DE MOVIMIENTOS
      </h4>
      {movimientos.map((m) => (
        <div key={m.id} className="flex items-start justify-between text-sm gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{m.fecha}</span>
              <TipoBadge tipo={m.tipo} />
            </div>
            {ranchoVisible && m.ranchos?.nombre && (
              <span className="text-xs text-muted-foreground">{m.ranchos.nombre}</span>
            )}
            {m.referencia && (
              <span className="text-xs text-muted-foreground">Ref: {m.referencia}</span>
            )}
            {m.aplicacion_id && (
              <span className="flex items-center gap-1 text-xs text-primary">
                <ExternalLink className="w-3 h-3" />
                Desde aplicación M1
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span
              className={m.tipo === "salida" ? "text-agro-danger-text" : "text-agro-success-text"}
              style={{ fontWeight: 600 }}
            >
              {m.tipo === "salida" ? "−" : "+"}{fmtSaldo(Number(m.cantidad))}
            </span>
            <span className="text-muted-foreground">→ {fmtSaldo(Number(m.balance))}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Bottom sheet para registrar movimiento ────────────────────────────────────

const emptyForm = {
  productoId: "",
  ranchoId: "",
  tipo: "entrada" as TipoMovimiento,
  cantidad: "",
  fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }),
  referencia: "",
  notas: "",
}

interface SheetProps {
  onClose: () => void
  onSaved: () => void
  registradoPor: string
  orgId: string
  ranchoOptions: { value: string; label: string }[]
  productos: ReturnType<typeof useCatalogoProductos>["productos"]
}

function RegistrarMovimientoSheet({ onClose, onSaved, registradoPor, orgId, ranchoOptions, productos }: SheetProps) {
  const { terminosSitio } = useModulosContext()
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const set = (key: keyof typeof emptyForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!form.productoId) { toast.error("Selecciona un producto"); return }
    if (!form.ranchoId) { toast.error(`Selecciona ${terminosSitio.genero === 'f' ? 'una' : 'un'} ${terminosSitio.singular.toLowerCase()}`); return }
    const cantidad = parseFloat(form.cantidad)
    if (!cantidad || cantidad <= 0) { toast.error("La cantidad debe ser mayor a 0"); return }
    if (!form.fecha) { toast.error("La fecha es requerida"); return }

    setSaving(true)
    try {
      await registrarMovimiento({
        rancho_id: form.ranchoId,
        producto_id: form.productoId,
        tipo: form.tipo,
        cantidad,
        fecha: form.fecha,
        referencia: form.referencia || null,
        notas: form.notas || null,
        registrado_por: registradoPor,
        org_id: orgId,
      })
      toast.success("Movimiento registrado")
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar movimiento")
    } finally {
      setSaving(false)
    }
  }

  const tipos: { value: TipoMovimiento; label: string }[] = [
    { value: "entrada", label: "Entrada" },
    { value: "salida", label: "Salida" },
    { value: "ajuste", label: "Ajuste" },
  ]

  return (
    <BottomSheet open onClose={onClose} height="85%" title="Registrar movimiento">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Tipo */}
        <Campo etiqueta="Tipo de movimiento" className="gap-2">
          {() => (
            <SelectorSegmentado
              value={form.tipo}
              onChange={(tipo) => setForm((prev) => ({ ...prev, tipo }))}
              options={tipos}
              ariaLabel="Tipo de movimiento"
              className="w-full [&>button]:flex-1"
            />
          )}
        </Campo>

        {/* Producto */}
        <Campo etiqueta="Producto" className="gap-2">
          {() => (
            <ProductoCombobox
              productos={productos}
              value={form.productoId}
              onSelect={(id) => setForm((prev) => ({ ...prev, productoId: id }))}
            />
          )}
        </Campo>

        {/* Rancho */}
        <FormSelect
          label={terminosSitio.singular}
          value={form.ranchoId}
          onChange={set("ranchoId")}
          options={ranchoOptions}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Cantidad"
            type="number"
            value={form.cantidad}
            onChange={set("cantidad")}
            placeholder="0"
          />
          <FormField
            label="Fecha"
            type="date"
            value={form.fecha}
            onChange={set("fecha")}
          />
        </div>

        <FormField maxLength={limiteTexto('inventario_movimientos', 'referencia')}
          label="Referencia (opcional)"
          value={form.referencia}
          onChange={set("referencia")}
          placeholder="Ej: Factura 1234"
        />

        <FormField maxLength={limiteTexto('inventario_movimientos', 'notas')}
          label="Notas (opcional)"
          value={form.notas}
          onChange={set("notas")}
        />
      </div>

      <PieFormulario
        textoPrincipal="Guardar movimiento"
        onPrincipal={handleSave}
        onCancelar={onClose}
        cargando={saving}
      />
    </BottomSheet>
  )
}

// ── Bottom sheet REG-01 ───────────────────────────────────────────────────────

interface ExportSheetProps {
  onClose: () => void
  ranchoOptions: { value: string; label: string }[]
  ranchos: Rancho[]
  orgId: string
}

function ExportarReg01Sheet({ onClose, ranchoOptions, ranchos, orgId }: ExportSheetProps) {
  const [ranchoId, setRanchoId] = useState("")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [generando, setGenerando] = useState(false)

  const handleGenerar = async () => {
    if (!ranchoId) { toast.error("Selecciona un rancho"); return }
    const rancho = ranchos.find((r) => r.id === ranchoId)
    if (!rancho) return
    setGenerando(true)
    try {
      await generarInventarioReg01PDF({
        orgId,
        ranchoId,
        ranchoNombre: rancho.nombre,
        cultivo: rancho.cultivo,
        desde: desde || undefined,
        hasta: hasta || undefined,
      })
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar PDF")
    } finally {
      setGenerando(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} title="Exportar REG-01">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <FormSelect
          label="Rancho"
          value={ranchoId}
          onChange={setRanchoId}
          options={ranchoOptions}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Desde (opcional)"
            type="date"
            value={desde}
            onChange={setDesde}
          />
          <FormField
            label="Hasta (opcional)"
            type="date"
            value={hasta}
            onChange={setHasta}
          />
        </div>
      </div>
      <PieFormulario
        textoPrincipal="Generar PDF"
        onPrincipal={handleGenerar}
        onCancelar={onClose}
        cargando={generando}
      />
    </BottomSheet>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function Inventario() {
  const { productor, user, profile } = useAuthContext()
  const { terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { productos } = useCatalogoProductos()
  const { saldosRancho, saldosProductor, loading, error, refetch } = useInventario(
    productor?.id ?? null,
  )
  const reducedMotion = useReducedMotion()
  const ent = useEntradaPantalla(!loading)

  const esOperario = profile?.rol === 'operario'
  const esCampo = terminosSitio.singular === 'Rancho'
  const [vista, setVista] = useState<Vista>("rancho")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("Todos")
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [historialCache, setHistorialCache] = useState<Record<string, MovimientoConRancho[]>>({})
  const [loadingHistorial, setLoadingHistorial] = useState<string | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [showExportSheet, setShowExportSheet] = useState(false)

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: r.nombre }))

  // Categorías derivadas del dataset activo
  const categorias = useMemo(() => {
    const items = vista === "rancho" ? saldosRancho : saldosProductor
    const cats = [...new Set(items.map((i) => i.categoria))].sort()
    return ["Todos", ...cats]
  }, [vista, saldosRancho, saldosProductor])

  // Resetear filtro al cambiar de vista si la categoría ya no existe
  const handleVistaChange = (v: Vista) => {
    setVista(v)
    setActiveFilter("Todos")
    setExpandedKey(null)
  }

  // Filtrado
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const matchSearch = (item: InventarioSaldoRancho | InventarioSaldoProductor) =>
      item.nombre_comercial.toLowerCase().includes(q) ||
      item.ingrediente_activo.toLowerCase().includes(q)
    const matchCat = (item: InventarioSaldoRancho | InventarioSaldoProductor) =>
      activeFilter === "Todos" || item.categoria === activeFilter

    if (vista === "rancho") {
      return saldosRancho.filter((i) => matchSearch(i) && matchCat(i))
    }
    return saldosProductor.filter((i) => matchSearch(i) && matchCat(i))
  }, [vista, saldosRancho, saldosProductor, searchQuery, activeFilter])

  const toggleHistorial = useCallback(
    async (key: string, productoId: string, ranchoId?: string) => {
      if (expandedKey === key) {
        setExpandedKey(null)
        return
      }
      setExpandedKey(key)
      if (historialCache[key]) return
      setLoadingHistorial(key)
      try {
        const movs = await getMovimientosProducto(productoId, ranchoId)
        setHistorialCache((prev) => ({ ...prev, [key]: movs }))
      } catch {
        toast.error("No se pudo cargar el historial")
      } finally {
        setLoadingHistorial(null)
      }
    },
    [expandedKey, historialCache],
  )

  const handleSaved = () => {
    setShowSheet(false)
    setHistorialCache({})
    refetch()
  }

  // Tarjeta de producto (misma para las dos vistas; cambia la clave, el sitio y el historial).
  const renderTarjeta = (
    item: InventarioSaldoRancho | InventarioSaldoProductor,
    key: string,
    index: number,
    ranchoId?: string,
    ranchoNombre?: string,
  ) => {
    const expanded = expandedKey === key
    const saldo = Number(item.saldo)
    return (
      <motion.div key={key} {...ent(index)}>
        <TarjetaRegistro
          sinFirmas
          meta={[item.ingrediente_activo, ranchoNombre]}
          titulo={item.nombre_comercial}
          tituloTexto={item.nombre_comercial}
          chips={(
            <>
              <StatusBadge saldo={saldo} />
              {item.ultimo_movimiento && (
                <Etiqueta tono="neutral" className="font-normal">Último mov.: {item.ultimo_movimiento}</Etiqueta>
              )}
            </>
          )}
          acciones={(
            <div className="text-right">
              <p className={`text-lg font-semibold leading-tight tabular-nums ${saldo <= 0 ? 'text-agro-danger-text' : 'text-foreground'}`}>
                {fmtSaldo(saldo)}
              </p>
              {item.unidad && <p className="text-xs text-muted-foreground">{item.unidad}</p>}
            </div>
          )}
        >
          <button
            onClick={() => toggleHistorial(key, item.producto_id, ranchoId)}
            aria-expanded={expanded}
            className="mt-2 flex items-center gap-1 text-sm text-primary font-semibold"
          >
            <ChevronDown className={`accordion-arrow w-4 h-4 ${expanded ? 'is-open' : ''}`} />
            {expanded ? 'Ocultar historial' : 'Ver historial'}
          </button>
          <div
            className={`accordion-rows -mx-4 mt-2 rounded-b-xl ${expanded ? 'is-open -mb-4' : ''}`}
            aria-hidden={!expanded}
            inert={!expanded ? '' : undefined}
          >
            <div>
              <HistorialInline
                movimientos={historialCache[key] ?? []}
                loading={loadingHistorial === key}
                ranchoVisible={ranchoId === undefined}
              />
            </div>
          </div>
        </TarjetaRegistro>
      </motion.div>
    )
  }

  return (
    <div className="min-h-full pb-safe-nav">
      <EncabezadoPantalla
        titulo="Inventario"
        acciones={
          esCampo ? (
            <button
              onClick={() => setShowExportSheet(true)}
              className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-card border border-border text-foreground hover:bg-muted transition-colors text-xs font-semibold"
            >
              <FileText className="w-3.5 h-3.5" />
              REG-01
            </button>
          ) : undefined
        }
        debajo={
        !esOperario ? (
          <SelectorSegmentado
            value={vista}
            onChange={handleVistaChange}
            ariaLabel="Vista del inventario"
            options={[
              { value: "rancho" as Vista, label: `Por ${terminosSitio.singular.toLowerCase()}` },
              { value: "productor" as Vista, label: "Por productor" },
            ]}
          />
        ) : undefined
        }
      />

      <div className="p-4 space-y-4">
        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o ingrediente…"
            className="w-full h-12 pl-12 pr-4 rounded-lg border border-border-control bg-input-background
              focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Filtros por categoría */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FiltroPildoras options={categorias} value={activeFilter} onChange={setActiveFilter} />
        </div>

        {/* Estado de carga / error */}
        {loading && <ListaSkeleton rejilla onReintentar={refetch} />}
        {error && (
          <div className="p-4 rounded-xl bg-agro-danger-fill text-agro-danger-text text-sm">
            {error}
          </div>
        )}

        {/* Lista: el cambio de vista es un fundido (solo opacidad) */}
        {!loading && !error && (
          <motion.div
            key={vista}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DUR.base, ease: EASE_OUT } }}
          >
            <ListaTarjetas>
              {filtered.length === 0 ? (
                <ListaAncho>
                  <EstadoVacio
                    titulo={searchQuery || activeFilter !== "Todos" ? "Sin resultados con estos filtros." : "Sin productos en inventario."}
                  />
                </ListaAncho>
              ) : vista === "rancho" ? (
                (filtered as InventarioSaldoRancho[]).map((item, index) =>
                  renderTarjeta(item, `${item.rancho_id}||${item.producto_id}`, index, item.rancho_id, item.rancho_nombre),
                )
              ) : (
                (filtered as InventarioSaldoProductor[]).map((item, index) =>
                  renderTarjeta(item, item.producto_id, index),
                )
              )}
            </ListaTarjetas>
          </motion.div>
        )}
      </div>

      {/* FAB — mismo ancla que el bottom-nav para quedar dentro del contenedor de 390px */}
            <Fab onClick={() => setShowSheet(true)} />

      {/* Bottom sheet */}
      {showSheet && user && profile?.org_id && (
        <RegistrarMovimientoSheet
          onClose={() => setShowSheet(false)}
          onSaved={handleSaved}
          registradoPor={user.id}
          orgId={profile.org_id}
          ranchoOptions={ranchoOptions}
          productos={productos}
        />
      )}

      {showExportSheet && profile?.org_id && (
        <ExportarReg01Sheet
          onClose={() => setShowExportSheet(false)}
          ranchoOptions={ranchoOptions}
          ranchos={ranchos}
          orgId={profile.org_id}
        />
      )}
    </div>
  )
}
