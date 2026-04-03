import { useState } from "react";
import { ArrowLeft, Plus, Calendar as CalendarIcon, Check, X } from "lucide-react";
import { Link } from "react-router";

interface BotiquinEntry {
  id: string;
  fecha: string;
  parachoqueWriter: { tiene: boolean; llenar: boolean };
  guantesTalla: "S" | "M" | "L" | "";
  vendas: { tiene: boolean; llenar: boolean };
  gasas: { tiene: boolean; llenar: boolean };
  desinfectante: { tiene: boolean; llenar: boolean };
  responsable: string;
  firma: string;
}

const mockEntries: BotiquinEntry[] = [
  {
    id: "1",
    fecha: "2026-03-31",
    parachoqueWriter: { tiene: true, llenar: true },
    guantesTalla: "M",
    vendas: { tiene: true, llenar: false },
    gasas: { tiene: true, llenar: true },
    desinfectante: { tiene: true, llenar: true },
    responsable: "Juan Pérez",
    firma: "JP"
  }
];

const TogglePill = ({ active, onToggle, label }: { active: boolean; onToggle: () => void; label: string }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`px-3 py-1 rounded text-xs transition-colors ${
      active
        ? "bg-[#E3F2FD] text-[#0D5A8F]"
        : "bg-[#FAECE7] text-[#993C1D]"
    }`}
    style={{ fontWeight: 600 }}
  >
    {active ? "SI" : "NO"}
  </button>
);

export function BotiquinPrimerosAuxilios() {
  const [entries, setEntries] = useState<BotiquinEntry[]>(mockEntries);
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">
      {/* Header */}
      <header className="bg-white border-b border-black/10 px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link to="/">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </Link>
          <div className="flex-1">
            <h1 className="text-gray-900" style={{ fontWeight: 600 }}>Botiquín de Primeros Auxilios</h1>
            <div className="text-xs text-gray-600">MXA-F-SC-SIG · Semanal</div>
          </div>
        </div>
      </header>

      {/* Producer Info */}
      <div className="bg-[#ececf0] px-4 py-3 border-b border-black/10">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-600">Productor:</span>{" "}
            <span className="text-gray-900" style={{ fontWeight: 600 }}>Hortifrut México</span>
          </div>
          <div>
            <span className="text-gray-600">Cultivo:</span>{" "}
            <span className="text-gray-900" style={{ fontWeight: 600 }}>Fresa</span>
          </div>
          <div>
            <span className="text-gray-600">Código:</span>{" "}
            <span className="text-gray-900" style={{ fontWeight: 600 }}>HF-001</span>
          </div>
          <div>
            <span className="text-gray-600">Huerto:</span>{" "}
            <span className="text-gray-900" style={{ fontWeight: 600 }}>El Valle</span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-600">Variedad:</span>{" "}
            <span className="text-gray-900" style={{ fontWeight: 600 }}>Albion</span>
          </div>
        </div>
      </div>

      {/* Scrollable Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-white border-b border-black/10 sticky top-[100px] z-10">
            <tr className="text-xs">
              <th className="px-3 py-2 text-left text-gray-900 bg-white sticky left-0 z-10 border-r border-black/10" style={{ fontWeight: 600 }}>
                Fecha
              </th>
              <th className="px-3 py-2 text-center text-gray-900" style={{ fontWeight: 600 }}>
                <div>Parachofc Writer</div>
                <div className="flex gap-1 mt-1 justify-center">
                  <span className="text-[10px] text-gray-600">Tiene</span>
                  <span className="text-[10px] text-gray-600">Llenar</span>
                </div>
              </th>
              <th className="px-3 py-2 text-center text-gray-900" style={{ fontWeight: 600 }}>
                Guantes (Talla)
              </th>
              <th className="px-3 py-2 text-center text-gray-900" style={{ fontWeight: 600 }}>
                <div>Vendas y Tijeras</div>
                <div className="flex gap-1 mt-1 justify-center">
                  <span className="text-[10px] text-gray-600">Tiene</span>
                  <span className="text-[10px] text-gray-600">Llenar</span>
                </div>
              </th>
              <th className="px-3 py-2 text-center text-gray-900" style={{ fontWeight: 600 }}>
                <div>Gasas/Cinta</div>
                <div className="flex gap-1 mt-1 justify-center">
                  <span className="text-[10px] text-gray-600">Tiene</span>
                  <span className="text-[10px] text-gray-600">Llenar</span>
                </div>
              </th>
              <th className="px-3 py-2 text-center text-gray-900" style={{ fontWeight: 600 }}>
                <div>Desinfectante</div>
                <div className="flex gap-1 mt-1 justify-center">
                  <span className="text-[10px] text-gray-600">Tiene</span>
                  <span className="text-[10px] text-gray-600">Llenar</span>
                </div>
              </th>
              <th className="px-3 py-2 text-center text-gray-900" style={{ fontWeight: 600 }}>Responsable</th>
              <th className="px-3 py-2 text-center text-gray-900" style={{ fontWeight: 600 }}>Firma</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {entries.map((entry, idx) => (
              <tr key={entry.id} className={`border-b border-black/10 ${idx % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                <td className="px-3 py-3 text-xs text-gray-900 bg-white sticky left-0 z-10 border-r border-black/10" style={{ fontWeight: 600 }}>
                  {new Date(entry.fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1 justify-center">
                    <TogglePill active={entry.parachoqueWriter.tiene} onToggle={() => {}} label="Tiene" />
                    <TogglePill active={entry.parachoqueWriter.llenar} onToggle={() => {}} label="Llenar" />
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <select
                    value={entry.guantesTalla}
                    onChange={() => {}}
                    className="px-2 py-1 text-xs rounded bg-[#f3f3f5] border border-black/10"
                  >
                    <option value="">-</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                  </select>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1 justify-center">
                    <TogglePill active={entry.vendas.tiene} onToggle={() => {}} label="Tiene" />
                    <TogglePill active={entry.vendas.llenar} onToggle={() => {}} label="Llenar" />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1 justify-center">
                    <TogglePill active={entry.gasas.tiene} onToggle={() => {}} label="Tiene" />
                    <TogglePill active={entry.gasas.llenar} onToggle={() => {}} label="Llenar" />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1 justify-center">
                    <TogglePill active={entry.desinfectante.tiene} onToggle={() => {}} label="Tiene" />
                    <TogglePill active={entry.desinfectante.llenar} onToggle={() => {}} label="Llenar" />
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-gray-600 text-center">{entry.responsable}</td>
                <td className="px-3 py-3 text-center">
                  <div className="inline-block px-2 py-1 text-xs bg-[#f3f3f5] rounded border border-black/10" style={{ fontWeight: 600 }}>
                    {entry.firma}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Signature */}
      <div className="bg-white border-t border-black/10 px-4 py-4 mt-4">
        <label className="block text-xs text-gray-600 mb-2">Firma del Responsable de Inocuidad</label>
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
            {/* Handle Bar */}
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
                    className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Firma de verificación semanal</label>
                  <input
                    type="text"
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
                Guardar Inspección
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
