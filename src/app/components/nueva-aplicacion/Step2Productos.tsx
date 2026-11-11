import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CampoTexto, CampoSelect, SeccionPaso, Fila, PiePaso, EtiquetaGrupo } from "./controles";
import { ProductoCombobox } from "./ProductoCombobox";
import { useCatalogoProductos } from "@/hooks/useCatalogoProductos";
import { Boton } from '@/app/components/ui-mady/Boton'
import { AvisoCargaLenta } from '@/app/components/ui-mady/AvisoCargaLenta'
import { Campo } from '@/app/components/ui-mady/Campo'
import { SelectorSegmentado } from '@/app/components/ui-mady/SelectorSegmentado'
import { fechaHora } from '@/lib/formato'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DUR, EASE_OUT } from '@/lib/motion'

interface Props {
  formData: any;
  updateFormData: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
  productosEnInventario?: string[]
  /** Marca de tiempo del saldo en caché (sin red); null cuando el saldo es en vivo */
  inventarioAl?: number | null
  /** Escritorio (≥ lg): acomodo en columnas y piezas estándar. */
  esLg?: boolean
}

const pestOptions = [
  { value: "botrytis", label: "Botrytis cinerea" },
  { value: "oidio", label: "Oidio" },
  { value: "trips", label: "Trips" },
  { value: "pulgon", label: "Pulgón" },
  { value: "arana", label: "Araña roja" },
  { value: "antracnosis", label: "Antracnosis" },
  { value: "otro", label: "Otro" },
];

const infestationLevels = ["Bajo", "Medio", "Alto"];

const emptyProduct = {
  productId: "",
  commercialName: "",
  activeIngredient: "",
  rsco: "",
  pest: "",
  infestationLevel: "",
  dosePerHa: "",
  dosePer200L: "",   // dosis por barril (auto-calculado)
  totalProduct: "",  // dosis total (auto-calculado)
  daysToHarvest: "",
  reentryTime: "",
};

// dosis_total = dosis_ha × superficie_ha
function calcularTotal(dosePerHa: string, surface: string): string {
  const dose = parseFloat(dosePerHa);
  const sup = parseFloat(surface);
  if (!dose || !sup || sup <= 0) return "";
  return (dose * sup).toFixed(4);
}

// dosis_por_barril = (dosis_ha / (total_agua_l / 200)) × superficie_ha
function calcularDosisBarril(dosePerHa: string, totalWater: string, surface: string): string {
  const dose = parseFloat(dosePerHa);
  const agua = parseFloat(totalWater);
  const sup = parseFloat(surface);
  if (!dose || !agua || !sup || agua <= 0 || sup <= 0) return "";
  return ((dose / (agua / 200)) * sup).toFixed(4);
}

