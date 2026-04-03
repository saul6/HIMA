import { useState } from "react";
import { ArrowLeft, Check, X, Minus } from "lucide-react";
import { Link } from "react-router";

type CellValue = "SI" | "NO" | "NA" | null;

interface InspeccionData {
  [key: string]: {
    [day: number]: CellValue;
  };
}

const sections = [
  {
    title: "ÁREA DE COSECHA Y TERRENOS ADYACENTES",
    items: [
      "El lote cubre el intervalo de cosecha (IS)",
      "Evidencia de intrusión animal",
      "Evidencia de contaminación fecal",
      "Perímetro libre de basura/vidrio/plástico",
      "Peligro en terrenos adyacentes"
    ]
  },
  {
    title: "BAÑOS",
    items: [
      "Funcionando adecuadamente",
      "Limpios",
      "Papel higiénico suspendido",
      "Depósito con solución",
      "Mingitorios libres",
      "Señalamientos"
    ]
  },
  {
    title: "ESTACIÓN DE LAVAMANOS",
    items: [
      "Funcionando adecuadamente",
      "Agua con cloro",
      "Jabón líquido sin aroma",
      "Papel secante",
      "Bote de basura con bolsa y tapa",
      "Señalamientos",
      "Gel antibacterial",
      "Lavado y desinfección tinacos (cloro 200 ppm)"
    ]
  },
  {
    title: "HIGIENE PERSONAL",
    items: [
      "Lavado de manos observado",
      "Libre de joyería",
      "Libre de maquillaje",
      "Uñas cortas y limpias",
      "Cabello protegido",
      "Libre de heridas",
      "Libre de enfermedades infectocontagiosas",
      "Sin alimentos en área",
      "Ropa limpia y calzado cerrado",
      "Sin objetos personales"
    ]
  },
  {
    title: "MANEJO DE MATERIAL DE EMPAQUE",
    items: [
      "Libre de contacto con el suelo",
      "Material limpio y libre de objetos"
    ]
  },
  {
    title: "ÁREA DE CONSUMO DE ALIMENTOS",
    items: [
      "Limpio",
      "Bote de basura con tapa",
      "Agua potable",
      "Vasos individuales",
      "Señalamientos"
    ]
  },
  {
    title: "SALUD DEL TRABAJADOR",
    items: [
      "Con síntomas de enfermedades",
      "Botiquín de primeros auxilios"
    ]
  },
  {
    title: "ÁREA DE EMPAQUE Y CARGA",
    items: [
      "Área limpia y ordenada",
      "Lavado y desinfección de mesas",
      "Mesas sin desprendimiento de pintura ni óxido",
      "Fruta en tarimas",
      "Vehículo limpio",
      "Inspección de trampas para plagas",
      "Pegamento sucio o en mal estado"
    ]
  },
  {
    title: "CONTENEDORES RE-USABLES",
    subtitle: "(canastas, bolsas, morrales, cubetas)",
    items: [
      "Lavado y desinfección",
      "Almacenados correctamente",
      "Buen estado"
    ]
  }
];

