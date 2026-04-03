import { useState } from "react";
import { ArrowLeft, Plus, AlertCircle } from "lucide-react";
import { Link } from "react-router";

interface InspeccionEntry {
  id: string;
  fecha: string;
  area: string;
  material: string;
  protegido: boolean;
  estado: "bueno" | "deteriorado" | "reemplazo";
  observaciones: string;
  realizo: string;
}

const mockEntries: InspeccionEntry[] = [
  {
    id: "1",
    fecha: "2026-03-30",
    area: "Área de Empaque",
    material: "Ventanas principales",
    protegido: true,
    estado: "bueno",
    observaciones: "",
    realizo: "Juan Pérez"
  },
  {
    id: "2",
    fecha: "2026-03-28",
    area: "Almacén de Agroquímicos",
    material: "Lámparas fluorescentes",
    protegido: true,
    estado: "deteriorado",
    observaciones: "Protector agrietado en esquina",
    realizo: "Juan Pérez"
  }
];

const areas = [
  "Área de Empaque",
  "Almacén de Agroquímicos",
  "Baños",
  "Comedor",
  "Oficinas",
  "Bodega de Material"
];

const estadoOptions = [
  { value: "bueno", label: "Bueno", bg: "#E3F2FD", text: "#0D5A8F" },
  { value: "deteriorado", label: "Deteriorado", bg: "#FAEEDA", text: "#854F0B" },
  { value: "reemplazo", label: "Reemplazo", bg: "#FAECE7", text: "#993C1D" }
];

export function InspeccionVidrioPlastico() {
  const [entries, setEntries] = useState<InspeccionEntry[]>(mockEntries);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [formData, setFormData] = useState({
    fecha: "",
    area: "",
    material: "",
    protegido: true,
    estado: "bueno" as "bueno" | "deteriorado" | "reemplazo",
    observaciones: ""
  });

  const groupedEntries = entries.reduce((acc, entry) => {
    if (!acc[entry.fecha]) acc[entry.fecha] = [];
    acc[entry.fecha].push(entry);
    return acc;
  }, {} as Record<string, InspeccionEntry[]>);

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">
      {/* Header */}
      <header className="bg-white border-b border-black/10 px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link to="/">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </Link>
          <div className="flex-1">
            <h1 className="text-gray-900" style={{ fontWeight: 600 }}>Inspección de Vidrio y Plástico Duro</h1>
            <div className="text-xs text-gray-600">MXA-F-SC-SIG-029.14 · Quincenal</div>
          </div>
        </div>
      </header>

      {/* Info Banner */}
      <div className="bg-[#ececf0] px-4 py-3 border-b border-black/10">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[#717182] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#717182]">Marcar √ o X según sea el caso</p>
        </div>
      </div>

      {/* Timeline Cards */}
      <div className="p-4 space-y-4">
        {Object.entries(groupedEntries).sort(([a], [b]) => b.localeCompare(a)).map(([fecha, items]) => (
          <div key={fecha}>
            <div className="text-xs text-gray-600 mb-2 px-2" style={{ fontWeight: 600 }}>
              {new Date(fecha).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
            </div>
            <div className="space-y-2">
              {items.map(entry => (
                <div key={entry.id} className="bg-white rounded-xl p-4 border border-black/10">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-1 rounded" style={{
                          backgroundColor: estadoOptions.find(e => e.value === entry.estado)?.bg,
                          color: estadoOptions.find(e => e.value === entry.estado)?.text,
                          fontWeight: 600
                        }}>
                          {estadoOptions.find(e => e.value === entry.estado)?.label}
                        </span>
                        {entry.protegido && (
                          <span className="text-xs text-[#0D5A8F] bg-[#E3F2FD] px-2 py-1 rounded" style={{ fontWeight: 600 }}>
                            Protegido
                          </span>
                        )}
                      </div>
                      <div className="text-sm mb-1" style={{ fontWeight: 600 }}>{entry.material}</div>
                      <div className="text-xs text-gray-600">{entry.area}</div>
                      {entry.observaciones && (
                        <div className="text-xs text-gray-600 mt-2 bg-[#f3f3f5] p-2 rounded">
                          {entry.observaciones}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">Realizó: {entry.realizo}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Signature */}
      <div className="bg-white border-t border-black/10 px-4 py-4 mt-4">
        <div className="text-xs text-gray-600 mb-1">Realizó: <span style={{ fontWeight: 600 }}>Juan Pérez</span></div>
        <label className="block text-xs text-gray-600 mb-2 mt-3">Firma del Responsable</label>
        <div className="h-20 border-2 border-dashed border-black/10 rounded-lg flex items-center justify-center text-xs text-gray-400">
          [Firma digital]
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
              <h2 className="text-gray-900 mb-4" style={{ fontWeight: 600 }}>Nueva Inspección</h2>

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
                  <label className="block text-sm text-gray-600 mb-2">Área</label>
                  <select
                    value={formData.area}
                    onChange={e => setFormData({ ...formData, area: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
                  >
                    <option value="">Seleccionar área</option>
                    {areas.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Material o Equipo</label>
                  <input
                    type="text"
                    value={formData.material}
                    onChange={e => setFormData({ ...formData, material: e.target.value })}
                    placeholder="Ej: Ventanas principales"
                    className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Protegido</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFormData({ ...formData, protegido: true })}
                      className={`flex-1 py-2 rounded-[0.625rem] text-sm transition-colors ${
                        formData.protegido
                          ? "bg-[#2B7AB5] text-white"
                          : "bg-[#f3f3f5] text-gray-600 border border-black/10"
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      SI
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, protegido: false })}
                      className={`flex-1 py-2 rounded-[0.625rem] text-sm transition-colors ${
                        !formData.protegido
                          ? "bg-[#C02A2A] text-white"
                          : "bg-[#f3f3f5] text-gray-600 border border-black/10"
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      NO
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Estado</label>
                  <div className="flex gap-2">
                    {estadoOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setFormData({ ...formData, estado: opt.value as any })}
                        className={`flex-1 py-2 rounded-[0.625rem] text-xs transition-all border ${
                          formData.estado === opt.value
                            ? `border-2`
                            : "border-black/10"
                        }`}
                        style={{
                          backgroundColor: formData.estado === opt.value ? opt.bg : "#f3f3f5",
                          color: formData.estado === opt.value ? opt.text : "#717182",
                          fontWeight: 600,
                          borderColor: formData.estado === opt.value ? opt.text : "rgba(0,0,0,0.1)"
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Observaciones</label>
                  <textarea
                    value={formData.observaciones}
                    onChange={e => setFormData({ ...formData, observaciones: e.target.value })}
                    placeholder="Añadir observaciones..."
                    rows={3}
                    className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem] resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="px-4 pb-6 pt-4 border-t border-black/10">
              <button
                className="w-full h-14 bg-[#2B7AB5] text-white rounded-[0.625rem] transition-colors hover:bg-[#1E88C7]"
                style={{ fontWeight: 600 }}
                onClick={() => setShowBottomSheet(false)}
              >
                Guardar Inspección
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
