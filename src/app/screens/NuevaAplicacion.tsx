import { useState, useMemo, useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { EncabezadoPantalla } from "@/app/components/EncabezadoPantalla";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuthContext } from "@/context/AuthContext";
import { useModulosContext } from "@/context/ModulosContext";
import { useRanchos } from "@/hooks/useRanchos";
import { crearAplicacion, insertarProductosAplicacion } from "@/lib/queries";
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
import { useContextoTarea } from '@/hooks/useContextoTarea'
import { BannerTareaOrigen } from '@/app/components/BannerTareaOrigen'
import { useFirmaContext } from '@/context/FirmaContext'
import { PasoFirmaRegistro } from '@/app/components/PasoFirmaRegistro'
import { SPRING_SUAVE, SPRING_SUAVE_SIN_REBOTE } from '@/lib/motion'
import { marcarCapturaEnCurso } from '@/lib/offline/actualizacionSegura'
import { useConexion } from '@/hooks/useConexion'
import { useGuardarOffline } from '@/hooks/useGuardarOffline'
import { opInsert } from '@/lib/offline/construirOperaciones'
import { leerSaldosInventarioCache, deltaPendienteInventario } from '@/lib/offline/saldosInventario'
import type { Aplicacion } from '@/types/database.types'
import { Boton } from '@/app/components/ui-mady/Boton'

// Redondea a máximo 4 decimales (evita notación científica y floats infinitos en BD y PDF)
const r4 = (n: number) => parseFloat(n.toFixed(4));

// Mismo timing/curva que el resto de la app (ver Layout.tsx) — constante
// local para no repetir el array de easing en cada transición de este archivo.
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const PASOS_NOMBRE = ["Parcela y cultivo", "Productos", "Aplicación y agua", "Cierre"] as const
const STEP_TRANSITION = { duration: 0.22, ease: EASE_OUT };

