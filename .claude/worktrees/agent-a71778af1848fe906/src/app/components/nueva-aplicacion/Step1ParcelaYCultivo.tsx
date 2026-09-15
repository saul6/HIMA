import { FormField } from "../FormField";
import { FormSelect } from "../FormSelect";
import { useRanchos } from "@/hooks/useRanchos";

interface Props {
  formData: any;
  updateFormData: (data: any) => void;
  onNext: () => void;
}

const phenologyOptions = [
  { value: "establecimiento", label: "Establecimiento" },
  { value: "floracion", label: "Floración" },
  { value: "cuajado", label: "Cuajado de fruto" },
  { value: "engorde", label: "Engorde" },
  { value: "produccion", label: "Producción" },
  { value: "cosecha", label: "Cosecha" },
];

export function Step1ParcelaYCultivo({ formData, updateFormData, onNext }: Props) {
  const { ranchos, loading: loadingRanchos } = useRanchos();

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: r.nombre }));

  const handleHuertoChange = (ranchoId: string) => {
    const selected = ranchos.find((r) => r.id === ranchoId);
    updateFormData({
      huerto: ranchoId,
      huertoCode: selected?.codigo ?? "",
      crop: selected?.cultivo ?? "",
    });
  };

  return (
    <div className="flex flex-col" style={{ gap: '16px' }}>
      {/* Encabezado de sección */}
      <div className="bg-agro-success-fill -mx-4 px-4 py-2">
        <h3 className="text-[13px] text-agro-success-text" style={{ fontWeight: 600 }}>
          INFORMACIÓN DE PARCELA Y CULTIVO
        </h3>
      </div>

      <FormField
        label="Productor"
        value={formData.producer}
        disabled
        onChange={() => {}}
      />

      <FormSelect
        label={loadingRanchos ? "Cargando ranchos..." : "Huerto / Rancho"}
        value={formData.huerto}
        onChange={handleHuertoChange}
        options={ranchoOptions}
      />

      <FormField
        label="Código de huerto"
        value={formData.huertoCode}
        disabled
        onChange={() => {}}
      />

      <FormField
        label="Cultivo"
        value={formData.crop}
        disabled
        onChange={() => {}}
      />

      <FormField
        label="Variedad"
        value={formData.variety}
        onChange={(value) => updateFormData({ variety: value })}
        placeholder="Ej: Heritage"
      />

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Sector"
          type="number"
          value={formData.sector}
          onChange={(value) => updateFormData({ sector: value })}
          placeholder="Ej: 3"
        />

        <FormField
          label="Superficie (ha)"
          type="number"
          value={formData.surface}
          onChange={(value) => updateFormData({ surface: value })}
          placeholder="Ej: 5.5"
        />
      </div>

      <FormSelect
        label="Etapa fenológica"
        value={formData.phenology}
        onChange={(value) => updateFormData({ phenology: value })}
        options={phenologyOptions}
      />

      {/* Encabezado de sección */}
      <div className="bg-agro-success-fill -mx-4 px-4 py-2">
        <h3 className="text-[13px] text-agro-success-text" style={{ fontWeight: 600 }}>
          FECHAS Y HORARIOS
        </h3>
      </div>

      <FormField
        label="Fecha recomendada por asesor"
        type="date"
        value={formData.recommendationDate}
        onChange={(value) => updateFormData({ recommendationDate: value })}
      />

      <FormField
        label="Fecha real de aplicación"
        type="date"
        value={formData.applicationDate}
        onChange={(value) => updateFormData({ applicationDate: value })}
      />

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Hora inicio"
          type="time"
          value={formData.startTime}
          onChange={(value) => updateFormData({ startTime: value })}
        />

        <FormField
          label="Hora fin"
          type="time"
          value={formData.endTime}
          onChange={(value) => updateFormData({ endTime: value })}
        />
      </div>

      {/* Botón Continuar */}
      <button
        onClick={onNext}
        className="w-full h-14 bg-primary text-white rounded-3xl hover:bg-agro-blue transition-colors"
        style={{ fontWeight: 600 }}
      >
        Continuar
      </button>
    </div>
  );
}
