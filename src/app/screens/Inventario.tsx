import { useState, useCallback, useMemo } from "react"
import {
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
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
import { ProductoCombobox } from "@/app/components/nueva-aplicacion/ProductoCombobox"
import { FormField } from "@/app/components/FormField"
import { FormSelect } from "@/app/components/FormSelect"
import type { TipoMovimiento, InventarioSaldoRancho, InventarioSaldoProductor } from "@/types/database.types"
import { useModulosContext } from '@/context/ModulosContext'

const LOW_STOCK = 5

type Vista = "rancho" | "productor"

function fmtSaldo(saldo: number): string {
  return Number.isInteger(saldo) ? String(saldo) : saldo.toFixed(2)
}

function StatusBadge({ saldo, unidad }: { saldo: number; unidad: string | null }) {
  const label = fmtSaldo(Number(saldo))
  const u = unidad ?? ""
  if (Number(saldo) <= 0) {
    return (
      <span className="text-xs px-2 py-1 rounded bg-agro-danger-fill text-agro-danger-text" style={{ fontWeight: 600 }}>
        Agotado
      </span>
    )
  }
  if (Number(saldo) < LOW_STOCK) {
    return (
      <span className="text-xs px-2 py-1 rounded bg-agro-warning-fill text-agro-warning-text" style={{ fontWeight: 600 }}>
        Bajo · {label} {u}
      </span>
    )
  }
  return (
    <span className="text-xs px-2 py-1 rounded bg-agro-success-fill text-agro-success-text" style={{ fontWeight: 600 }}>
      Disponible · {label} {u}
    </span>
  )
}

function TipoBadge({ tipo }: { tipo: TipoMovimiento }) {
  if (tipo === "entrada") {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-agro-success-fill text-agro-success-text">
        Entrada
      </span>
    )
  }
  if (tipo === "salida") {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-agro-danger-fill text-agro-danger-text">
        Salida
      </span>
    )
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
      Ajuste
    </span>
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
        <p className="text-xs text-muted-foreground">Cargando historial…</p>
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
      <h4 className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>
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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-30"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-card overflow-y-auto"
        style={{
          height: "85%",
          borderRadius: "0.625rem 0.625rem 0 0",
          maxWidth: 390,
          margin: "0 auto",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
            Registrar movimiento
          </h2>
          <button onClick={onClose} className="p-1">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-4 pb-8">
          {/* Tipo */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block" style={{ fontWeight: 600 }}>
              Tipo de movimiento
            </label>
            <div className="flex gap-2">
              {tipos.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setForm((prev) => ({ ...prev, tipo: t.value }))}
                  className={`flex-1 h-10 rounded-full transition-all text-sm ${
                    form.tipo === t.value
                      ? "bg-primary text-white"
                      : "bg-card border border-border text-foreground"
                  }`}
                  style={{ fontWeight: 600 }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Producto */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block" style={{ fontWeight: 600 }}>
              Producto
            </label>
            <ProductoCombobox
              productos={productos}
              value={form.productoId}
              onSelect={(id) => setForm((prev) => ({ ...prev, productoId: id }))}
            />
          </div>

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

          <FormField
            label="Referencia (opcional)"
            value={form.referencia}
            onChange={set("referencia")}
            placeholder="Ej: Factura 1234"
          />

          <FormField
            label="Notas (opcional)"
            value={form.notas}
            onChange={set("notas")}
          />

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-14 bg-primary text-white rounded-xl disabled:opacity-50 hover:bg-agro-blue transition-colors"
            style={{ fontWeight: 600 }}
          >
            {saving ? "Guardando…" : "Guardar movimiento"}
          </button>
        </div>
      </div>
    </>
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

  const [vista, setVista] = useState<Vista>("rancho")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("Todos")
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [historialCache, setHistorialCache] = useState<Record<string, MovimientoConRancho[]>>({})
  const [loadingHistorial, setLoadingHistorial] = useState<string | null>(null)
  const [showSheet, setShowSheet] = useState(false)

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

  return (
    <div className="min-h-full pb-safe-nav">
      <header className="bg-card border-b border-border px-4 py-4">
        <h1 className="text-foreground" style={{ fontWeight: 600 }}>
          Inventario de Plaguicidas
        </h1>

        {/* Toggle vista */}
        <div className="flex gap-1 mt-3 bg-muted p-1 rounded-lg">
          {(["rancho", "productor"] as Vista[]).map((v) => (
            <button
              key={v}
              onClick={() => handleVistaChange(v)}
              className={`flex-1 h-8 rounded-md text-sm transition-all ${
                vista === v
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
              style={{ fontWeight: 600 }}
            >
              {v === "rancho" ? `Por ${terminosSitio.singular.toLowerCase()}` : "Por productor"}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o ingrediente…"
            className="w-full h-12 pl-12 pr-4 rounded-lg border border-border bg-input-background
              focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Filtros por categoría */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`flex-shrink-0 px-4 h-9 rounded-full transition-all whitespace-nowrap text-sm ${
                activeFilter === cat
                  ? "bg-primary text-white"
                  : "bg-card border border-border text-foreground"
              }`}
              style={{ fontWeight: 600 }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Estado de carga / error */}
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Cargando inventario…
          </p>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-agro-danger-fill text-agro-danger-text text-sm">
            {error}
          </div>
        )}

        {/* Lista */}
        {!loading && !error && (
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchQuery ? "Sin resultados para esta búsqueda." : "Sin productos en inventario."}
              </p>
            ) : vista === "rancho" ? (
              (filtered as InventarioSaldoRancho[]).map((item) => {
                const key = `${item.rancho_id}||${item.producto_id}`
                const expanded = expandedKey === key
                return (
                  <div key={key} className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-sm truncate" style={{ fontWeight: 600 }}>
                            {item.nombre_comercial}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.ingrediente_activo}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.rancho_nombre}
                          </div>
                        </div>
                        <StatusBadge saldo={Number(item.saldo)} unidad={item.unidad} />
                      </div>
                      {item.ultimo_movimiento && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Último mov.: {item.ultimo_movimiento}
                        </div>
                      )}
                      <button
                        onClick={() => toggleHistorial(key, item.producto_id, item.rancho_id)}
                        className="mt-2 flex items-center gap-1 text-sm text-primary"
                        style={{ fontWeight: 600 }}
                      >
                        {expanded ? (
                          <><ChevronUp className="w-4 h-4" />Ocultar historial</>
                        ) : (
                          <><ChevronDown className="w-4 h-4" />Ver historial</>
                        )}
                      </button>
                    </div>
                    {expanded && (
                      <HistorialInline
                        movimientos={historialCache[key] ?? []}
                        loading={loadingHistorial === key}
                        ranchoVisible={false}
                      />
                    )}
                  </div>
                )
              })
            ) : (
              (filtered as InventarioSaldoProductor[]).map((item) => {
                const key = item.producto_id
                const expanded = expandedKey === key
                return (
                  <div key={key} className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-sm truncate" style={{ fontWeight: 600 }}>
                            {item.nombre_comercial}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.ingrediente_activo}
                          </div>
                        </div>
                        <StatusBadge saldo={Number(item.saldo)} unidad={item.unidad} />
                      </div>
                      {item.ultimo_movimiento && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Último mov.: {item.ultimo_movimiento}
                        </div>
                      )}
                      <button
                        onClick={() => toggleHistorial(key, item.producto_id)}
                        className="mt-2 flex items-center gap-1 text-sm text-primary"
                        style={{ fontWeight: 600 }}
                      >
                        {expanded ? (
                          <><ChevronUp className="w-4 h-4" />Ocultar historial</>
                        ) : (
                          <><ChevronDown className="w-4 h-4" />Ver historial</>
                        )}
                      </button>
                    </div>
                    {expanded && (
                      <HistorialInline
                        movimientos={historialCache[key] ?? []}
                        loading={loadingHistorial === key}
                        ranchoVisible
                      />
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* FAB — mismo ancla que el bottom-nav para quedar dentro del contenedor de 390px */}
      <div className="fixed bottom-safe-fab left-1/2 -translate-x-1/2 w-full max-w-[390px] flex justify-end px-4 pointer-events-none z-10">
        <button
          onClick={() => setShowSheet(true)}
          className="pointer-events-auto w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-agro-blue transition-colors"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>

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
    </div>
  )
}