export function NuevaAplicacion() {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  // Dirección de la transición entre pasos — compara contra el paso anterior
  // para decidir si el contenido entra desde la derecha (avanzar) o la
  // izquierda (retroceder), incluyendo saltos directos al hacer clic en un punto.
  const pasoAnteriorRef = useRef(currentStep);
  const [direccion, setDireccion] = useState<1 | -1>(1);
  useEffect(() => {
    if (currentStep !== pasoAnteriorRef.current) {
      setDireccion(currentStep > pasoAnteriorRef.current ? 1 : -1);
      pasoAnteriorRef.current = currentStep;
    }
  }, [currentStep]);
  const { profile, productor, asesorProfile, responsableProfile, user } = useAuthContext();
  const { terminosSitio } = useModulosContext();
  const esCampo = terminosSitio.singular === 'Rancho';
  const { ranchos } = useRanchos();
  const { ranchoInicial, tareaId } = useContextoTarea(ranchos)
  const [productosEnInventario, setProductosEnInventario] = useState<string[]>([])
  const [inventarioAl, setInventarioAl] = useState<number | null>(null)
  const { online } = useConexion()
  const { guardar: guardarOffline } = useGuardarOffline('M1')
  const { obligatoria } = useFirmaContext()
  const [aplicacionGuardada, setAplicacionGuardada] = useState<{
    id: string
    pdfProps: Parameters<typeof generarAplicacionPDF>[0] | null
    ranchoNombre: string
    pendiente?: boolean
  } | null>(null)

  const [formData, setFormData] = useState({
    // Step 1
    producer: profile?.nombre_completo ?? "",
    huerto: "",
    huertoCode: "",
    crop: "",
    productorId: "",
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
    // GlobalG.A.P. (solo sector Campo)
    proximaCosecha: "",
    metodoAplicacionGg: "",
  });

  // Bloquea actualización automática del SW mientras el formulario esté abierto
  useEffect(() => {
    marcarCapturaEnCurso(true)
    return () => marcarCapturaEnCurso(false)
  }, [])

  // Preselecciona rancho si se viene desde una tarea de agenda
  useEffect(() => {
    if (ranchoInicial && !formData.huerto) {
      setFormData((prev) => ({ ...prev, huerto: ranchoInicial }))
    }
  }, [ranchoInicial]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Carga los IDs de productos con saldo > 0 para el rancho seleccionado.
  // Sin red usa el último saldo en caché (se muestra como "al {fecha}").
  useEffect(() => {
    if (!formData.huerto) {
      setProductosEnInventario([])
      setInventarioAl(null)
      return
    }
    let activo = true
    const desdeCache = async () => {
      if (!user?.id || !profile?.org_id) return
      try {
        const r = await leerSaldosInventarioCache(user.id, profile.org_id)
        const delta = await deltaPendienteInventario(user.id)
        if (!activo) return
        setProductosEnInventario(
          r.datos
            .filter((f) => f.rancho_id === formData.huerto && f.saldo + (delta.get(`${f.rancho_id}|${f.producto_id}`) ?? 0) > 0)
            .map((f) => f.producto_id),
        )
        setInventarioAl(r.guardadoEn)
      } catch { /* sin caché: no bloquea el flujo */ }
    }
    if (!navigator.onLine) {
      desdeCache()
      return () => { activo = false }
    }
    setInventarioAl(null)
    supabase
      .from('v_inventario_saldo_rancho')
      .select('producto_id')
      .eq('rancho_id', formData.huerto)
      .gt('saldo', 0)
      .then(({ data, error }) => {
        if (!activo) return
        if (error) { desdeCache(); return }
        setProductosEnInventario((data ?? []).map((r) => r.producto_id as string))
      })
      .catch(() => { desdeCache() })
    return () => { activo = false }
  }, [formData.huerto, user?.id, profile?.org_id])

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

  // Productos de la aplicación con los cálculos finales (r4) a partir del formulario.
  const armarProductos = (): Omit<AplicacionProductoInsert, "aplicacion_id">[] => {
    const totalAguaFinal = formData.totalWater ? parseFloat(formData.totalWater) : 0
    const superficieFinal = formData.surface ? parseFloat(formData.surface) : 0
    return formData.products.map((p: any) => {
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
    })
  }

  // Salidas de inventario: total_producto recalculado con la superficie final.
  const salidasInventario = () => {
    const superficieFinalInv = formData.surface ? parseFloat(formData.surface) : 0
    return formData.products.map((p: any) => ({
      productId: p.productId as string,
      totalProduct: superficieFinalInv > 0 && p.dosePerHa
        ? String(parseFloat(p.dosePerHa) * superficieFinalInv)
        : p.totalProduct as string,
    }))
  }

  // Props del PDF; con pendienteSync imprime "Pendiente de sincronizar" en el pie.
  const construirPdfProps = (aplicacion: Aplicacion, pendienteSync: boolean) => {
    const ranchoSeleccionado = ranchos.find((r) => r.id === formData.huerto)
    if (!ranchoSeleccionado || !profile) return null
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

    return {
      aplicacion,
      productos: productosParaPDF,
      rancho: ranchoSeleccionado,
      asesor: asesorProfile,
      responsable: responsableProfile,
      operario: profile,
      operarioEmail: user?.email,
      esCampo,
      ...(pendienteSync ? { pendienteSync: true } : {}),
    } as Parameters<typeof generarAplicacionPDF>[0]
  }

  const datosAplicacionDesdeForm = (): Omit<AplicacionInsert, 'org_id'> => ({
    productor_id: formData.productorId || null,
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
    cloracion: esCampo && formData.metodoAplicacionGg === 'Cloro' ? true : formData.chlorination,
    // cloro_cantidad_l almacena el valor en ml: 5 × (total_agua_l / 200), 4 decimales
    cloro_cantidad_l: (() => {
      const agua = formData.totalWater ? parseFloat(formData.totalWater) : 0
      const cloracionEfectiva = esCampo && formData.metodoAplicacionGg === 'Cloro' ? true : formData.chlorination
      return cloracionEfectiva && agua > 0 ? r4(5 * (agua / 200)) : null
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
    asesor_id: productor?.asesor_id ?? null,
    responsable_inocuidad_id: productor?.responsable_inocuidad_id ?? null,
    observaciones: formData.observations || null,
    proxima_cosecha: esCampo && formData.proximaCosecha ? formData.proximaCosecha : null,
    metodo_aplicacion_gg: esCampo ? (formData.metodoAplicacionGg || null) : null,
    status: "completado",
  })

  // Sin red: un solo lote con la aplicación, sus productos y las salidas de inventario.
  const guardarSinConexion = async () => {
    const aplicacionId = crypto.randomUUID()
    // productor_id lo toma la BD del rancho; org_id y creado_por los pone el servidor
    const { productor_id: _prod, ...datosSinProductor } = datosAplicacionDesdeForm()
    const ranchoSel = ranchos.find((r) => r.id === formData.huerto)

    // Saldo estimado para la columna balance (NOT NULL): caché + movimientos pendientes.
    // El saldo real siempre se suma de `cantidad`, así que esto es solo informativo.
    const saldoBase = new Map<string, number>()
    try {
      const cache = await leerSaldosInventarioCache(user!.id, profile!.org_id!)
      for (const f of cache.datos) saldoBase.set(`${f.rancho_id}|${f.producto_id}`, f.saldo)
    } catch { /* sin caché: parte de 0 */ }
    const delta = await deltaPendienteInventario(user!.id).catch(() => new Map<string, number>())

    const operaciones = [
      opInsert('aplicaciones', { ...datosSinProductor, id: aplicacionId }),
      ...armarProductos().map((pr) => opInsert('aplicacion_productos', { ...pr, aplicacion_id: aplicacionId })),
    ]
    for (const sal of salidasInventario()) {
      const cantidad = parseFloat(sal.totalProduct)
      if (!cantidad || cantidad <= 0) continue
      const k = `${formData.huerto}|${sal.productId}`
      const balance = r4((saldoBase.get(k) ?? 0) + (delta.get(k) ?? 0) - cantidad)
      operaciones.push(opInsert('inventario_movimientos', {
        rancho_id: formData.huerto,
        producto_id: sal.productId,
        tipo: 'salida',
        cantidad,
        balance,
        aplicacion_id: aplicacionId,
        fecha: formData.applicationDate,
        registrado_por: user!.id,
      }))
    }

    const ok = await guardarOffline({
      descripcion: `Nueva Aplicación · ${formData.applicationDate} · ${ranchoSel?.nombre ?? ''}`,
      metadatos: { rancho_id: formData.huerto, rancho_nombre: ranchoSel?.nombre, fecha: formData.applicationDate },
      operaciones,
    })
    if (!ok) return

    const ahora = new Date().toISOString()
    const aplicacionLocal = {
      ...datosSinProductor,
      id: aplicacionId,
      productor_id: formData.productorId,
      org_id: profile!.org_id!,
      creado_por: user!.id,
      created_at: ahora,
      updated_at: ahora,
      requiere_correccion: false,
      comentario_correccion: null,
      marcado_por: null,
      marcado_en: null,
    } as unknown as Aplicacion
    setAplicacionGuardada({
      id: aplicacionId,
      pdfProps: construirPdfProps(aplicacionLocal, true),
      ranchoNombre: ranchoSel?.nombre ?? '—',
      pendiente: true,
    })
    setCurrentStep(5)
  }

  const handleSave = async () => {
    // Validaciones de campos requeridos en BD
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

    // Sin cantidad total el inventario no se descuenta
    const sinCantidad = armarProductos().findIndex((pr) => !pr.total_producto || pr.total_producto <= 0)
    if (sinCantidad >= 0) {
      const p: any = formData.products[sinCantidad]
      toast.error(`Falta la cantidad total de ${p.commercialName || 'un producto'}`);
      setCurrentStep(2);
      return;
    }

    setSaving(true);
    try {
      if (!online) {
        await guardarSinConexion();
        return;
      }

      // ── Paso 1: crear la aplicación ──────────────────────────────────────
      const datosAplicacion: AplicacionInsert = {
        ...datosAplicacionDesdeForm(),
        org_id: profile!.org_id!,
      };

      const aplicacion = await crearAplicacion(datosAplicacion);

      // ── Paso 2: insertar los productos de la aplicación ──────────────────
      // Recalcular dosis_200l y total_producto con los valores finales del formulario
      // para garantizar consistencia aunque el usuario haya cambiado agua/superficie.
      if (formData.products.length > 0) {
        await insertarProductosAplicacion(aplicacion.id, armarProductos(), profile!.org_id!);
      }

      // La salida de inventario la registra la BD (trigger sobre aplicacion_productos).

      // ── Paso 3: preparar props del PDF y pasar a firma ────────────────────
      const ranchoSeleccionado = ranchos.find((r) => r.id === formData.huerto)
      const pdfProps = construirPdfProps(aplicacion, false)

      toast.success("Aplicación guardada correctamente");
      setAplicacionGuardada({
        id: aplicacion.id,
        pdfProps,
        ranchoNombre: ranchoSeleccionado?.nombre ?? '—',
      })
      setCurrentStep(5);
    } catch (err: unknown) {
      console.error('[NuevaAplicacion] error al guardar:', err);
      const msg = err instanceof Error ? err.message : "Error al guardar la aplicación";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full pb-safe-nav">
      {/* Header */}
      <EncabezadoPantalla
        titulo="Nueva Aplicación"
        alRegresar={() => navigate("/")}
        debajoCentrado
        debajo={
        <div className="flex flex-col items-center gap-2">
          <div className="relative inline-flex items-center gap-2">
            {/* Línea de fondo */}
            <div className="absolute left-[6px] right-[6px] top-1/2 -translate-y-1/2 h-0.5 rounded-full bg-muted-foreground/20" />
            {/* Línea de progreso */}
            <motion.div
              className="absolute left-[6px] top-1/2 -translate-y-1/2 h-0.5 rounded-full bg-primary origin-left"
              style={{ width: "calc(100% - 12px)" }}
              animate={{ scaleX: (currentStep - 1) / 3 }}
              transition={reducedMotion ? { duration: 0 } : SPRING_SUAVE_SIN_REBOTE}
            />
            {[1, 2, 3, 4].map((step) => {
              const active = step === currentStep;
              return (
                <button
                  key={step}
                  onClick={() => { if (currentStep < 5) setCurrentStep(step) }}
                  aria-label={`Ir al paso ${step}`}
                  aria-current={active ? "step" : undefined}
                  className={`relative z-10 h-3 w-3 rounded-full transition-colors duration-[var(--motion-fast)] ${
                    active
                      ? ""
                      : step < currentStep
                      ? "bg-primary/40"
                      : "bg-muted-foreground/30"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="step-pill"
                      className="absolute -left-1.5 inset-y-0 w-6 rounded-full bg-primary"
                      transition={reducedMotion ? { duration: 0 } : SPRING_SUAVE}
                    />
                  )}
                </button>
              );
            })}
          </div>
        {currentStep <= 4 && (
          <p className="text-xs text-muted-foreground">
            Paso {currentStep} de 4 · {PASOS_NOMBRE[currentStep - 1]}
          </p>
        )}
        </div>
        }
      />
      <BannerTareaOrigen tareaId={tareaId} />

      {/* Banner: alerta cuando la aplicación supera 7 días desde la recomendación */}
      {alertaFechaVencida && (
        <div className="mx-4 mt-3 mb-1 p-3 rounded-xl flex items-start gap-2 bg-agro-info-fill">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-agro-info-text" />
          <p className="text-sm text-agro-info-text">
            La fecha de aplicación supera por más de 7 días la recomendación del asesor.
            Verifica con{" "}
            <span className="font-semibold">{formData.technicalAdvisor}</span> antes de continuar.
          </p>
        </div>
      )}

      {/* Pasos del formulario */}
      <div className="p-4 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {currentStep === 1 && (
            <motion.div
              key={1}
              initial={reducedMotion ? false : { opacity: 0, x: direccion * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, x: -direccion * 24 }}
              transition={reducedMotion ? { duration: 0 } : STEP_TRANSITION}
            >
              <Step1ParcelaYCultivo
                formData={formData}
                updateFormData={updateFormData}
                onNext={nextStep}
                esCampo={esCampo}
              />
            </motion.div>
          )}
          {currentStep === 2 && (
            <motion.div
              key={2}
              initial={reducedMotion ? false : { opacity: 0, x: direccion * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, x: -direccion * 24 }}
              transition={reducedMotion ? { duration: 0 } : STEP_TRANSITION}
            >
              <Step2Productos
                formData={formData}
                updateFormData={updateFormData}
                onNext={nextStep}
                onBack={prevStep}
                productosEnInventario={productosEnInventario}
                inventarioAl={inventarioAl}
              />
            </motion.div>
          )}
          {currentStep === 3 && (
            <motion.div
              key={3}
              initial={reducedMotion ? false : { opacity: 0, x: direccion * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, x: -direccion * 24 }}
              transition={reducedMotion ? { duration: 0 } : STEP_TRANSITION}
            >
              <Step3AplicacionYAgua
                formData={formData}
                updateFormData={updateFormData}
                onNext={nextStep}
                onBack={prevStep}
                esCampo={esCampo}
              />
            </motion.div>
          )}
          {currentStep === 4 && (
            <motion.div
              key={4}
              initial={reducedMotion ? false : { opacity: 0, x: direccion * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, x: -direccion * 24 }}
              transition={reducedMotion ? { duration: 0 } : STEP_TRANSITION}
            >
              <Step4CierreYObservaciones
                formData={formData}
                updateFormData={updateFormData}
                onSave={handleSave}
                onBack={prevStep}
                saving={saving}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {currentStep === 5 && aplicacionGuardada?.pendiente && (
        <div className="p-4 space-y-4">
          <div className="rounded-xl p-4 bg-agro-info-fill">
            <p className="text-sm text-agro-info-text font-semibold">
              Aplicación guardada sin conexión
            </p>
            <p className="text-sm text-agro-info-text mt-1">
              Se subirá al recuperar señal. Podrás firmarla desde el historial cuando se sincronice.
            </p>
          </div>
          {aplicacionGuardada.pdfProps && (
            <button
              onClick={async () => {
                try { await generarAplicacionPDF(aplicacionGuardada.pdfProps!) } catch {
                  toast.warning("No se pudo generar el PDF")
                }
              }}
              className="w-full py-3 rounded-xl border border-border bg-card text-foreground font-semibold"
            >
              Descargar PDF (pendiente de sincronizar)
            </button>
          )}
          <Boton onClick={() => navigate("/")} className="w-full">
            Volver al inicio
          </Boton>
        </div>
      )}

      {currentStep === 5 && aplicacionGuardada && !aplicacionGuardada.pendiente && (
        <div className="flex flex-col" style={{ height: 'calc(100dvh - 130px)' }}>
          <PasoFirmaRegistro
            modulo="M1"
            ids={[aplicacionGuardada.id]}
            descripcion={`Nueva Aplicación · ${formData.applicationDate} · ${aplicacionGuardada.ranchoNombre}`}
            obligatoria={obligatoria}
            onFirmadoYPDF={async () => {
              if (aplicacionGuardada.pdfProps) {
                try { await generarAplicacionPDF(aplicacionGuardada.pdfProps) } catch {
                  toast.warning("No se pudo generar el PDF — descárgalo desde el historial.")
                }
              }
              navigate("/")
            }}
            onDespues={!obligatoria ? () => { navigate("/") } : undefined}
          />
        </div>
      )}
    </div>
  );
}
