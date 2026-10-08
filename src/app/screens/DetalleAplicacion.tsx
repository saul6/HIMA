import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { X, CheckCircle, Loader2, FileDown, FileText } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { getAplicacionRicaById } from "@/lib/queries";
import { generarExcelHistorial } from "@/lib/excel/generarExcelHistorial";
import { generarAplicacionPDF } from "@/lib/pdf/generarPDF";
import { formatFenologia } from "@/lib/fenologia";
import { useAuthContext } from "@/context/AuthContext";
import { useModulosContext } from "@/context/ModulosContext";
import { useTheme } from "@/context/ThemeContext";
import { SPRING_SUAVE } from "@/lib/motion";
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
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-muted-foreground text-sm">Aplicación no encontrada</p>
        <button
          onClick={() => navigate("/historial")}
          className="px-4 h-10 bg-primary text-primary-foreground rounded-xl text-sm"
          style={{ fontWeight: 600 }}
        >
          Volver al historial
        </button>
      </div>
    );
  }

  const a = app;

  return (
    <div className="min-h-full pb-[calc(96px+env(safe-area-inset-bottom,0px))] md:pb-6">
      {/* Header */}
      <header className="sticky top-0 bg-card border-b border-border px-4 py-4 z-20">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-foreground flex-1" style={{ fontWeight: 600 }}>
            Detalle de Aplicación
          </h1>
          <button onClick={() => navigate("/historial")} className="p-1">
            <X className="w-6 h-6 text-foreground" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 bg-agro-success-fill text-agro-success-text rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            {a.status === "completado" ? "Completado" : "Borrador"}
          </span>
          <span className="text-sm text-muted-foreground">
            {a.fecha_aplicacion}
            {a.hora_inicio ? ` · ${a.hora_inicio}` : ""}
          </span>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="p-4 space-y-6">
        {/* Parcela y Cultivo */}
        <Section title="INFORMACIÓN DE PARCELA Y CULTIVO">
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
        </Section>

        {/* Productos */}
        <Section title="PRODUCTOS APLICADOS">
          {app.aplicacion_productos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin productos registrados</p>
          ) : (
            app.aplicacion_productos.map((p, index) => (
              <div key={p.id} className="mb-4 pb-4 border-b border-border last:border-0">
                <div className="text-sm mb-3" style={{ fontWeight: 600 }}>
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
        </Section>

        {/* Aplicación y Agua */}
        <Section title="APLICACIÓN Y AGUA">
          <DataRow label="Tipo de aplicación" value={a.tipo_aplicacion} />
          <DataRow label="Equipo" value={a.equipo ?? "—"} />
          <DataRow label="Agua utilizada" value={a.total_agua_l ? `${a.total_agua_l} L` : "—"} />
          <DataRow label="Cloración" value={a.cloracion ? "Sí" : "No"} />
          {a.cloracion && (
            <>
              <DataRow label="Cantidad cloro" value={a.cloro_cantidad_l ? `${a.cloro_cantidad_l} L` : "—"} />
              <DataRow label="pH" value={a.cloro_ph ? `${a.cloro_ph}` : "—"} />
            </>
          )}
          <DataRow label="Condiciones climáticas" value={a.condicion_meteorologica ?? "—"} />
        </Section>

        {/* EPP */}
        <Section title="EQUIPO DE PROTECCIÓN PERSONAL">
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
                  <CheckCircle className="w-4 h-4 text-secondary" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />
                )}
                <span className={`text-sm ${used ? "" : "text-muted-foreground"}`}>{item}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Personal */}
        <Section title="PERSONAL Y RESPONSABLES">
          <DataRow label="Aplicador" value={a.aplicadores ?? "—"} />
          <DataRow label="Asesor técnico" value={app.asesor?.nombre_completo ?? "—"} />
          <DataRow label="Responsable inocuidad" value={app.responsable?.nombre_completo ?? "—"} />
        </Section>

        {a.observaciones && (
          <Section title="OBSERVACIONES">
            <p className="text-sm text-foreground">{a.observaciones}</p>
          </Section>
        )}

        {/* Cápsula flotante — Excel / PDF */}
        <div className="sticky bottom-[calc(88px+env(safe-area-inset-bottom,0px))] md:bottom-4 z-10 flex justify-center">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : SPRING_SUAVE}
            className="w-full md:w-fit flex items-center gap-2 md:gap-3 bg-card border border-border rounded-2xl p-2"
          >
            <button
              onClick={handleExportExcel}
              disabled={exportandoExcel}
              className="flex-1 md:flex-none md:min-w-[160px] h-11 flex items-center justify-center gap-2 rounded-xl border border-primary text-primary hover:bg-primary/5 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              style={{ fontWeight: 600 }}
            >
              {exportandoExcel
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <FileDown className="w-4 h-4" />
              }
              Excel
            </button>
            <button
              onClick={handleGenerarPDF}
              disabled={exportandoPDF}
              className="flex-1 md:flex-none md:min-w-[160px] h-11 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              style={{ fontWeight: 600 }}
            >
              {exportandoPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              PDF
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <div>
      <div className="bg-accent -mx-4 px-4 py-2 mb-4">
        <h3
          className="text-[13px]"
          style={{
            fontWeight: 600,
            color: resolvedTheme === "dark" ? "var(--ring)" : "var(--accent-foreground)",
          }}
        >
          {title}
        </h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-right max-w-[55%] text-foreground" style={{ fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}
