import { useNavigate, useParams } from "react-router";
import { X, CheckCircle } from "lucide-react";

// Mock data - in real app this would come from a data store
const mockApplicationData = {
  id: "1",
  status: "Completado",
  date: "2024-03-16",
  time: "08:30",
  producer: "Juan Pérez",
  huerto: "Huerto El Valle",
  huertoCode: "HV-001",
  crop: "Frambuesa",
  variety: "Heritage",
  sector: "3",
  surface: "5.5",
  phenology: "Producción",
  recommendationDate: "2024-03-15",
  applicationDate: "2024-03-16",
  startTime: "08:30",
  endTime: "10:15",
  products: [
    {
      commercialName: "Mancozeb 80%",
      activeIngredient: "Mancozeb",
      rsco: "RSCO-0045-2019",
      pest: "Botrytis cinerea",
      infestationLevel: "Medio",
      dosePerHa: "2.5",
      dosePer200L: "500",
      totalProduct: "13.75",
      daysToHarvest: "7",
      reentryTime: "24",
    },
  ],
  applicationType: "Foliar",
  equipment: "Bomba de motor",
  totalWater: "2750",
  chlorination: true,
  chlorineQuantity: "0.5",
  pH: "6.5",
  weather: "Parcialmente soleado",
  ppe: {
    "Traje protector": true,
    "Guantes": true,
    "Googles": true,
    "Botas": true,
    "Mascarillas": true,
  },
  leftover: false,
  applicator: "Pedro García",
  technicalAdvisor: "María González",
  inocuidadResponsible: "Carlos Ramírez",
  observations: "Aplicación realizada según recomendación técnica. Condiciones climáticas favorables.",
};

