import { useState } from "react";
import { Link } from "react-router";
import { Calendar, FileDown, ChevronDown } from "lucide-react";

const dateFilters = ["Hoy", "Esta semana", "Este mes", "Rango personalizado"];

const historyData = [
  {
    date: "2024-03-16",
    applications: [
      {
        id: "1",
        time: "08:30",
        product: "Mancozeb 80%",
        pest: "Botrytis cinerea",
        applicator: "Pedro García",
        type: "Foliar",
      },
      {
        id: "2",
        time: "14:15",
        product: "Lambda-cyhalotrin",
        pest: "Trips",
        applicator: "María López",
        type: "Foliar",
      },
    ],
  },
  {
    date: "2024-03-14",
    applications: [
      {
        id: "3",
        time: "09:00",
        product: "Azoxystrobin 25%",
        pest: "Oidio",
        applicator: "Pedro García",
        type: "Foliar",
      },
    ],
  },
  {
    date: "2024-03-12",
    applications: [
      {
        id: "4",
        time: "07:45",
        product: "Imidacloprid 35%",
        pest: "Pulgón",
        applicator: "Carlos Ramírez",
        type: "Drench",
      },
      {
        id: "5",
        time: "15:30",
        product: "Chlorothalonil",
        pest: "Antracnosis",
        applicator: "María López",
        type: "Foliar",
      },
    ],
  },
  {
    date: "2024-03-10",
    applications: [
      {
        id: "6",
        time: "08:00",
        product: "Cypermethrin",
        pest: "Araña roja",
        applicator: "Pedro García",
        type: "Foliar",
      },
    ],
  },
];

export function Historial() {
  const [activeFilter, setActiveFilter] = useState("Este mes");
  const [selectedRanch, setSelectedRanch] = useState("todos");

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleDateString("es-MX", { month: "short" });
    return `${day} ${month}`;
  };

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">
      {/* Header */}
      <header className="bg-white border-b border-black/10 px-4 py-4">
        <h1 className="text-gray-900 mb-4" style={{ fontWeight: 600 }}>
          Historial de Aplicaciones
        </h1>

        {/* Date Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {dateFilters.map((filter) => (
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
            <option value="el-valle">Huerto El Valle</option>
            <option value="las-flores">Huerto Las Flores</option>
            <option value="san-jose">Huerto San José</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
        </div>
      </header>

      {/* Timeline */}
      <div className="p-4 space-y-6">
        {historyData.map((day) => (
          <div key={day.date}>
            {/* Date Header */}
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-600" style={{ fontWeight: 600 }}>
                {formatDate(day.date)}
              </span>
            </div>

            {/* Applications for this date */}
            <div className="space-y-3 ml-6 border-l-2 border-gray-200 pl-4">
              {day.applications.map((app) => (
                <Link
                  key={app.id}
                  to={`/historial/${app.id}`}
                  className="block bg-white border border-black/10 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-600">{app.time}</span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            app.type === "Foliar"
                              ? "bg-[#E3F2FD] text-[#0D5A8F]"
                              : "bg-[#FAEEDA] text-[#854F0B]"
                          }`}
                        >
                          {app.type}
                        </span>
                      </div>
                      <div className="text-sm mb-1" style={{ fontWeight: 600 }}>
                        {app.product}
                      </div>
                      <div className="text-xs text-gray-600 mb-1">
                        Objetivo: {app.pest}
                      </div>
                      <div className="text-xs text-gray-600">
                        Por: {app.applicator}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Export FAB */}
      <button className="fixed bottom-[calc(72px+34px+16px)] right-4 w-14 h-14 bg-[#2B7AB5] rounded-full flex items-center justify-center shadow-lg z-10 hover:bg-[#1E88C7] transition-colors">
        <FileDown className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}