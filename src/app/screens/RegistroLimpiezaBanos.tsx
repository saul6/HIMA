import { useState } from "react";
import { ArrowLeft, Plus, Info } from "lucide-react";
import { Link } from "react-router";

interface LimpiezaEntry {
  id: string;
  fecha: string;
  banoNumero: number;
  lavar: boolean;
  desinfectar: boolean;
  concentracion: number;
  sustancias: string[];
  abastoPapel: boolean;
  succion: boolean;
  realizo: string;
  firma: string;
}

const mockEntries: LimpiezaEntry[] = [
  {
    id: "1",
    fecha: "2026-04-03",
    banoNumero: 1,
    lavar: true,
    desinfectar: true,
    concentracion: 200,
    sustancias: ["Agua", "Jabón"],
    abastoPapel: true,
    succion: true,
    realizo: "Juan Pérez",
    firma: "JP"
  },
  {
    id: "2",
    fecha: "2026-04-03",
    banoNumero: 2,
    lavar: true,
    desinfectar: true,
    concentracion: 200,
    sustancias: ["Agua", "Jabón"],
    abastoPapel: true,
    succion: true,
    realizo: "Juan Pérez",
    firma: "JP"
  }
];

const sustanciasOpciones = ["Agua", "Jabón", "Cloro", "Detergente"];

