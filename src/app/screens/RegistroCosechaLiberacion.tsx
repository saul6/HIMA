import { useState } from "react";
import { ArrowLeft, Plus, AlertTriangle, Barcode } from "lucide-react";
import { Link } from "react-router";

interface CosechaEntry {
  id: string;
  fecha: string;
  sector: string;
  cantidadBandejas: number;
  loteliberado: boolean;
  comprobante: string;
  codigoTrazabilidad: string;
  marcaEmbalaje: string;
  destinoFinal: string;
  frutaProceso: number;
  encargado: string;
  verificado: boolean;
  horaInicio: string;
  horaFinal: string;
}

const mockEntries: CosechaEntry[] = [
  {
    id: "1",
    fecha: "2026-04-01",
    sector: "Sector A-1",
    cantidadBandejas: 245,
    loteliberado: true,
    comprobante: "VAL-2026-001",
    codigoTrazabilidad: "HF-MX-A1-20260401",
    marcaEmbalaje: "Driscoll's",
    destinoFinal: "Exportación USA",
    frutaProceso: 12.5,
    encargado: "Juan Pérez",
    verificado: true,
    horaInicio: "06:00",
    horaFinal: "14:30"
  }
];

const marcasEmbalaje = ["Driscoll's", "Hortifrut", "Privada", "Nacional"];
const destinosFinales = ["Exportación USA", "Exportación Canadá", "Nacional", "Proceso"];