export function InspeccionPreoperacionalCosecha() {
  const [inspectionData, setInspectionData] = useState<InspeccionData>({});
  const [accionesCorrectivas, setAccionesCorrectivas] = useState<{ [key: string]: string }>({});
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const today = new Date().getDate();

  const toggleCell = (itemId: string, day: number) => {
    setInspeccionData(prev => {
      const current = prev[itemId]?.[day];
      let next: CellValue;
      if (current === null || current === undefined) {
        next = "SI";
      } else if (current === "SI") {
        next = "NO";
      } else if (current === "NO") {
        next = "NA";
      } else {
        next = null;
      }
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          [day]: next
        }
      };
    });
  };

  const getCellContent = (itemId: string, day: number) => {
    const value = inspectionData[itemId]?.[day];
    if (value === "SI") {
      return <Check className="w-4 h-4 text-white" />;
    } else if (value === "NO") {
      return <X className="w-4 h-4 text-white" />;
    } else if (value === "NA") {
      return <Minus className="w-4 h-4 text-white" />;
    }
    return null;
  };

  const getCellStyle = (value: CellValue) => {
    if (value === "SI") return "bg-[#2B7AB5]";
    if (value === "NO") return "bg-[#C02A2A]";
    if (value === "NA") return "bg-[#717182]";
    return "bg-white border border-black/10";
  };

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">
      {/* Header */}
      <header className="bg-white border-b border-black/10 px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link to="/">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </Link>
          <div className="flex-1">
            <h1 className="text-gray-900" style={{ fontWeight: 600 }}>Inspección Pre-operacional de Cosecha</h1>
            <div className="text-xs text-gray-600">MXA-F-SC-SIG-039.14 · Diario · Seguimiento BPAs</div>
          </div>
        </div>
      </header>

      {/* Legend */}
      <div className="bg-[#ececf0] px-4 py-3 border-b border-black/10 flex items-center gap-4 overflow-x-auto">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <div className="w-5 h-5 bg-[#2B7AB5] rounded flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs text-gray-900">SI</span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <div className="w-5 h-5 bg-[#C02A2A] rounded flex items-center justify-center">
            <X className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs text-gray-900">NO</span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <div className="w-5 h-5 bg-[#717182] rounded flex items-center justify-center">
            <Minus className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs text-gray-900">N/A</span>
        </div>
      </div>

      {/* Scrollable Calendar Grid */}
      <div className="relative">
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full">
            {/* Sticky Left Column */}
            <div className="sticky left-0 z-20 bg-white border-r border-black/10" style={{ minWidth: "220px" }}>
              {/* Header Cell */}
              <div className="h-10 bg-[#ececf0] border-b border-black/10 flex items-center px-3">
                <span className="text-xs text-gray-900" style={{ fontWeight: 600 }}>Item</span>
              </div>

              {/* Section Rows */}
              {sections.map((section, sIdx) => (
                <div key={sIdx}>
                  {/* Section Header */}
                  <div className="bg-[#ececf0] border-b border-black/10 px-3 py-2">
                    <div className="text-xs text-gray-900" style={{ fontWeight: 600 }}>
                      {section.title}
                    </div>
                    {section.subtitle && (
                      <div className="text-[10px] text-gray-600 mt-0.5">
                        {section.subtitle}
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  {section.items.map((item, iIdx) => {
                    const itemId = `${sIdx}-${iIdx}`;
                    return (
                      <div key={itemId}>
                        <div
                          className="h-10 border-b border-black/10 flex items-center px-3 bg-white cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedRow(expandedRow === itemId ? null : itemId)}
                        >
                          <span className="text-xs text-gray-900">{item}</span>
                        </div>
                        {expandedRow === itemId && (
                          <div className="border-b border-black/10 bg-[#f3f3f5] px-3 py-2">
                            <textarea
                              value={accionesCorrectivas[itemId] || ""}
                              onChange={e => setAccionesCorrectivas({ ...accionesCorrectivas, [itemId]: e.target.value })}
                              placeholder="Acción correctiva y preventiva..."
                              className="w-full text-xs bg-white border border-black/10 rounded p-2 resize-none"
                              rows={2}
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Day Columns */}
            <div className="flex">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <div key={day} style={{ width: "40px" }}>
                  {/* Day Header */}
                  <div
                    className={`h-10 border-b border-black/10 flex items-center justify-center ${
                      day === today ? "bg-[#E3F2FD]" : "bg-[#ececf0]"
                    }`}
                  >
                    <span
                      className="text-xs"
                      style={{
                        fontWeight: 600,
                        color: day === today ? "#0D5A8F" : "#717182"
                      }}
                    >
                      {day}
                    </span>
                  </div>

                  {/* Section Day Cells */}
                  {sections.map((section, sIdx) => (
                    <div key={sIdx}>
                      {/* Section Header Spacer */}
                      <div className="bg-[#ececf0] border-b border-black/10" style={{ height: section.subtitle ? "42px" : "34px" }} />

                      {/* Item Cells */}
                      {section.items.map((item, iIdx) => {
                        const itemId = `${sIdx}-${iIdx}`;
                        const value = inspectionData[itemId]?.[day];
                        const isExpanded = expandedRow === itemId;

                        return (
                          <div key={itemId}>
                            <button
                              onClick={() => toggleCell(itemId, day)}
                              className={`w-full h-10 border-b border-r border-black/10 flex items-center justify-center transition-colors ${
                                getCellStyle(value)
                              } ${day === today ? "ring-1 ring-[#2B7AB5] ring-inset" : ""}`}
                            >
                              {getCellContent(itemId, day)}
                            </button>
                            {isExpanded && (
                              <div className="border-b border-r border-black/10 bg-[#f3f3f5]" style={{ height: "52px" }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-black/10 px-4 py-4 mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-gray-600 mb-1">Iniciales</label>
            <input
              type="text"
              placeholder="JP"
              className="w-full px-2 py-1 bg-[#f3f3f5] border border-black/10 rounded"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1">Nombre Completo</label>
            <input
              type="text"
              placeholder="Juan Pérez"
              className="w-full px-2 py-1 bg-[#f3f3f5] border border-black/10 rounded"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-2">Firma del Responsable de Inocuidad</label>
          <div className="h-20 border-2 border-dashed border-black/10 rounded-lg flex items-center justify-center text-xs text-gray-400">
            [Firma digital]
          </div>
        </div>
      </div>
    </div>
  );
}