export function RegistroLimpiezaBanos() {
  const [entries, setEntries] = useState<LimpiezaEntry[]>(mockEntries);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [formData, setFormData] = useState({
    fecha: "",
    banoNumero: "",
    lavar: true,
    desinfectar: true,
    concentracion: "200",
    sustancias: ["Agua", "Jabón"],
    abastoPapel: true,
    succion: true,
    firma: ""
  });

  const toggleSustancia = (sustancia: string) => {
    setFormData(prev => ({
      ...prev,
      sustancias: prev.sustancias.includes(sustancia)
        ? prev.sustancias.filter(s => s !== sustancia)
        : [...prev.sustancias, sustancia]
    }));
  };

  const groupedEntries = entries.reduce((acc, entry) => {
    if (!acc[entry.fecha]) acc[entry.fecha] = [];
    acc[entry.fecha].push(entry);
    return acc;
  }, {} as Record<string, LimpiezaEntry[]>);

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">
      {/* Header */}
      <header className="bg-white border-b border-black/10 px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link to="/">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </Link>
          <div className="flex-1">
            <h1 className="text-gray-900" style={{ fontWeight: 600 }}>Limpieza y Desinfección de Baños</h1>
            <div className="text-xs text-gray-600">MXA-F-SC-SIG-041.14 · Diario</div>
          </div>
        </div>
      </header>

      {/* Info Banner */}
      <div className="bg-[#ececf0] px-4 py-3 border-b border-black/10">
        <div className="flex items-start gap-2 mb-2">
          <Info className="w-4 h-4 text-[#717182] flex-shrink-0 mt-0.5" />
          <div className="text-xs text-[#717182]">
            <div style={{ fontWeight: 600 }}>Desinfectante:</div>
            <div>Hipoclorito de Sodio 5%, Concentración 100-200 ppm</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-[#717182] flex-shrink-0 mt-0.5" />
          <div className="text-xs text-[#717182]">
            <div style={{ fontWeight: 600 }}>Detergente:</div>
            <div>Detergente en polvo, 4 gr por litro de solución</div>
          </div>
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
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1 bg-[#2B7AB5] text-white rounded-full text-sm" style={{ fontWeight: 600 }}>
                        Baño #{entry.banoNumero}
                      </div>
                      {entry.lavar && (
                        <span className="text-xs text-[#0D5A8F] bg-[#E3F2FD] px-2 py-1 rounded" style={{ fontWeight: 600 }}>
                          Lavado
                        </span>
                      )}
                      {entry.desinfectar && (
                        <span className="text-xs text-[#0D5A8F] bg-[#E3F2FD] px-2 py-1 rounded" style={{ fontWeight: 600 }}>
                          Desinfección
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-600">Concentración:</span>{" "}
                      <span className="text-gray-900" style={{ fontWeight: 600 }}>{entry.concentracion} ppm</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Abasto Papel:</span>{" "}
                      <span className={entry.abastoPapel ? "text-[#0D5A8F]" : "text-[#993C1D]"} style={{ fontWeight: 600 }}>
                        {entry.abastoPapel ? "SI" : "NO"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Succión:</span>{" "}
                      <span className={entry.succion ? "text-[#0D5A8F]" : "text-[#993C1D]"} style={{ fontWeight: 600 }}>
                        {entry.succion ? "SI" : "NO"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600">Sustancias:</span>{" "}
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {entry.sustancias.map(s => (
                          <span key={s} className="text-xs px-2 py-0.5 bg-[#f3f3f5] text-gray-900 rounded">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/10">
                    <div className="text-xs text-gray-600">Realizó: {entry.realizo}</div>
                    <div className="text-xs px-2 py-1 bg-[#f3f3f5] rounded border border-black/10" style={{ fontWeight: 600 }}>
                      {entry.firma}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Signature */}
      <div className="bg-white border-t border-black/10 px-4 py-4 mt-4">
        <label className="block text-xs text-gray-600 mb-2">Firma de verificación semanal</label>
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
              <h2 className="text-gray-900 mb-4" style={{ fontWeight: 600 }}>Nuevo Registro de Limpieza</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
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
                    <label className="block text-sm text-gray-600 mb-2">Baño N°</label>
                    <input
                      type="number"
                      value={formData.banoNumero}
                      onChange={e => setFormData({ ...formData, banoNumero: e.target.value })}
                      placeholder="1"
                      className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Limpieza — Lavar y tallar</label>
                  <button
                    onClick={() => setFormData({ ...formData, lavar: !formData.lavar })}
                    className={`w-full py-3 rounded-[0.625rem] text-sm transition-colors flex items-center justify-center gap-2 ${
                      formData.lavar
                        ? "bg-[#2B7AB5] text-white"
                        : "bg-[#cbced4] text-gray-600"
                    }`}
                    style={{ fontWeight: 600 }}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      formData.lavar ? "border-white bg-white/20" : "border-gray-400"
                    }`}>
                      {formData.lavar && <span className="text-white text-sm">✓</span>}
                    </div>
                    Lavar y tallar
                  </button>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Desinfección — Asperjar 3ml cloro</label>
                  <button
                    onClick={() => setFormData({ ...formData, desinfectar: !formData.desinfectar })}
                    className={`w-full py-3 rounded-[0.625rem] text-sm transition-colors flex items-center justify-center gap-2 ${
                      formData.desinfectar
                        ? "bg-[#2B7AB5] text-white"
                        : "bg-[#cbced4] text-gray-600"
                    }`}
                    style={{ fontWeight: 600 }}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      formData.desinfectar ? "border-white bg-white/20" : "border-gray-400"
                    }`}>
                      {formData.desinfectar && <span className="text-white text-sm">✓</span>}
                    </div>
                    Asperjar 3ml cloro
                  </button>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Concentración (ppm)</label>
                  <input
                    type="number"
                    value={formData.concentracion}
                    onChange={e => setFormData({ ...formData, concentracion: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Sustancias Utilizadas</label>
                  <div className="flex gap-2 flex-wrap">
                    {sustanciasOpciones.map(s => (
                      <button
                        key={s}
                        onClick={() => toggleSustancia(s)}
                        className={`px-3 py-2 rounded-[0.625rem] text-xs transition-colors ${
                          formData.sustancias.includes(s)
                            ? "bg-[#2B7AB5] text-white"
                            : "bg-[#f3f3f5] text-gray-600 border border-black/10"
                        }`}
                        style={{ fontWeight: 600 }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Abasto de Papel</label>
                    <button
                      onClick={() => setFormData({ ...formData, abastoPapel: !formData.abastoPapel })}
                      className={`w-full py-2 rounded-[0.625rem] text-sm transition-colors ${
                        formData.abastoPapel
                          ? "bg-[#2B7AB5] text-white"
                          : "bg-[#cbced4] text-gray-600"
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      {formData.abastoPapel ? "SI" : "NO"}
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Succión</label>
                    <button
                      onClick={() => setFormData({ ...formData, succion: !formData.succion })}
                      className={`w-full py-2 rounded-[0.625rem] text-sm transition-colors ${
                        formData.succion
                          ? "bg-[#2B7AB5] text-white"
                          : "bg-[#cbced4] text-gray-600"
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      {formData.succion ? "SI" : "NO"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Firma de verificación</label>
                  <input
                    type="text"
                    value={formData.firma}
                    onChange={e => setFormData({ ...formData, firma: e.target.value })}
                    placeholder="Iniciales"
                    className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
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
                Guardar Registro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