export function RegistroCosechaLiberacion() {
  const [entries, setEntries] = useState<CosechaEntry[]>(mockEntries);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [formData, setFormData] = useState({
    fecha: "",
    sector: "",
    cantidadBandejas: "",
    loteliberado: true,
    comprobante: "",
    marcaEmbalaje: "",
    destinoFinal: "",
    frutaProceso: "",
    horaInicio: "",
    horaFinal: ""
  });

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">
      {/* Header */}
      <header className="bg-white border-b border-black/10 px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link to="/">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </Link>
          <div className="flex-1">
            <h1 className="text-gray-900" style={{ fontWeight: 600 }}>Registro de Cosecha y Liberación</h1>
            <div className="text-xs text-gray-600">MXA-F-SC-SIG-038.14</div>
          </div>
        </div>
      </header>

      {/* Scrollable Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead className="bg-white border-b border-black/10 sticky top-[57px] z-10">
            <tr className="text-xs">
              <th className="px-3 py-2 text-left text-gray-900 bg-white sticky left-0 z-10 border-r border-black/10" style={{ fontWeight: 600 }}>Fecha</th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>Sector</th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>Bandejas</th>
              <th className="px-3 py-2 text-center text-gray-900" style={{ fontWeight: 600 }}>Liberado</th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>Comprobante</th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>Código Trazabilidad</th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>Marca y Embalaje</th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>Destino Final</th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>Proceso (Kg)</th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>
                <div className="flex items-center gap-1">
                  <span>Horario Cosecha</span>
                  <span className="text-[#F5A623]">*</span>
                </div>
              </th>
              <th className="px-3 py-2 text-left text-gray-900" style={{ fontWeight: 600 }}>Encargado</th>
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
                <td className="px-3 py-3 text-xs text-gray-900" style={{ fontWeight: 600 }}>{entry.cantidadBandejas}</td>
                <td className="px-3 py-3 text-center">
                  {entry.loteiberado ? (
                    <span className="inline-block px-2 py-1 bg-[#E3F2FD] text-[#0D5A8F] rounded text-xs" style={{ fontWeight: 600 }}>
                      SI
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-1 bg-[#FAECE7] text-[#993C1D] rounded text-xs" style={{ fontWeight: 600 }}>
                      NO
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-gray-900">{entry.comprobante}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-900 font-mono">{entry.codigoTrazabilidad}</span>
                    <Barcode className="w-4 h-4 text-[#2B7AB5]" />
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-gray-900">{entry.marcaEmbalaje}</td>
                <td className="px-3 py-3 text-xs text-gray-900">{entry.destinoFinal}</td>
                <td className="px-3 py-3 text-xs text-gray-900">{entry.frutaProceso}</td>
                <td className="px-3 py-3">
                  <div className="px-2 py-1 bg-[#FAEEDA] border-2 border-[#F5A623] rounded text-xs text-gray-900" style={{ fontWeight: 600 }}>
                    {entry.horaInicio} - {entry.horaFinal}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-gray-600">{entry.encargado}</td>
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

      {/* Warning Alert */}
      <div className="mx-4 mt-4 bg-[#FAEEDA] rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[#854F0B] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[#854F0B]">
          Para la liberación del producto se tomarán en cuenta los criterios del Procedimiento MXA-P-SC-SIG-33-12.
        </div>
      </div>

      {/* Footer Signature */}
      <div className="bg-white border-t border-black/10 px-4 py-4 mt-4">
        <label className="block text-xs text-gray-600 mb-2">Firma del Encargado de la Liberación</label>
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
              <h2 className="text-gray-900 mb-4" style={{ fontWeight: 600 }}>Nuevo Registro de Cosecha</h2>

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
                    <label className="block text-sm text-gray-600 mb-2">Sector</label>
                    <input
                      type="text"
                      value={formData.sector}
                      onChange={e => setFormData({ ...formData, sector: e.target.value })}
                      placeholder="Ej: Sector A-1"
                      className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Cantidad de Bandejas</label>
                  <input
                    type="number"
                    value={formData.cantidadBandejas}
                    onChange={e => setFormData({ ...formData, cantidadBandejas: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Lote Liberado</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFormData({ ...formData, loteLiberated: true })}
                      className={`flex-1 py-2 rounded-[0.625rem] text-sm transition-colors ${
                        formData.loteLiberated
                          ? "bg-[#2B7AB5] text-white"
                          : "bg-[#f3f3f5] text-gray-600 border border-black/10"
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      SI
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, loteLiberated: false })}
                      className={`flex-1 py-2 rounded-[0.625rem] text-sm transition-colors ${
                        !formData.loteLiberated
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
                  <label className="block text-sm text-gray-600 mb-2">No. de Comprobante</label>
                  <input
                    type="text"
                    value={formData.comprobante}
                    onChange={e => setFormData({ ...formData, comprobante: e.target.value })}
                    placeholder="VAL-YYYY-000"
                    className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Marca y Embalaje</label>
                  <select
                    value={formData.marcaEmbalaje}
                    onChange={e => setFormData({ ...formData, marcaEmbalaje: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
                  >
                    <option value="">Seleccionar marca</option>
                    {marcasEmbalaje.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Destino Final</label>
                  <select
                    value={formData.destinoFinal}
                    onChange={e => setFormData({ ...formData, destinoFinal: e.target.value })}
                    className="w-full px-3 py-2 bg-[#f3f3f5] border border-black/10 rounded-[0.625rem]"
                  >
                    <option value="">Seleccionar destino</option>
                    {destinosFinales.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="bg-[#FAEEDA] border-2 border-[#F5A623] rounded-[0.625rem] p-3 space-y-3">
                  <label className="block text-sm text-[#854F0B]" style={{ fontWeight: 600 }}>
                    Horario de Cosecha *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#854F0B] mb-1">Hora Inicio</label>
                      <input
                        type="time"
                        value={formData.horaInicio}
                        onChange={e => setFormData({ ...formData, horaInicio: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-[#F5A623] rounded-[0.625rem]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#854F0B] mb-1">Hora Final</label>
                      <input
                        type="time"
                        value={formData.horaFinal}
                        onChange={e => setFormData({ ...formData, horaFinal: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-[#F5A623] rounded-[0.625rem]"
                      />
                    </div>
                  </div>
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
