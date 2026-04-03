import { Link } from "react-router";
import { Calendar, Plus, CheckCircle, Clock, Shield, ClipboardCheck, Droplets, Sprout, Eye, Package, FileCheck, Waves } from "lucide-react";
import { metricas, aplicaciones, operarioActual } from "@/data/mock";

const inocuidadModules = [
  {
    id: "botiquin",
    title: "Botiquín de Primeros Auxilios",
    icon: Shield,
    lastEntry: "31 Mar",
    status: "Al día",
    frequency: "Semanal",
    path: "/inocuidad/botiquin"
  },
  {
    id: "vidrio",
    title: "Inspección de Vidrio y Plástico",
    icon: Eye,
    lastEntry: "30 Mar",
    status: "Al día",
    frequency: "Quincenal",
    path: "/inocuidad/vidrio-plastico"
  },
  {
    id: "fertilizacion",
    title: "Registro de Fertilización",
    icon: Sprout,
    lastEntry: "29 Mar",
    status: "Al día",
    frequency: "Por evento",
    path: "/inocuidad/fertilizacion"
  },
  {
    id: "perimetral",
    title: "Inspección Perimetral",
    icon: ClipboardCheck,
    lastEntry: "3 Abr",
    status: "Al día",
    frequency: "Semanal",
    path: "/inocuidad/perimetral"
  },
  {
    id: "cosecha",
    title: "Cosecha y Liberación",
    icon: Package,
    lastEntry: "1 Abr",
    status: "Al día",
    frequency: "Por evento",
    path: "/inocuidad/cosecha"
  },
  {
    id: "preoperacional",
    title: "Inspección Pre-operacional",
    icon: FileCheck,
    lastEntry: "3 Abr",
    status: "Al día",
    frequency: "Diario",
    path: "/inocuidad/preoperacional"
  },
  {
    id: "limpieza-banos",
    title: "Limpieza de Baños",
    icon: Droplets,
    lastEntry: "3 Abr",
    status: "Al día",
    frequency: "Diario",
    path: "/inocuidad/limpieza-banos"
  }
];

export function Home() {
  return (
    <div className="min-h-full pb-[calc(72px+34px)]">
      {/* Header */}
      <header className="bg-white border-b border-black/10 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo AgroCampo */}
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white text-xs" style={{ fontWeight: 600 }}>HF</span>
            </div>
            <span className="text-sm text-gray-900" style={{ fontWeight: 600 }}>AgroCampo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-sm" style={{ fontWeight: 600 }}>{operarioActual.nombre}</div>
              <div className="text-xs text-muted-foreground">{operarioActual.rancho}</div>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <span className="text-xs text-primary" style={{ fontWeight: 600 }}>En campo</span>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {metricas.map((metric, index) => (
            <div key={index} className="bg-white rounded-xl p-4 border border-black/10">
              <div className="text-2xl mb-1" style={{ fontWeight: 600 }}>{metric.value}</div>
              <div className="text-xs text-gray-600">{metric.label}</div>
            </div>
          ))}
        </div>

        {/* Próxima Recomendación Banner */}
        <div className="bg-agro-warning-fill rounded-xl p-4 flex items-start gap-3">
          <Calendar className="w-5 h-5 text-agro-warning-text flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm text-agro-warning-text mb-1" style={{ fontWeight: 600 }}>
              Próxima recomendación
            </div>
            <div className="text-sm text-agro-warning-text">
              20 Mar · Chlorothalonil + Mancozeb
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="mb-3 text-gray-900" style={{ fontWeight: 600 }}>Actividad reciente</h2>
          <div className="space-y-3">
            {aplicaciones.map((activity) => (
              <Link
                key={activity.id}
                to={`/historial/${activity.id}`}
                className="block bg-white rounded-xl p-4 border border-border"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        {activity.date}
                      </span>
                      {activity.status === "Completado" ? (
                        <span className="text-xs text-agro-success-text bg-agro-success-fill px-2 py-1 rounded flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Completado
                        </span>
                      ) : (
                        <span className="text-xs text-agro-warning-text bg-agro-warning-fill px-2 py-1 rounded flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pendiente
                        </span>
                      )}
                    </div>
                    <div className="text-sm mb-1" style={{ fontWeight: 600 }}>{activity.product}</div>
                    <div className="text-xs text-muted-foreground">{activity.pest}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Inocuidad y BPAs Section */}
        <div>
          <h2 className="mb-3 text-gray-900" style={{ fontWeight: 600 }}>Inocuidad y BPAs</h2>
          <div className="space-y-3">
            {inocuidadModules.map((module) => {
              const Icon = module.icon;
              const statusConfig = {
                "Al día": { bg: "#E3F2FD", text: "#0D5A8F" },
                "Pendiente": { bg: "#FAEEDA", text: "#854F0B" },
                "Vencido": { bg: "#FAECE7", text: "#993C1D" }
              }[module.status];

              return (
                <Link
                  key={module.id}
                  to={module.path}
                  className="block bg-white rounded-xl p-4 border border-black/10"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-agro-success-fill rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-sm text-gray-900" style={{ fontWeight: 600 }}>{module.title}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-600">{module.frequency}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-600">Última: {module.lastEntry}</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded ml-auto"
                          style={{
                            backgroundColor: statusConfig?.bg,
                            color: statusConfig?.text,
                            fontWeight: 600
                          }}
                        >
                          {module.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* FAB Button */}
      <Link
        to="/nueva-aplicacion"
        className="fixed bottom-[calc(72px+34px+16px)] right-4 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg z-10 max-w-[390px] hover:bg-agro-blue transition-colors"
      >
        <Plus className="w-6 h-6 text-white" />
      </Link>
    </div>
  );
}