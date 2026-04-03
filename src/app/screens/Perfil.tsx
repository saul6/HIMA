import { ChevronRight, User, MapPin, Package, Users, Bell, LogOut } from "lucide-react";

const settingsItems = [
  { icon: MapPin, label: "Mis ranchos", path: "/ranchos" },
  { icon: Package, label: "Mis cultivos", path: "/cultivos" },
  { icon: Package, label: "Gestión de productos", path: "/productos" },
  { icon: Users, label: "Asesores", path: "/asesores" },
  { icon: Bell, label: "Notificaciones", path: "/notificaciones" },
];

export function Perfil() {
  return (
    <div className="min-h-full pb-[calc(72px+34px)]">
      {/* Header */}
      <header className="bg-white border-b border-black/10 px-4 py-4">
        <h1 className="text-gray-900" style={{ fontWeight: 600 }}>
          Perfil y Configuración
        </h1>
      </header>

      <div className="p-4 space-y-6">
        {/* User Profile Card */}
        <div className="bg-white border border-black/10 rounded-xl p-6">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 bg-[#2B7AB5] rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl" style={{ fontWeight: 600 }}>
                JP
              </span>
            </div>
            <div className="flex-1">
              <h2 className="text-gray-900 mb-1" style={{ fontWeight: 600 }}>
                Juan Pérez
              </h2>
              <div className="text-sm text-gray-600">Huerto El Valle</div>
              <div className="text-xs text-gray-600">
                Operador de campo · Hortifrut
              </div>
            </div>
          </div>
        </div>

        {/* Settings List */}
        <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
          {settingsItems.map((item, index) => (
            <button
              key={item.label}
              className={`w-full px-4 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                index !== settingsItems.length - 1 ? "border-b border-black/10" : ""
              }`}
            >
              <item.icon className="w-5 h-5 text-gray-600" />
              <span className="flex-1 text-left text-sm" style={{ fontWeight: 600 }}>
                {item.label}
              </span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          ))}
        </div>

        {/* App Info */}
        <div className="bg-white border border-black/10 rounded-xl p-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-[#2B7AB5] rounded-lg mx-auto mb-2 flex items-center justify-center">
              <span className="text-white text-sm" style={{ fontWeight: 600 }}>
                HF
              </span>
            </div>
            <div className="text-sm mb-1" style={{ fontWeight: 600 }}>
              AgroCampo
            </div>
            <div className="text-xs text-gray-600 mb-2">Versión 2.1.0</div>
            <div className="text-xs text-gray-600">
              © 2024 Hortifrut. Todos los derechos reservados.
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button className="w-full h-14 bg-white border border-[#C02A2A] text-[#C02A2A] rounded-xl flex items-center justify-center gap-2" style={{ fontWeight: 600 }}>
          <LogOut className="w-5 h-5" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}