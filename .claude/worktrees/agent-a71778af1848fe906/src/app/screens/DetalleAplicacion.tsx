import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { X, CheckCircle, Loader2, FileDown, FileText } from "lucide-react";
import { toast } from "sonner";
import { getAplicacionRicaById } from "@/lib/queries";
import { generarExcelHistorial } from "@/lib/excel/generarExcelHistorial";
import { formatFenologia } from "@/lib/fenologia";
import type { AplicacionRica } from "@/types/database.types";

export function DetalleAplicacion() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<AplicacionRica | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportandoExcel, setExportandoExcel] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#2B7AB5]" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-gray-600 text-sm">Aplicación no encontrada</p>
        <button
          onClick={() => navigate("/historial")}
          className="px-4 h-10 bg-[#2B7AB5] text-white rounded-xl text-sm"
          style={{ fontWeight: 600 }}
        >
          Volver al historial
        </button>
      </div>
    );
  }

  const a = app;

  return (
    <div className="min-h-full bg-white pb-[calc(72px+34px+64px)]">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-black/10 px-4 py-4 z-20">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-gray-900 flex-1" style={{ fontWeight: 600 }}>
            Detalle de Aplicación
          </h1>
          <button onClick={() => navigate("/historial")} className="p-1">
            <X className="w-6 h-6 text-gray-900" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 bg-[#E3F2FD] text-[#0D5A8F] rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            {a.status === "completado" ? "Completado" : "Borrador"}
          </span>
          <span className="text-sm text-gray-600">
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
          <div className="grid grid-cols-2 gap-4">
            <DataRow label="Sector" value={a.sector ?? "—"} />
            <DataRow label="Superficie" value={a.superficie_ha ? `${a.superficie_ha} ha` : "—"} />
          </div>
          <DataRow label="Etapa fenológica" value={formatFenologia(a.fenologia ?? undefined)} />
          <DataRow label="Fecha recomendación" value={a.fecha_recomendacion ?? "—"} />
          <DataRow label="Fecha aplicación" value={a.fecha_aplicacion} />
          <div className="grid grid-cols-2 gap-4">
            <DataRow label="Hora inicio" value={a.hora_inicio ?? "—"} />
            <DataRow label="Hora fin" value={a.hora_fin ?? "—"} />
          </div>
        </Section>

        {/* Productos */}
        <Section title="PRODUCTOS APLICADOS">
          {app.aplicacion_productos.length === 0 ? (
            <p className="text-sm text-gray-500">Sin productos registrados</p>
          ) : (
            app.aplicacion_productos.map((p, index) => (
              <div key={p.id} className="mb-4 pb-4 border-b border-gray-200 last:border-0">
                <div className="text-sm mb-3" style={{ fontWeight: 600 }}>
                  {p.catalogo_productos.nombre_comercial}
                </div>
                <div className="space-y-3">
                  <DataRow label="Ingrediente activo" value={p.catalogo_productos.ingrediente_activo} />
                  <DataRow label="RSCO" value={p.catalogo_productos.rsco ?? "—"} />
                  <DataRow label="Objetivo" value={p.plaga_objetivo ?? "—"} />
                  <DataRow label="Nivel infestación" value={p.nivel_infestacion ?? "—"} />
                  <div className="grid grid-cols-2 gap-4">
                    <DataRow label="Dosis/ha" value={p.dosis_ha ? `${p.dosis_ha}` : "—"} />
                    <DataRow label="Dosis/200L" value={p.dosis_200l ? `${p.dosis_200l}` : "—"} />
                  </div>
                  <DataRow label="Total usado" value={p.total_producto ? `${p.total_producto}` : "—"} />
                  <div className="grid grid-cols-2 gap-4">
                    <DataRow label="Días a cosecha" value={p.dias_cosecha ? `${p.dias_cosecha} días` : "—"} />
                    <DataRow label="Reentrada" value={p.reentrada_hrs ? `${p.reentrada_hrs} hrs` : "—"} />
                  </div>
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
            <div className="grid grid-cols-2 gap-4">
              <DataRow label="Cantidad cloro" value={a.cloro_cantidad_l ? `${a.cloro_cantidad_l} L` : "—"} />
              <DataRow label="pH" value={a.cloro_ph ? `${a.cloro_ph}` : "—"} />
            </div>
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
                  used ? "bg-[#E3F2FD]" : "bg-gray-100"
                }`}
              >
                {used ? (
                  <CheckCircle className="w-4 h-4 text-[#0D5A8F]" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-400" />
                )}
                <span className="text-sm">{item}</span>
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
            <p className="text-sm text-gray-700">{a.observaciones}</p>
          </Section>
        )}
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-[calc(72px+34px)] left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-black/10 p-4 flex gap-3">
        <button
          onClick={handleExportExcel}
          disabled={exportandoExcel}
          className="flex-1 h-12 border border-[#2B7AB5] text-[#2B7AB5] rounded-xl hover:bg-[#E3F2FD] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ fontWeight: 600 }}
        >
          {exportandoExcel
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <FileDown className="w-4 h-4" />
          }
          Excel
        </button>
        <button className="flex-1 h-12 bg-[#2B7AB5] text-white rounded-xl hover:bg-[#1E88C7] transition-colors flex items-center justify-center gap-2" style={{ fontWeight: 600 }}>
          <FileText className="w-4 h-4" />
          PDF
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-[#E3F2FD] -mx-4 px-4 py-2 mb-4">
        <h3 className="text-[13px] text-[#0D5A8F]" style={{ fontWeight: 600 }}>
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
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm text-right max-w-[55%]" style={{ fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}
