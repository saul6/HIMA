import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Calendar, FileDown, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/context/AuthContext";
import { getAplicacionesRicas } from "@/lib/queries";
import { generarExcelHistorial } from "@/lib/excel/generarExcelHistorial";
import type { AplicacionRica } from "@/types/database.types";

const DATE_FILTERS = ["Hoy", "Esta semana", "Este mes", "Todo"];

function agruparPorFecha(apps: AplicacionRica[]) {
  const mapa = new Map<string, AplicacionRica[]>();
  for (const app of apps) {
    const fecha = app.aplicacion.fecha_aplicacion;
    if (!mapa.has(fecha)) mapa.set(fecha, []);
    mapa.get(fecha)!.push(app);
  }
  return Array.from(mapa.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, applications]) => ({ date, applications }));
}

function filtrarPorFecha(apps: AplicacionRica[], filtro: string): AplicacionRica[] {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  if (filtro === "Hoy") {
    const hoyStr = hoy.toISOString().slice(0, 10);
    return apps.filter(a => a.aplicacion.fecha_aplicacion === hoyStr);
  }
  if (filtro === "Esta semana") {
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    return apps.filter(a => new Date(a.aplicacion.fecha_aplicacion) >= inicioSemana);
  }
  if (filtro === "Este mes") {
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return apps.filter(a => new Date(a.aplicacion.fecha_aplicacion) >= inicioMes);
  }
  return apps;
}

export function Historial() {
  const { productor } = useAuthContext();
  const [apps, setApps] = useState<AplicacionRica[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [activeFilter, setActiveFilter] = useState("Este mes");
  const [selectedRanch, setSelectedRanch] = useState("todos");

  useEffect(() => {
    getAplicacionesRicas(productor?.id)
      .then(setApps)
      .catch(err => toast.error(`Error cargando historial: ${err.message}`))
      .finally(() => setLoading(false));
  }, [productor?.id]);

  const ranchos = Array.from(
    new Map(apps.map(a => [a.ranchos?.id, a.ranchos?.nombre])).entries()
  ).filter(([id]) => id);

  const appsFiltradas = filtrarPorFecha(
    selectedRanch === "todos" ? apps : apps.filter(a => a.ranchos?.id === selectedRanch),
    activeFilter
  );

  const historyData = agruparPorFecha(appsFiltradas);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  };

  const handleExportExcel = async () => {
    if (apps.length === 0) {
      toast.info("No hay aplicaciones para exportar");
      return;
    }
    setExportando(true);
    try {
      const fecha = new Date().toISOString().slice(0, 10);
      await generarExcelHistorial(apps, `M.A.D.Y_Historial_${fecha}.xlsx`);
    } catch (err) {
      toast.error("No se pudo generar el Excel — intenta de nuevo");
      console.error(err);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="min-h-full pb-safe-nav">
      {/* Header */}
      <header className="bg-white border-b border-black/10 px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-gray-900" style={{ fontWeight: 600 }}>
            Historial de Aplicaciones
          </h1>
          <button
            onClick={handleExportExcel}
            disabled={exportando || loading}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-[#2B7AB5] text-[#2B7AB5] text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#E3F2FD] transition-colors"
            style={{ fontWeight: 600 }}
          >
            {exportando
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <FileDown className="w-4 h-4" />
            }
            Excel
          </button>
        </div>

        {/* Date Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {DATE_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`flex-shrink-0 px-4 h-9 rounded-full transition-all whitespace-nowrap ${
                activeFilter === filter
                  ? "bg-[#2B7AB5] text-white"
                  : "bg-white border border-gray-300 text-gray-700"
              }`}
              style={{ fontWeight: 600 }}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Ranch Filter */}
        <div className="relative">
          <select
            value={selectedRanch}
            onChange={(e) => setSelectedRanch(e.target.value)}
            className="w-full h-10 px-3 pr-8 rounded-lg border border-black/10 bg-white
              appearance-none focus:outline-none focus:border-[#2B7AB5] focus:ring-1 focus:ring-[#2B7AB5] text-sm"
          >
            <option value="todos">Todos los ranchos</option>
            {ranchos.map(([id, nombre]) => (
              <option key={id} value={id!}>{nombre}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
        </div>
      </header>

      {/* Content */}
      <div className="p-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#2B7AB5]" />
          </div>
        ) : historyData.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-12">
            Sin aplicaciones registradas en este período
          </p>
        ) : (
          historyData.map((day) => (
            <div key={day.date}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-600" style={{ fontWeight: 600 }}>
                  {formatDate(day.date)}
                </span>
              </div>

              <div className="space-y-3 ml-6 border-l-2 border-gray-200 pl-4">
                {day.applications.map((app) => {
                  const a = app.aplicacion;
                  const productos = app.aplicacion_productos
                    .map(p => p.catalogo_productos.nombre_comercial)
                    .join(", ");

                  return (
                    <Link
                      key={a.id}
                      to={`/historial/${a.id}`}
                      className="block bg-white border border-black/10 rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-600">
                              {a.hora_inicio ?? "—"}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                a.tipo_aplicacion === "Foliar"
                                  ? "bg-[#E3F2FD] text-[#0D5A8F]"
                                  : "bg-[#FAEEDA] text-[#854F0B]"
                              }`}
                            >
                              {a.tipo_aplicacion}
                            </span>
                          </div>
                          <div className="text-sm mb-1" style={{ fontWeight: 600 }}>
                            {productos || "Sin productos"}
                          </div>
                          <div className="text-xs text-gray-600 mb-1">
                            {app.ranchos?.nombre ?? "—"}
                          </div>
                          <div className="text-xs text-gray-600">
                            Por: {app.productores?.profiles?.nombre_completo ?? "—"}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
