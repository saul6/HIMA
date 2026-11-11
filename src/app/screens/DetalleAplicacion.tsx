import { AvisoCargaLenta } from '@/app/components/ui-mady/AvisoCargaLenta'
import { Boton } from '@/app/components/ui-mady/Boton'
import { Panel } from '@/app/components/ui-mady/Panel'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { CheckCircle, FileDown, FileText } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { getAplicacionRicaById } from "@/lib/queries";
import { generarExcelHistorial } from "@/lib/excel/generarExcelHistorial";
import { generarAplicacionPDF } from "@/lib/pdf/generarPDF";
import { formatFenologia } from "@/lib/fenologia";
import { useAuthContext } from "@/context/AuthContext";
import { useModulosContext } from "@/context/ModulosContext";
import { SPRING_SUAVE, useEntradaPantalla } from "@/lib/motion";
import { Skeleton } from "@/app/components/ui/skeleton";
import type { AplicacionRica } from "@/types/database.types";

export function DetalleAplicacion() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { profile, user, codigoClave } = useAuthContext();
  const { terminosSitio } = useModulosContext();
  const [app, setApp] = useState<AplicacionRica | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [exportandoPDF, setExportandoPDF] = useState(false);
  const reducedMotion = useReducedMotion();
  const ent = useEntradaPantalla(!loading);

  // Atrás si hay historial de la app; si se entró directo por URL, al Historial.
  const regresar = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" && idx > 0) navigate(-1);
    else navigate("/historial");
  };

  useEffect(() => {
    if (!id) return;
    getAplicacionRicaById(id)
      .then(setApp)
      .catch(err => toast.error(`Error cargando aplicación: ${err.message}`))
      .finally(() => setLoading(false));
  }, [id]);

  const handleExportExcel = async () => {
    if (!app) return;
    setExportandoExcel(true);
    try {
      const fecha = app.fecha_aplicacion.replaceAll("-", "");
      const rancho = (app.ranchos?.nombre ?? "rancho")
        .toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      await generarExcelHistorial([app], `M.A.D.Y_Aplicacion_${rancho}_${fecha}.xlsx`);
    } catch (err) {
      toast.error("No se pudo generar el Excel");
      console.error(err);
    } finally {
      setExportandoExcel(false);
    }
  };

  const handleGenerarPDF = async () => {
    if (!app || !profile) return;
    setExportandoPDF(true);
    try {
      await generarAplicacionPDF({
        aplicacion: app as any,
        productos: app.aplicacion_productos as any,
        rancho: app.ranchos as any,
        asesor: (app as any).asesor ?? null,
        responsable: (app as any).responsable ?? null,
        operario: profile as any,
        operarioEmail: user?.email,
        codigoClave: codigoClave ?? undefined,
        terminoSitio: terminosSitio?.singular,
      });
    } catch {
      toast.error("No se pudo generar el PDF");
    } finally {
      setExportandoPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full pb-[calc(96px+env(safe-area-inset-bottom,0px))] md:pb-6">
        <ModuloHeader tituloFallback="Detalle de Aplicación" forzarTitulo="Detalle de Aplicación" onBack={regresar} />

        <div className="p-4 flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
          <Panel>
            <div className="space-y-3">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow valueWidth="w-20" />
              <SkeletonRow />
            </div>
          </Panel>
          <Panel>
            <div className="space-y-3">
              <SkeletonRow valueWidth="w-16" />
              <SkeletonRow />
              <SkeletonRow valueWidth="w-24" />
            </div>
          </Panel>
          <Panel>
            <div className="space-y-3">
              <SkeletonRow />
              <SkeletonRow valueWidth="w-20" />
            </div>
          </Panel>
          <div className="lg:col-span-2">
            <AvisoCargaLenta />
          </div>
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-muted-foreground text-sm">Aplicación no encontrada</p>
        <Boton onClick={() => navigate("/historial")}>Volver al historial</Boton>
      </div>
    );
  }

  const a = app;

  return (
    <div className="min-h-full pb-[calc(96px+env(safe-area-inset-bottom,0px))] md:pb-6">
      <ModuloHeader
        tituloFallback="Detalle de Aplicación"
        forzarTitulo="Detalle de Aplicación"
        subtitulo={`${a.status === "completado" ? "Completado" : "Borrador"} · ${a.fecha_aplicacion}${a.hora_inicio ? ` · ${a.hora_inicio}` : ""}`}
        onBack={regresar}
      />

      {/* Contenido: una columna en celular y tablet (orden de siempre); 2 columnas desde lg */}
      <div className="p-4">
        <motion.div
          {...ent(0)}
          className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start"
        >
          <div className="contents lg:flex lg:flex-col lg:gap-4">
            {/* Parcela y Cultivo */}
            <Panel titulo="Información de parcela y cultivo" className="order-1 lg:order-none">
              <div className="space-y-3">
                <DataRow label="Productor" value={app.productores?.profiles?.nombre_completo ?? "—"} />
                <DataRow label="Huerto" value={app.ranchos?.nombre ?? "—"} />
                <DataRow label="Código de huerto" value={app.ranchos?.codigo ?? "—"} />
                <DataRow label="Cultivo" value={app.ranchos?.cultivo ?? "—"} />
                <DataRow label="Variedad" value={a.variedad ?? "—"} />
                <DataRow label="Sector" value={a.sector ?? "—"} />
                <DataRow label="Superficie" value={a.superficie_ha ? `${a.superficie_ha} ha` : "—"} />
                <DataRow label="Etapa fenológica" value={formatFenologia(a.fenologia ?? undefined)} />
                <DataRow label="Fecha recomendación" value={a.fecha_recomendacion ?? "—"} />
                <DataRow label="Fecha aplicación" value={a.fecha_aplicacion} />
                <DataRow label="Hora inicio" value={a.hora_inicio ?? "—"} />
                <DataRow label="Hora fin" value={a.hora_fin ?? "—"} />
              </div>
            </Panel>

            {/* Aplicación y Agua */}
            <Panel titulo="Aplicación y agua" className="order-3 lg:order-none">
              <div className="space-y-3">
                <DataRow label="Tipo de aplicación" value={a.tipo_aplicacion} />
                <DataRow label="Equipo" value={a.equipo ?? "—"} />
                <DataRow label="Agua utilizada" value={a.total_agua_l ? `${a.total_agua_l} L` : "—"} />
                <DataRow label="Cloración" value={a.cloracion ? "Sí" : "No"} />
                {a.cloracion && (
                  <>
                    <DataRow label="Cantidad cloro" value={a.cloro_cantidad_l ? `${a.cloro_cantidad_l} ml` : "—"} />
                    <DataRow label="pH" value={a.cloro_ph ? `${a.cloro_ph}` : "—"} />
                  </>
                )}
                <DataRow label="Condiciones climáticas" value={a.condicion_meteorologica ?? "—"} />
              </div>
            </Panel>

            {/* EPP */}
            <Panel titulo="Equipo de protección personal" className="order-4 lg:order-none">
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["Traje protector", a.epp_traje],
                    ["Guantes", a.epp_guantes],
                    ["Googles", a.epp_googles],
                    ["Botas", a.epp_botas],
                    ["Mascarillas", a.epp_mascarillas],
                  ] as [string, boolean][]
                ).map(([item, used]) => (
                  <div
                    key={item}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      used ? "bg-accent" : "bg-muted"
                    }`}
                  >
                    {used ? (
                      <CheckCircle className="w-4 h-4 text-text-mint-strong" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />
                    )}
                    <span className={`text-sm ${used ? "" : "text-muted-foreground"}`}>{item}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="contents lg:flex lg:flex-col lg:gap-4">
            {/* Productos */}
            <Panel titulo="Productos aplicados" className="order-2 lg:order-none">
              {app.aplicacion_productos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin productos registrados</p>
              ) : (
                app.aplicacion_productos.map((p) => (
                  <div key={p.id} className="mb-4 pb-4 border-b border-border last:mb-0 last:pb-0 last:border-0">
                    <div className="text-sm mb-3 font-semibold">
                      {p.catalogo_productos.nombre_comercial}
                    </div>
                    <div className="space-y-3">
                      <DataRow label="Ingrediente activo" value={p.catalogo_productos.ingrediente_activo} />
                      <DataRow label="RSCO" value={p.catalogo_productos.rsco ?? "—"} />
                      <DataRow label="Objetivo" value={p.plaga_objetivo ?? "—"} />
                      <DataRow label="Nivel infestación" value={p.nivel_infestacion ?? "—"} />
                      <DataRow label="Dosis/ha" value={p.dosis_ha ? `${p.dosis_ha}` : "—"} />
                      <DataRow label="Dosis/200L" value={p.dosis_200l ? `${p.dosis_200l}` : "—"} />
                      <DataRow label="Total usado" value={p.total_producto ? `${p.total_producto}` : "—"} />
                      <DataRow label="Días a cosecha" value={p.dias_cosecha ? `${p.dias_cosecha} días` : "—"} />
                      <DataRow label="Reentrada" value={p.reentrada_hrs ? `${p.reentrada_hrs} hrs` : "—"} />
                    </div>
                  </div>
                ))
              )}
            </Panel>

            {/* Personal */}
            <Panel titulo="Personal y responsables" className="order-5 lg:order-none">
              <div className="space-y-3">
                <DataRow label="Aplicador" value={a.aplicadores ?? "—"} />
                <DataRow label="Asesor técnico" value={app.asesor?.nombre_completo ?? "—"} />
                <DataRow label="Responsable inocuidad" value={app.responsable?.nombre_completo ?? "—"} />
              </div>
            </Panel>

            {a.observaciones && (
              <Panel titulo="Observaciones" className="order-6 lg:order-none">
                <p className="text-sm text-foreground">{a.observaciones}</p>
              </Panel>
            )}
          </div>
        </motion.div>

        {/* Cápsula flotante — Excel / PDF */}
        <div className="sticky bottom-[calc(88px+env(safe-area-inset-bottom,0px))] md:bottom-4 z-10 mt-4 flex justify-center">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : SPRING_SUAVE}
            className="w-full md:w-fit flex items-center gap-2 md:gap-3 bg-card border border-border rounded-2xl p-2"
          >
            <Boton
              variante="secundario"
              onClick={handleExportExcel}
              cargando={exportandoExcel}
              className="flex-1 md:flex-none md:min-w-[160px] border-primary text-primary hover:bg-primary/5"
            >
              <FileDown className="w-4 h-4" />
              Excel
            </Boton>
            <Boton
              onClick={handleGenerarPDF}
              cargando={exportandoPDF}
              className="flex-1 md:flex-none md:min-w-[160px]"
            >
              <FileText className="w-4 h-4" />
              PDF
            </Boton>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-right max-w-[55%] text-foreground font-semibold">
        {value}
      </span>
    </div>
  );
}

function SkeletonRow({ valueWidth = "w-28" }: { valueWidth?: string }) {
  return (
    <div className="flex justify-between items-start">
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className={`h-3.5 ${valueWidth}`} />
    </div>
  );
}
