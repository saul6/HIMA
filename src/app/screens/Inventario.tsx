import { useState } from "react";
import { Search, ScanBarcode, Plus, ChevronDown, ChevronUp } from "lucide-react";

const filterChips = ["Todos", "Insecticidas", "Fungicidas", "Adherentes", "Herbicidas"];

const inventoryData = [
  {
    id: "1",
    commercialName: "Mancozeb 80%",
    activeIngredient: "Mancozeb",
    category: "Fungicidas",
    stock: 45.5,
    unit: "kg",
    status: "available",
    lastMovement: "2024-03-15",
    movements: [
      { date: "2024-03-15", type: "Salida", quantity: -5.5, balance: 45.5 },
      { date: "2024-03-01", type: "Entrada", quantity: 50, balance: 51 },
    ],
  },
  {
    id: "2",
    commercialName: "Lambda-cyhalotrin 5%",
    activeIngredient: "Lambda-cyhalotrin",
    category: "Insecticidas",
    stock: 12.2,
    unit: "L",
    status: "low",
    lastMovement: "2024-03-14",
    movements: [
      { date: "2024-03-14", type: "Salida", quantity: -3.5, balance: 12.2 },
      { date: "2024-02-20", type: "Entrada", quantity: 15, balance: 15.7 },
    ],
  },
  {
    id: "3",
    commercialName: "Azoxystrobin 25%",
    activeIngredient: "Azoxystrobin",
    category: "Fungicidas",
    stock: 0,
    unit: "L",
    status: "empty",
    lastMovement: "2024-03-12",
    movements: [
      { date: "2024-03-12", type: "Salida", quantity: -4, balance: 0 },
      { date: "2024-02-15", type: "Entrada", quantity: 20, balance: 4 },
    ],
  },
  {
    id: "4",
    commercialName: "Imidacloprid 35%",
    activeIngredient: "Imidacloprid",
    category: "Insecticidas",
    stock: 28,
    unit: "L",
    status: "available",
    lastMovement: "2024-03-10",
    movements: [
      { date: "2024-03-10", type: "Salida", quantity: -2, balance: 28 },
      { date: "2024-02-28", type: "Entrada", quantity: 30, balance: 30 },
    ],
  },
];

export function Inventario() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const filteredInventory = inventoryData.filter((product) => {
    const matchesSearch =
      product.commercialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.activeIngredient.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      activeFilter === "Todos" || product.category === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: string, stock: number) => {
    if (status === "available") {
      return (
        <span className="text-xs px-2 py-1 bg-[#E3F2FD] text-[#0D5A8F] rounded">
          Disponible · {stock}
        </span>
      );
    } else if (status === "low") {
      return (
        <span className="text-xs px-2 py-1 bg-[#FAEEDA] text-[#854F0B] rounded">
          Bajo stock · {stock}
        </span>
      );
    } else {
      return (
        <span className="text-xs px-2 py-1 bg-[#FAECE7] text-[#993C1D] rounded">
          Agotado
        </span>
      );
    }
  };

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">
      {/* Header */}
      <header className="bg-white border-b border-black/10 px-4 py-4">
        <h1 className="text-gray-900" style={{ fontWeight: 600 }}>
          Inventario de Plaguicidas
        </h1>
      </header>

      <div className="p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar productos..."
            className="w-full h-12 pl-12 pr-12 rounded-lg border border-black/10 bg-white
              focus:outline-none focus:border-[#2B7AB5] focus:ring-1 focus:ring-[#2B7AB5]"
          />
          <button className="absolute right-4 top-1/2 -translate-y-1/2">
            <ScanBarcode className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {filterChips.map((filter) => (
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

        {/* Inventory List */}
        <div className="space-y-3">
          {filteredInventory.map((product) => {
            const isExpanded = expandedProduct === product.id;
            return (
              <div key={product.id} className="bg-white border border-black/10 rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm mb-1" style={{ fontWeight: 600 }}>
                        {product.commercialName}
                      </div>
                      <div className="text-xs text-gray-600 mb-2">
                        {product.activeIngredient}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>Último movimiento: {product.lastMovement}</span>
                      </div>
                    </div>
                    <div>{getStatusBadge(product.status, product.stock)}</div>
                  </div>

                  <button
                    onClick={() =>
                      setExpandedProduct(isExpanded ? null : product.id)
                    }
                    className="flex items-center gap-1 text-sm text-[#2B7AB5] hover:text-[#1E88C7]"
                    style={{ fontWeight: 600 }}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Ocultar historial
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Ver historial
                      </>
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-black/10 p-4 bg-gray-50">
                    <h4 className="text-xs text-gray-600 mb-2" style={{ fontWeight: 600 }}>
                      HISTORIAL DE MOVIMIENTOS
                    </h4>
                    <div className="space-y-2">
                      {product.movements.map((movement, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">
                              {movement.date}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                movement.type === "Entrada"
                                  ? "bg-[#E3F2FD] text-[#0D5A8F]"
                                  : "bg-[#FAECE7] text-[#993C1D]"
                              }`}
                            >
                              {movement.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                movement.quantity > 0
                                  ? "text-[#0D5A8F]"
                                  : "text-[#993C1D]"
                              }
                              style={{ fontWeight: 600 }}
                            >
                              {movement.quantity > 0 ? "+" : ""}
                              {movement.quantity} {product.unit}
                            </span>
                            <span className="text-gray-600">
                              → {movement.balance} {product.unit}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* FAB Button */}
      <button className="fixed bottom-[calc(72px+34px+16px)] right-4 w-14 h-14 bg-[#2B7AB5] rounded-full flex items-center justify-center shadow-lg z-10 hover:bg-[#1E88C7] transition-colors">
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}