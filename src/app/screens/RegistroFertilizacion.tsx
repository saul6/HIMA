import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Link } from "react-router";

interface FertilizacionEntry {
  id: string;
  fecha: string;
  sector: string;
  nombreComercial: string;
  ingredienteActivo: string;
  concentracion: string;
  metodo: "Fertirriego" | "Drench" | "Band";
  superficie: number;
  dosisKgL: number;
  cantidadTotal: number;
  operario: string;
  verificado: boolean;
}

const mockEntries: FertilizacionEntry[] = [
  {
    id: "1",
    fecha: "2026-03-29",
    sector: "Sector A-1",
    nombreComercial: "Nitrato de Calcio",
    ingredienteActivo: "Ca(NO3)2",
    concentracion: "15.5%",
    metodo: "Fertirriego",
    superficie: 12.5,
    dosisKgL: 25,
    cantidadTotal: 312.5,
    operario: "Juan Pérez",
    verificado: true
  }
];

const metodos = ["Fertirriego", "Drench", "Band"];

export function RegistroFertilizacion() {
  const [entries, setEntries] = useState<FertilizacionEntry[]>(mockEntries);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [formData, setFormData] = useState({
    fecha: "",
    sector: "",
    nombreComercial: "",
    metodo: "Fertirriego" as "Fertirriego" | "Drench" | "Band",
    superficie: "",
    dosisKgL: ""
  });

  const calcularCantidadTotal = () => {
    const sup = parseFloat(formData.superficie) || 0;
    const dosis = parseFloat(formData.dosisKgL) || 0;
    return (sup * dosis).toFixed(2);
  };

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">
      {/* Header */}
      <header className="bg-white border-b border-black/10 px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link to="/">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </Link>
          <div className="flex-1">
            <h1 className="text-gray-900" style={{ fontWeight: 600 }}>Registro de Fertilización</h1>
            <div className="text-xs text-gray-600">MXA-F-SC-SIG-030.14 · Enmiendas al Suelo</div>
          </div>
        </div>
      </header>

      {/* Scrollable Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead className="bg-white border-b border-black/10 sticky top-[57px] z-10">
            <tr className="text-xs">
              <th className="px-3 py-2 text-left text-gray-900 bg-white sticky left-0 z-10 border-r border-black/10" style={{ fontWeight: 600 }}>Fecha</th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>Sector</th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>Nombre Comercial</th>
              <th className="px-3 py-2 text-left text-gray-600" style={{ fontWeight: 400 }}>Ingrediente Activo</th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>Concentración</th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>Método</th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>
                <div className="flex items-center gap-1">
                  <span>Superficie (ha)</span>
                  <span className="text-[#F5A623]">*</span>
                </div>
              </th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>Dosis Kg-L/Ha</th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>Cantidad Total</th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>Operario</th>
              <th className="px-3 py-2 text-center text-gray-900" style={{ fontWeight: 600 }}>Verificación</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {entries.map((entry, idx) => (
              <tr key={entry.id} className={`border-b border-black/10 ${idx % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                <td className="px-3 py-3 text-xs text-gray-900 bg-white sticky left-0 z-10 border-r border-black/10" style={{ fontWeight: 600 }}>
                  {new Date(entry.fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                </td>
                <td className="px-3 py-3 text-xs text-gray-900">{entry.sector}</td>
                <td className="px-3 py-3 text-xs text-gray-900" style={{ fontWeight: 600 }}>{entry.nombreComercial}</td>
                <td className="px-3 py-3 text-xs text-gray-600">{entry.ingredienteActivo}</td>
                <td className="px-3 py-3 text-xs text-gray-900">{entry.concentracion}</td>
                <td className="px-3 py-3 text-xs text-gray-900">{entry.metodo}</td>
                <td className="px-3 py-3">
                  <div className="px-2 py-1 bg-[#FAEEDA] border-2 border-[#F5A623] rounded text-xs text-gray-900 text-center" style={{ fontWeight: 600 }}>
                    {entry.superficie}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-gray-900">{entry.dosisKgL}</td>
                <td className="px-3 py-3">
                  <div className="px-2 py-1 bg-[#E3F2FD] rounded text-xs text-[#0D5A8F]" style={{ fontWeight: 600 }}>
                    {entry.cantidadTotal} Kg/L
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-gray-600">{entry.operario}</td>
                <td className="px-3 py-3 text-center">
                  {entry.verificado && (
                    <span className="inline-block w-4 h-4 bg-[#2B7AB5] rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-black/10 px-4 py-4 mt-4 space-y-4">
        <div>
          <label className="block text-xs text-gray-600 mb-2">Asesor Técnico</label>
          <input
            type="text"
            placeholder="Nombre del asesor técnico"
            className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-2">Firma del Responsable de Inocuidad</label>
          <div className="h-20 border-2 border-dashed border-black/10 rounded-lg flex items-center justify-center text-xs text-gray-400">
            [Firma digital]
          </div>
        </div>
      </div>

      {/* FAB Button */}
      <button
        onClick={() => setShowBottomSheet(true)}
        className="fixed bottom-[calc(72px+34px+16px)] right-4 w-14 h-14 bg-[#2B7AB5] rounded-full flex items-center justify-center shadow-lg z-10 hover:bg-[#1E88C7] transition-colors"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* Bottom Sheet */}
      {showBottomSheet && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowBottomSheet(false)} />
          <div className="relative w-full bg-white rounded-t-[0.625rem] h-[85%] flex flex-col">
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <h2 className="text-gray-900 mb-4" style={{ fontWeight: 600 }}>Nueva Fertilización</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Fecha</label>
                  <input
                    type="date"
                    value={formData.fecha}
                    onChange={e => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Sector</label>
                  <input
                    type="text"
                    value={formData.sector}
                    onChange={e => setFormData({ ...formData, sector: e.target.value })}
                    placeholder="Ej: Sector A-1"
                    className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Nombre Comercial</label>
                  <input
                    type="text"
                    value={formData.nombreComercial}
                    onChange={e => setFormData({ ...formData, nombreComercial: e.target.value })}
                    placeholder="Buscar producto..."
                    className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Método de Aplicación</label>
                  <div className="grid grid-cols-3 gap-2">
                    {metodos.map(m => (
                      <button
                        key={m}
                        onClick={() => setFormData({ ...formData, metodo: m as any })}
                        className={`py-2 rounded-[0.625rem] text-xs transition-colors ${
                          formData.metodo === m
                            ? "bg-[#2B7AB5] text-white"
                            : "bg-[#f3f3f5] text-gray-600 border border-black/10"
                        }`}
                        style={{ fontWeight: 600 }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#FAEEDA] border-2 border-[#F5A623] rounded-[0.625rem] p-3">
                  <label className="block text-sm text-[#854F0B] mb-2" style={{ fontWeight: 600 }}>
                    Superficie (ha) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.superficie}
                    onChange={e => setFormData({ ...formData, superficie: e.target.value })}
                    placeholder="0.0"
                    className="w-full px-3 py-2 bg-white border border-[#F5A623] rounded-[0.625rem]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Dosis (Kg-L/Ha)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.dosisKgL}
                    onChange={e => setFormData({ ...formData, dosisKgL: e.target.value })}
                    placeholder="0.0"
                    className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
                  />
                </div>

                {formData.superficie && formData.dosisKgL && (
                  <div className="bg-[#E3F2FD] rounded-[0.625rem] p-3">
                    <div className="text-xs text-[#0D5A8F] mb-1">Cantidad Total Aplicada</div>
                    <div className="text-lg text-[#0D5A8F]" style={{ fontWeight: 600 }}>
                      {calcularCantidadTotal()} Kg/L
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 pb-6 pt-4 border-t border-black/10">
              <button
                className="w-full h-14 bg-[#2B7AB5] text-white rounded-[0.625rem] transition-colors hover:bg-[#1E88C7]"
                style={{ fontWeight: 600 }}
                onClick={() => setShowBottomSheet(false)}
              >
                Guardar Fertilización
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