export function Step2Productos({ formData, updateFormData, onNext, onBack, productosEnInventario, inventarioAl, esLg = false }: Props) {
  const { productos, loading: loadingCatalogo } = useCatalogoProductos();
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<typeof emptyProduct>({ ...emptyProduct });
  const reducedMotion = useReducedMotion();

  const handleProductSelect = (productId: string) => {
    const selected = productos.find((p) => p.id === productId);
    if (!selected) return;

    const dosePerHa = selected.dosis_ha?.toString() ?? "";
    setCurrentProduct({
      ...currentProduct,
      productId: selected.id,
      commercialName: selected.nombre_comercial,
      activeIngredient: selected.ingrediente_activo,
      rsco: selected.rsco ?? "",
      dosePerHa,
      dosePer200L: calcularDosisBarril(dosePerHa, formData.totalWater, formData.surface),
      totalProduct: calcularTotal(dosePerHa, formData.surface),
      daysToHarvest: selected.dias_cosecha?.toString() ?? "",
      reentryTime: selected.reentrada_hrs?.toString() ?? "",
    });
  };

  const handleDosePerHaChange = (value: string) => {
    setCurrentProduct((prev) => ({
      ...prev,
      dosePerHa: value,
      dosePer200L: calcularDosisBarril(value, formData.totalWater, formData.surface),
      totalProduct: calcularTotal(value, formData.surface),
    }));
  };

  const addProduct = () => {
    if (!currentProduct.productId) return;
    // `uid` solo identifica la fila en pantalla (key estable para la lista
    // animada) — no se guarda en BD, el insert mapea campos explícitos.
    updateFormData({ products: [...formData.products, { ...currentProduct, uid: crypto.randomUUID() }] });
    setCurrentProduct({ ...emptyProduct });
    setIsAddingProduct(false);
  };

  const removeProduct = (index: number) => {
    updateFormData({
      products: formData.products.filter((_: any, i: number) => i !== index),
    });
  };

  const selectorProducto = loadingCatalogo ? (
    <>
      <Skeleton className={esLg ? "h-10 w-full rounded-lg" : "h-11 w-full rounded-lg"} aria-busy="true" aria-label="Cargando catálogo" />
      <AvisoCargaLenta permitirRecargar={false} />
    </>
  ) : (
    <ProductoCombobox
      productos={productos}
      value={currentProduct.productId}
      onSelect={handleProductSelect}
      productosEnInventario={productosEnInventario}
    />
  )

  return (
    <div className={esLg ? "flex flex-col gap-5" : "flex flex-col gap-4"}>
      <SeccionPaso esLg={esLg} primera titulo="Productos aplicados" movil="PRODUCTOS APLICADOS" />

      {/* Lista de productos agregados */}
      {formData.products.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {formData.products.map((product: any, index: number) => {
              const barrilVivo = calcularDosisBarril(product.dosePerHa, formData.totalWater, formData.surface)
              const totalVivo = calcularTotal(product.dosePerHa, formData.surface)
              return (
                <motion.div
                  key={product.uid ?? index}
                  layout={!reducedMotion}
                  initial={reducedMotion ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: DUR.base, ease: EASE_OUT }}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm mb-1 font-semibold">
                        {product.commercialName}
                      </div>
                      <div className="text-xs text-muted-foreground">{product.activeIngredient}</div>
                    </div>
                    <button aria-label="Quitar"
                      onClick={() => removeProduct(index)}
                      className="p-1 text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span>Dosis/ha: {product.dosePerHa || '—'}</span>
                    <span>·</span>
                    <span>Barril: {barrilVivo || '—'}</span>
                    <span>·</span>
                    <span>Total: {totalVivo || '—'}</span>
                    {product.infestationLevel && (
                      <>
                        <span>·</span>
                        <span className="px-2 py-1 bg-muted rounded">{product.infestationLevel}</span>
                      </>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Formulario para agregar producto */}
      {isAddingProduct ? (
        <div className={esLg ? "border border-border-control rounded-xl p-4 flex flex-col gap-4" : "bg-card border-2 border-primary rounded-xl p-4 flex flex-col gap-4"}>
          <div>
            {esLg ? (
              <Campo etiqueta="Nombre comercial" className="gap-1.5">
                {() => selectorProducto}
              </Campo>
            ) : (
              <>
                <label className="text-xs text-muted-foreground mb-2 block font-semibold">
                  Nombre comercial
                </label>
                {selectorProducto}
              </>
            )}
            {inventarioAl != null && (
              <p className="text-xs text-muted-foreground mt-1">
                Saldo de inventario al {fechaHora(inventarioAl)} (incluye salidas sin subir)
              </p>
            )}
          </div>

          <Fila esLg={esLg}>
            <CampoTexto esLg={esLg} label="Ingrediente activo" value={currentProduct.activeIngredient} onChange={() => {}} disabled />
            <CampoTexto esLg={esLg} label="Número RSCO/COFEPRIS" value={currentProduct.rsco} onChange={() => {}} disabled />
          </Fila>

          <Fila esLg={esLg}>
            <CampoSelect
              esLg={esLg}
              label="Justificación / Plaga"
              value={currentProduct.pest}
              onChange={(value) => setCurrentProduct((prev) => ({ ...prev, pest: value }))}
              options={pestOptions}
            />

            {/* Nivel de infestación */}
            <div>
              {esLg ? (
                <>
                  <EtiquetaGrupo>Nivel de infestación</EtiquetaGrupo>
                  <SelectorSegmentado
                    ariaLabel="Nivel de infestación"
                    value={currentProduct.infestationLevel}
                    onChange={(level) => setCurrentProduct((prev) => ({ ...prev, infestationLevel: level }))}
                    options={infestationLevels.map((level) => ({ value: level, label: level }))}
                  />
                </>
              ) : (
                <>
                  <label className="text-xs text-muted-foreground mb-2 block font-semibold">
                    Nivel de infestación
                  </label>
                  <div className="flex gap-2">
                    {infestationLevels.map((level) => (
                      <button
                        key={level}
                        onClick={() => setCurrentProduct((prev) => ({ ...prev, infestationLevel: level }))}
                        className={`flex-1 h-10 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] ${
                          currentProduct.infestationLevel === level
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border border-border text-foreground"
                        }`}
                        style={{ fontWeight: 600 }}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Fila>

          {/* Dosis por ha (editable); dosis por barril y total (auto-calculadas) */}
          <Fila esLg={esLg} cols={3}>
            <CampoTexto esLg={esLg} label="Dosis por ha" type="number" value={currentProduct.dosePerHa} onChange={handleDosePerHaChange} placeholder="kg/ha" />
            <div className="grid grid-cols-2 gap-3 lg:contents">
              <CampoTexto
                esLg={esLg}
                label="Dosis por barril (200 L)"
                value={currentProduct.dosePer200L || (formData.totalWater ? '—' : 'Agrega agua (paso 3)')}
                onChange={() => {}}
                disabled
              />
              <CampoTexto esLg={esLg} label="Dosis total" value={currentProduct.totalProduct || '—'} onChange={() => {}} disabled />
            </div>
          </Fila>

          <Fila esLg={esLg} movil2>
            <CampoTexto esLg={esLg} label="Días a cosecha" type="number" value={currentProduct.daysToHarvest} onChange={(value) => setCurrentProduct((prev) => ({ ...prev, daysToHarvest: value }))} />
            <CampoTexto esLg={esLg} label="Tiempo reentrada (hrs)" type="number" value={currentProduct.reentryTime} onChange={(value) => setCurrentProduct((prev) => ({ ...prev, reentryTime: value }))} />
          </Fila>

          <div className={esLg ? "flex justify-end gap-3" : "flex gap-2"}>
            <Boton variante="secundario" onClick={() => {
                setCurrentProduct({ ...emptyProduct });
                setIsAddingProduct(false);
              }} className={esLg ? undefined : "flex-1 h-12 rounded-xl"}>
              Cancelar
            </Boton>
            <Boton
              onClick={addProduct}
              disabled={!currentProduct.productId}
              className={esLg ? undefined : "flex-1 h-14 rounded-3xl"}
            >
              Agregar
            </Boton>
          </div>
        </div>
      ) : esLg ? (
        <Boton variante="secundario" onClick={() => setIsAddingProduct(true)} className="self-start">
          <Plus className="w-4 h-4" />
          Agregar producto
        </Boton>
      ) : (
        <button
          onClick={() => setIsAddingProduct(true)}
          className="w-full h-14 border-2 border-dashed border-primary text-primary rounded-xl flex items-center justify-center gap-2 hover:bg-agro-success-fill transition-colors font-semibold"
        >
          <Plus className="w-5 h-5" />
          Agregar producto
        </button>
      )}

      {/* Botones de navegación */}
      {esLg ? (
        <PiePaso onBack={onBack} onNext={onNext} deshabilitado={formData.products.length === 0} />
      ) : (
        <div className="flex gap-3 pt-4">
          <button
            onClick={onBack}
            className="flex-1 h-14 border border-border text-foreground rounded-3xl font-semibold"
          >
            Atrás
          </button>
          <Boton
            onClick={onNext}
            disabled={formData.products.length === 0}
            className="flex-1"
          >
            Continuar
          </Boton>
        </div>
      )}
    </div>
  );
}
