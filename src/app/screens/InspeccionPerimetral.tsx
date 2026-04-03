import { useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { Link } from "react-router";

type CellValue = "SI" | "NO" | null;

interface InspeccionData {
  [key: string]: {
    [day: number]: CellValue;
  };
}

const sections = [
  {
    title: "PERIFERIA DEL HUERTO",
    items: [
      "Carreola animal",
      "Envases de agroquímicos",
      "Basura/plásticos/pvc/vidrio",
      "Barreras físicas y naturales",
      "Presencia de animales"
    ]
  },
  {
    title: "FUENTES Y DEPÓSITOS DE AGUA — CANAL (Zanja)",
    items: [
      "Presencia de basura",
      "Presencia de animales muertos",
      "Envases de agroquímicos",
      "Limpieza de maleza y desmalve",
      "Materia fecal"
    ]
  },
  {
    title: "RESERVORIO (Pilar, alas, pilote)",
    items: [
      "Presencia de basura",
      "Animales muertos",
      "Envases agroquímicos",
      "Limpieza maleza",
      "Cerca perimetral",
      "Materia fecal"
    ]
  },
  {
    title: "POZO",
    items: [
      "Presencia de basura",
      "Campamento cerrado",
      "Flujo de agua",
      "Flujo de aceite",
      "Cerca perimetral",
      "Limpieza de maleza",
      "Materia fecal"
    ]
  },
  {
    title: "INSTALACIONES / ALMACENES — MATERIAL DE EMPAQUE",
    conditional: true,
    items: [
      "Orden y limpieza",
      "Trampa",
      "Material sobre tarima",
      "Cajas cerradas",
      "Sanitizado completo"
    ]
  },
  {
    title: "ALMACÉN DE AGROQUÍMICOS",
    conditional: true,
    items: [
      "Orden y limpieza",
      "Productos etiquetados",
      "Equipo anti-derrame",
      "Productos correctamente almacenados",
      "Sanitizado completo"
    ]
  },
  {
    title: "INTRUSIÓN ANIMAL",
    items: [
      "Presencia de madrigueras",
      "Presencia de animales",
      "Evidencia de nidos",
      "Otras",
      "Observaciones"
    ]
  }
];

export function InspeccionPerimetral() {
  const [inspectionData, setInspectionData] = useState<InspeccionData>({});
  const [tieneAlmacen, setTieneAlmacen] = useState(true);
  const today = new Date().getDate();

  const toggleCell = (itemId: string, day: number) => {
    setInspectionData(prev => {
      const current = prev[itemId]?.[day];
      const next = current === null ? "SI" : current === "SI" ? "NO" : null;
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
    }
    return null;
  };

  const getCellStyle = (value: CellValue) => {
    if (value === "SI") return "bg-[#2B7AB5]";
    if (value === "NO") return "bg-[#C02A2A]";
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
            <h1 className="text-gray-900" style={{ fontWeight: 600 }}>Inspección Perimetral</h1>
            <div className="text-xs text-gray-600">Unidad de Producción · Semanal</div>
          </div>
        </div>
      </header>

      {/* Scrollable Calendar Grid */}
      <div className="relative">
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full">
            {/* Sticky Left Column */}
            <div className="sticky left-0 z-20 bg-white border-r border-black/10" style={{ minWidth: "180px" }}>
              {/* Header Cell */}
              <div className="h-10 bg-[#ececf0] border-b border-black/10 flex items-center px-3">
                <span className="text-xs text-gray-900" style={{ fontWeight: 600 }}>Item</span>
              </div>

              {/* Section Rows */}
              {sections.map((section, sIdx) => (
                <div key={sIdx}>
                  {/* Section Header */}
                  <div className="bg-[#ececf0] border-b border-black/10 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-gray-900" style={{ fontWeight: 600 }}>
                      {section.title}
                    </span>
                    {section.conditional && (
                      <button
                        onClick={() => setTieneAlmacen(!tieneAlmacen)}
                        className={`text-[10px] px-2 py-1 rounded transition-colors ${
                          tieneAlmacen
                            ? "bg-[#2B7AB5] text-white"
                            : "bg-[#cbced4] text-gray-600"
                        }`}
                        style={{ fontWeight: 600 }}
                      >
                        {tieneAlmacen ? "SI" : "NO"}
                      </button>
                    )}
                  </div>

                  {/* Items */}
                  {section.items.map((item, iIdx) => (
                    <div
                      key={`${sIdx}-${iIdx}`}
                      className={`h-10 border-b border-black/10 flex items-center px-3 ${
                        section.conditional && !tieneAlmacen
                          ? "bg-[#ececf0]"
                          : "bg-white"
                      }`}
                    >
                      <span
                        className={`text-xs ${
                          section.conditional && !tieneAlmacen
                            ? "text-[#717182]"
                            : "text-gray-900"
                        }`}
                      >
                        {item}
                      </span>
                    </div>
                  ))}
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
                      <div className="bg-[#ececf0] border-b border-black/10 h-[34px]" />

                      {/* Item Cells */}
                      {section.items.map((item, iIdx) => {
                        const itemId = `${sIdx}-${iIdx}`;
                        const value = inspectionData[itemId]?.[day];
                        const isDisabled = section.conditional && !tieneAlmacen;

                        return (
                          <button
                            key={itemId}
                            onClick={() => !isDisabled && toggleCell(itemId, day)}
                            disabled={isDisabled}
                            className={`w-full h-10 border-b border-r border-black/10 flex items-center justify-center transition-colors ${
                              isDisabled
                                ? "bg-[#ececf0] cursor-not-allowed"
                                : getCellStyle(value)
                            } ${day === today && !isDisabled ? "ring-1 ring-[#2B7AB5] ring-inset" : ""}`}
                          >
                            {!isDisabled && getCellContent(itemId, day)}
                          </button>
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
            <span className="text-gray-600">Iniciales:</span>{" "}
            <span className="text-gray-900" style={{ fontWeight: 600 }}>JP</span>
          </div>
          <div>
            <span className="text-gray-600">Realizó:</span>{" "}
            <span className="text-gray-900" style={{ fontWeight: 600 }}>Juan Pérez</span>
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