export function DetalleAplicacion() {
  const navigate = useNavigate();
  const { id } = useParams();

  const data = mockApplicationData; // In real app, fetch by id

  return (
    <div className="min-h-full bg-white pb-[calc(72px+34px+64px)]">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-black/10 px-4 py-4 z-20">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-gray-900 flex-1" style={{ fontWeight: 600 }}>
            Detalle de Aplicación
          </h1>
          <button onClick={() => navigate("/historial")} className="p-1">
            <X className="w-6 h-6 text-gray-900" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 bg-[#E3F2FD] text-[#0D5A8F] rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            {data.status}
          </span>
          <span className="text-sm text-gray-600">
            {data.date} · {data.time}
          </span>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="p-4 space-y-6">
        {/* Parcela y Cultivo */}
        <div>
          <div className="bg-[#E3F2FD] -mx-4 px-4 py-2 mb-4">
            <h3 className="text-[13px] text-[#0D5A8F]" style={{ fontWeight: 600 }}>
              INFORMACIÓN DE PARCELA Y CULTIVO
            </h3>
          </div>
          <div className="space-y-3">
            <DataRow label="Productor" value={data.producer} />
            <DataRow label="Huerto" value={data.huerto} />
            <DataRow label="Código de huerto" value={data.huertoCode} />
            <DataRow label="Cultivo" value={data.crop} />
            <DataRow label="Variedad" value={data.variety} />
            <div className="grid grid-cols-2 gap-4">
              <DataRow label="Sector" value={data.sector} />
              <DataRow label="Superficie" value={`${data.surface} ha`} />
            </div>
            <DataRow label="Etapa fenológica" value={data.phenology} />
            <DataRow
              label="Fecha recomendación"
              value={data.recommendationDate}
            />
            <DataRow label="Fecha aplicación" value={data.applicationDate} />
            <div className="grid grid-cols-2 gap-4">
              <DataRow label="Hora inicio" value={data.startTime} />
              <DataRow label="Hora fin" value={data.endTime} />
            </div>
          </div>
        </div>

        {/* Productos */}
        <div>
          <div className="bg-[#E3F2FD] -mx-4 px-4 py-2 mb-4">
            <h3 className="text-[13px] text-[#0D5A8F]" style={{ fontWeight: 600 }}>
              PRODUCTOS APLICADOS
            </h3>
          </div>
          {data.products.map((product, index) => (
            <div key={index} className="mb-4 pb-4 border-b border-gray-200 last:border-0">
              <div className="text-sm mb-3" style={{ fontWeight: 600 }}>
                {product.commercialName}
              </div>
              <div className="space-y-3">
                <DataRow
                  label="Ingrediente activo"
                  value={product.activeIngredient}
                />
                <DataRow label="RSCO" value={product.rsco} />
                <DataRow label="Objetivo" value={product.pest} />
                <DataRow
                  label="Nivel infestación"
                  value={product.infestationLevel}
                />
                <div className="grid grid-cols-2 gap-4">
                  <DataRow label="Dosis/ha" value={`${product.dosePerHa} kg`} />
                  <DataRow
                    label="Dosis/200L"
                    value={`${product.dosePer200L} g`}
                  />
                </div>
                <DataRow
                  label="Total usado"
                  value={`${product.totalProduct} kg`}
                />
                <div className="grid grid-cols-2 gap-4">
                  <DataRow
                    label="Días a cosecha"
                    value={`${product.daysToHarvest} días`}
                  />
                  <DataRow
                    label="Reentrada"
                    value={`${product.reentryTime} hrs`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Aplicación y Agua */}
        <div>
          <div className="bg-[#E3F2FD] -mx-4 px-4 py-2 mb-4">
            <h3 className="text-[13px] text-[#0D5A8F]" style={{ fontWeight: 600 }}>
              APLICACIÓN Y AGUA
            </h3>
          </div>
          <div className="space-y-3">
            <DataRow label="Tipo de aplicación" value={data.applicationType} />
            <DataRow label="Equipo" value={data.equipment} />
            <DataRow label="Agua utilizada" value={`${data.totalWater} L`} />
            <DataRow label="Cloración" value={data.chlorination ? "Sí" : "No"} />
            {data.chlorination && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <DataRow label="Cantidad cloro" value={`${data.chlorineQuantity} L`} />
                  <DataRow label="pH" value={data.pH} />
                </div>
              </>
            )}
            <DataRow label="Condiciones climáticas" value={data.weather} />
          </div>
        </div>

        {/* EPP */}
        <div>
          <div className="bg-[#E3F2FD] -mx-4 px-4 py-2 mb-4">
            <h3 className="text-[13px] text-[#0D5A8F]" style={{ fontWeight: 600 }}>
              EQUIPO DE PROTECCIÓN PERSONAL
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data.ppe).map(([item, used]) => (
              <div
                key={item}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  used ? "bg-[#E3F2FD]" : "bg-gray-100"
                }`}
              >
                {used ? (
                  <CheckCircle className="w-4 h-4 text-[#0D5A8F]" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-400" />
                )}
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Personal */}
        <div>
          <div className="bg-[#E3F2FD] -mx-4 px-4 py-2 mb-4">
            <h3 className="text-[13px] text-[#0D5A8F]" style={{ fontWeight: 600 }}>
              PERSONAL Y RESPONSABLES
            </h3>
          </div>
          <div className="space-y-3">
            <DataRow label="Aplicador" value={data.applicator} />
            <DataRow label="Asesor técnico" value={data.technicalAdvisor} />
            <DataRow
              label="Responsable inocuidad"
              value={data.inocuidadResponsible}
            />
          </div>
        </div>

        {/* Observations */}
        {data.observations && (
          <div>
            <div className="bg-[#E3F2FD] -mx-4 px-4 py-2 mb-4">
              <h3 className="text-[13px] text-[#0D5A8F]" style={{ fontWeight: 600 }}>
                OBSERVACIONES
              </h3>
            </div>
            <p className="text-sm text-gray-700">{data.observations}</p>
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-[calc(72px+34px)] left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-black/10 p-4 flex gap-3">
        <button className="flex-1 h-12 border border-[#2B7AB5] text-[#2B7AB5] rounded-xl hover:bg-[#E3F2FD] transition-colors" style={{ fontWeight: 600 }}>
          Exportar PDF
        </button>
        <button className="flex-1 h-12 bg-[#2B7AB5] text-white rounded-xl hover:bg-[#1E88C7] transition-colors" style={{ fontWeight: 600 }}>
          Editar
        </button>
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm text-right" style={{ fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}