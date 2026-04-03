import { FormField } from "../FormField";
import { FormSelect } from "../FormSelect";

interface Props {
  formData: any;
  updateFormData: (data: any) => void;
  onNext: () => void;
}

const huertoOptions = [
  { value: "el-valle", label: "Huerto El Valle", code: "HV-001" },
  { value: "las-flores", label: "Huerto Las Flores", code: "HF-002" },
  { value: "san-jose", label: "Huerto San José", code: "SJ-003" },
];

const phenologyOptions = [
  { value: "establecimiento", label: "Establecimiento" },
  { value: "floracion", label: "Floración" },
  { value: "cuajado", label: "Cuajado de fruto" },
  { value: "engorde", label: "Engorde" },
  { value: "produccion", label: "Producción" },
  { value: "cosecha", label: "Cosecha" },
];

export function Step1ParcelaYCultivo({ formData, updateFormData, onNext }: Props) {
  const handleHuertoChange = (value: string) => {
    const selected = huertoOptions.find((h) => h.value === value);
    updateFormData({
      huerto: value,
      huertoCode: selected?.code || "",
    });
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="bg-[#E3F2FD] -mx-4 px-4 py-2">
        <h3 className="text-[13px] text-[#0D5A8F]" style={{ fontWeight: 600 }}>
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
        label="Huerto / Ranch"
        value={formData.huerto}
        onChange={handleHuertoChange}
        options={huertoOptions}
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

      {/* Section Header */}
      <div className="bg-[#E3F2FD] -mx-4 px-4 py-2">
        <h3 className="text-[13px] text-[#0D5A8F]" style={{ fontWeight: 600 }}>
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

      {/* Next Button */}
      <button
        onClick={onNext}
        className="w-full h-14 bg-[#2B7AB5] text-white rounded-3xl mt-6 hover:bg-[#1E88C7] transition-colors"
        style={{ fontWeight: 600 }}
      >
        Continuar
      </button>
    </div>
  );
}