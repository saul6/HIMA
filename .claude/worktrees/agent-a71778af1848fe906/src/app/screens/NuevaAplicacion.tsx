import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuthContext } from "@/context/AuthContext";
import { useRanchos } from "@/hooks/useRanchos";
import { crearAplicacion, insertarProductosAplicacion, registrarSalidasAplicacion } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { generarAplicacionPDF } from "@/lib/pdf/generarPDF";
import type {
  AplicacionInsert,
  AplicacionProductoInsert,
  CategoriaProducto,
  CondicionMeteorologica,
  Fenologia,
  NivelInfestacion,
  TipoEquipo,
  UnidadProducto,
} from "@/types/database.types";
import { Step1ParcelaYCultivo } from "../components/nueva-aplicacion/Step1ParcelaYCultivo";
import { Step2Productos } from "../components/nueva-aplicacion/Step2Productos";
import { Step3AplicacionYAgua } from "../components/nueva-aplicacion/Step3AplicacionYAgua";
import { Step4CierreYObservaciones } from "../components/nueva-aplicacion/Step4CierreYObservaciones";

// Redondea a máximo 4 decimales (evita notación científica y floats infinitos en BD y PDF)
const r4 = (n: number) => parseFloat(n.toFixed(4));

export function NuevaAplicacion() {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { profile, productor, asesorProfile, responsableProfile, user } = useAuthContext();
  const { ranchos } = useRanchos();
  const [productosEnInventario, setProductosEnInventario] = useState<string[]>([])

  const [formData, setFormData] = useState({
    // Step 1
    producer: profile?.nombre_completo ?? "",
    huerto: "",
    huertoCode: "",
    crop: "",
    variety: "",
    sector: "",
    surface: "",
    phenology: "",
    recommendationDate: "",
    applicationDate: "",
    startTime: "",
    endTime: "",
    // Step 2
    products: [] as any[],
    // Step 3
    applicationType: "Foliar",
    equipment: "",
    totalWater: "",
    chlorination: false,
    chlorineQuantity: "",
    pH: "",
    weather: "",
    ppe: {
      "Traje protector": true,
      "Guantes": true,
      "Googles": true,
      "Botas": true,
      "Mascarillas": true,
    },
    // Step 4
    leftover: true,
    leftoverQuantity: "1",
    washWater: "1",
    eliminatedDesignatedArea: true,
    applicators: "",
    technicalAdvisor: asesorProfile?.nombre_completo ?? "",
    inocuidadResponsible: responsableProfile?.nombre_completo ?? "",
    observations: "",
  });

  // Sincroniza los datos del perfil si el contexto de auth termina de cargar
  // después del primer render (caso edge: carga lenta de perfil)
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      producer: profile?.nombre_completo ?? prev.producer,
      technicalAdvisor: asesorProfile?.nombre_completo ?? prev.technicalAdvisor,
      inocuidadResponsible: responsableProfile?.nombre_completo ?? prev.inocuidadResponsible,
    }));
  }, [profile, asesorProfile, responsableProfile]);

  // Carga los IDs de productos con saldo > 0 para el rancho seleccionado
  useEffect(() => {
    if (!formData.huerto) {
      setProductosEnInventario([])
      return
    }
    supabase
      .from('v_inventario_saldo_rancho')
      .select('producto_id')
      .eq('rancho_id', formData.huerto)
      .gt('saldo', 0)
      .then(({ data }) => {
        setProductosEnInventario((data ?? []).map((r) => r.producto_id as string))
      })
      .catch(() => { /* silently ignore — no bloquea el flujo */ })
  }, [formData.huerto])

  const updateFormData = (data: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // Alerta si la fecha de aplicación supera 7 días desde la recomendación del asesor
  const alertaFechaVencida = useMemo(() => {
    if (!formData.recommendationDate || !formData.applicationDate) return false;
    const recomendacion = new Date(formData.recommendationDate);
    const aplicacion = new Date(formData.applicationDate);
    const diferenciaDias =
      (aplicacion.getTime() - recomendacion.getTime()) / (1000 * 60 * 60 * 24);
    return diferenciaDias > 7;
  }, [formData.recommendationDate, formData.applicationDate]);

  const handleSave = async () => {
    // Validaciones de campos requeridos en BD
    if (!productor) {
      toast.error("No se encontró el productor asociado a tu cuenta");
      return;
    }
    if (!formData.huerto) {
      toast.error("Selecciona un huerto antes de guardar");
      setCurrentStep(1);
      return;
    }
    if (!formData.applicationDate) {
      toast.error("La fecha de aplicación es requerida");
      setCurrentStep(1);
      return;
    }

    setSaving(true);
    try {
      // ── Paso 1: crear la aplicación ──────────────────────────────────────
      const datosAplicacion: AplicacionInsert = {
        productor_id: productor.id,
        rancho_id: formData.huerto,
        variedad: formData.variety || null,
        sector: formData.sector || null,
        superficie_ha: formData.surface ? parseFloat(formData.surface) : null,
        fenologia: (formData.phenology || null) as Fenologia | null,
        fecha_recomendacion: formData.recommendationDate || null,
        fecha_aplicacion: formData.applicationDate,
        hora_inicio: formData.startTime || null,
        hora_fin: formData.endTime || null,
        tipo_aplicacion: formData.applicationType as "Foliar" | "Drench",
        equipo: (formData.equipment || null) as TipoEquipo | null,
        total_agua_l: formData.totalWater ? parseFloat(formData.totalWater) : null,
        cloracion: formData.chlorination,
        // cloro_cantidad_l almacena el valor en ml: 5 × (total_agua_l / 200), 4 decimales
        cloro_cantidad_l: (() => {
          const agua = formData.totalWater ? parseFloat(formData.totalWater) : 0
          return formData.chlorination && agua > 0 ? r4(5 * (agua / 200)) : null
        })(),
        cloro_ph: formData.pH ? parseFloat(formData.pH) : null,
        condicion_meteorologica: (formData.weather || null) as CondicionMeteorologica | null,
        epp_traje: formData.ppe["Traje protector"],
        epp_guantes: formData.ppe["Guantes"],
        epp_googles: formData.ppe["Googles"],
        epp_botas: formData.ppe["Botas"],
        epp_mascarillas: formData.ppe["Mascarillas"],
        caldos_sobrantes: formData.leftover,
        caldos_cantidad_l: formData.leftoverQuantity ? parseFloat(formData.leftoverQuantity) : null,
        caldos_agua_lavado_l: formData.washWater ? parseFloat(formData.washWater) : null,
        caldos_area_designada: formData.leftover ? formData.eliminatedDesignatedArea : null,
        aplicadores: formData.applicators || null,
        asesor_id: productor.asesor_id,
        responsable_inocuidad_id: productor.responsable_inocuidad_id,
        observaciones: formData.observations || null,
        status: "completado",
        org_id: profile!.org_id!,
      };

      const aplicacion = await crearAplicacion(datosAplicacion);

      // ── Paso 2: insertar los productos de la aplicación ──────────────────
      // Recalcular dosis_200l y total_producto con los valores finales del formulario
      // para garantizar consistencia aunque el usuario haya cambiado agua/superficie.
      if (formData.products.length > 0) {
        const totalAguaFinal = formData.totalWater ? parseFloat(formData.totalWater) : 0
        const superficieFinal = formData.surface ? parseFloat(formData.surface) : 0

        const productos: Omit<AplicacionProductoInsert, "aplicacion_id">[] =
          formData.products.map((p: any) => {
            const dosisHa = p.dosePerHa ? parseFloat(p.dosePerHa) : null
            const totalProducto = dosisHa && superficieFinal > 0
              ? r4(dosisHa * superficieFinal)
              : null
            const dosisBarril = dosisHa && superficieFinal > 0 && totalAguaFinal > 0
              ? r4((dosisHa / (totalAguaFinal / 200)) * superficieFinal)
              : null
            return {
              producto_id: p.productId as string,
              plaga_objetivo: p.pest || null,
              nivel_infestacion: (p.infestationLevel || null) as NivelInfestacion | null,
              dosis_ha: dosisHa,
              dosis_200l: dosisBarril,
              total_producto: totalProducto,
              dias_cosecha: p.daysToHarvest ? parseInt(p.daysToHarvest, 10) : null,
              reentrada_hrs: p.reentryTime ? parseInt(p.reentryTime, 10) : null,
            }
          });

        await insertarProductosAplicacion(aplicacion.id, productos, profile!.org_id!);
      }

      // ── Paso 3: registrar salidas de inventario (fire-and-forget) ────────
      // total_producto recalculado con superficie final
      const superficieFinalInv = formData.surface ? parseFloat(formData.surface) : 0
      if (formData.products.length > 0 && user) {
        registrarSalidasAplicacion(
          aplicacion.id,
          formData.huerto,
          formData.products.map((p: any) => ({
            productId: p.productId as string,
            totalProduct: superficieFinalInv > 0 && p.dosePerHa
              ? String(parseFloat(p.dosePerHa) * superficieFinalInv)
              : p.totalProduct as string,
          })),
          user.id,
          formData.applicationDate,
          profile!.org_id!,
        ).catch((err) => console.warn('[inv] auto-salida:', err))
      }

      // ── Paso 4: generar PDF (no bloquea el guardado si falla) ────────────
      const ranchoSeleccionado = ranchos.find((r) => r.id === formData.huerto)
      if (ranchoSeleccionado && profile) {
        const aguaPDF = formData.totalWater ? parseFloat(formData.totalWater) : 0
        const supPDF = formData.surface ? parseFloat(formData.surface) : 0

        const productosParaPDF = formData.products.map((p: any) => {
          const dosisHa = p.dosePerHa ? parseFloat(p.dosePerHa) : null
          const totalProducto = dosisHa && supPDF > 0 ? r4(dosisHa * supPDF) : null
          const dosisBarril = dosisHa && supPDF > 0 && aguaPDF > 0
            ? r4((dosisHa / (aguaPDF / 200)) * supPDF)
            : null
          return {
            id: crypto.randomUUID(),
            aplicacion_id: aplicacion.id,
            producto_id: p.productId as string,
            plaga_objetivo: p.pest || null,
            nivel_infestacion: (p.infestationLevel || null) as NivelInfestacion | null,
            dosis_ha: dosisHa,
            dosis_200l: dosisBarril,
            total_producto: totalProducto,
            dias_cosecha: p.daysToHarvest ? parseInt(p.daysToHarvest, 10) : null,
            reentrada_hrs: p.reentryTime ? parseInt(p.reentryTime, 10) : null,
            created_at: new Date().toISOString(),
            catalogo_productos: {
              id: p.productId as string,
              nombre_comercial: p.commercialName as string,
              ingrediente_activo: p.activeIngredient as string,
              rsco: p.rsco || null,
              categoria: 'Fungicidas' as CategoriaProducto,
              dias_cosecha: p.daysToHarvest ? parseInt(p.daysToHarvest, 10) : null,
              reentrada_hrs: p.reentryTime ? parseInt(p.reentryTime, 10) : null,
              dosis_ha: dosisHa,
              dosis_200l: dosisBarril,
              unidad: 'kg' as UnidadProducto,
              activo: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          }
        })

        try {
          await generarAplicacionPDF({
            aplicacion,
            productos: productosParaPDF,
            rancho: ranchoSeleccionado,
            asesor: asesorProfile,
            responsable: responsableProfile,
            operario: profile,
            operarioEmail: user?.email,
          })
        } catch {
          toast.warning("Registro guardado. No se pudo generar el PDF — descárgalo desde el historial.")
        }
      }

      toast.success("Aplicación guardada correctamente");
      navigate("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar la aplicación";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full pb-safe-nav">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-1">
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-foreground" style={{ fontWeight: 600 }}>Nueva Aplicación</h1>
        </div>

        {/* Indicador de paso */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {[1, 2, 3, 4].map((step) => (
            <button
              key={step}
              onClick={() => setCurrentStep(step)}
              className={`w-3 h-3 rounded-full transition-colors ${
                step === currentStep
                  ? "bg-primary"
                  : step < currentStep
                  ? "bg-primary/40"
                  : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Banner: alerta cuando la aplicación supera 7 días desde la recomendación */}
      {alertaFechaVencida && (
        <div className="mx-4 mt-3 mb-1 p-3 rounded-xl flex items-start gap-2 bg-agro-warning-fill">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-agro-warning-text" />
          <p className="text-sm text-agro-warning-text">
            La fecha de aplicación supera por más de 7 días la recomendación del asesor.
            Verifica con{" "}
            <span style={{ fontWeight: 600 }}>{formData.technicalAdvisor}</span> antes de continuar.
          </p>
        </div>
      )}

      {/* Pasos del formulario */}
      <div className="p-4">
        {currentStep === 1 && (
          <Step1ParcelaYCultivo
            formData={formData}
            updateFormData={updateFormData}
            onNext={nextStep}
          />
        )}
        {currentStep === 2 && (
          <Step2Productos
            formData={formData}
            updateFormData={updateFormData}
            onNext={nextStep}
            onBack={prevStep}
            productosEnInventario={productosEnInventario}
          />
        )}
        {currentStep === 3 && (
          <Step3AplicacionYAgua
            formData={formData}
            updateFormData={updateFormData}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}
        {currentStep === 4 && (
          <Step4CierreYObservaciones
            formData={formData}
            updateFormData={updateFormData}
            onSave={handleSave}
            onBack={prevStep}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}
