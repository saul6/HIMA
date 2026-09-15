import { FormField } from "../FormField";
import { FormSelect } from "../FormSelect";

interface Props {
  formData: any;
  updateFormData: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

// cloro_ml = 5 × (total_agua_l / 200)  — se almacena en ml, limitado a 4 decimales
function calcularCloroMl(totalWater: string): string {
  const agua = parseFloat(totalWater);
  if (!agua || agua <= 0) return "";
  return parseFloat((5 * (agua / 200)).toFixed(4)).toString();
}

const equipmentOptions = [
  { value: "bomba-motor", label: "Bomba de motor" },
  { value: "bomba-manual", label: "Bomba manual" },
  { value: "aspersora-mochila", label: "Aspersora de mochila" },
];

const weatherConditions = [
  "Nublado",
  "Muy soleado",
  "Parcialmente soleado",
  "Lluvioso",
  "Lluvioso y nublado",
  "Viento",
  "Humedad",
];

const ppeItems = [
  "Traje protector",
  "Guantes",
  "Googles",
  "Botas",
  "Mascarillas",
];

export function Step3AplicacionYAgua({ formData, updateFormData, onNext, onBack }: Props) {
  const cloroMl = calcularCloroMl(formData.totalWater)

  const togglePPE = (item: string) => {
    updateFormData({
      ppe: {
        ...formData.ppe,
        [item]: !formData.ppe[item],
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Section Header */}
      <div className="bg-agro-success-fill -mx-4 px-4 py-2">
        <h3 className="text-[13px] text-agro-success-text" style={{ fontWeight: 600 }}>
          TIPO DE APLICACIÓN
        </h3>
      </div>

      {/* Application Type Toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => updateFormData({ applicationType: "Foliar" })}
          className={`flex-1 h-12 rounded-full transition-all ${
            formData.applicationType === "Foliar"
              ? "bg-primary text-white"
              : "bg-card border border-border text-foreground"
          }`}
          style={{ fontWeight: 600 }}
        >
          Foliar
        </button>
        <button
          onClick={() => updateFormData({ applicationType: "Drench" })}
          className={`flex-1 h-12 rounded-full transition-all ${
            formData.applicationType === "Drench"
              ? "bg-primary text-white"
              : "bg-card border border-border text-foreground"
          }`}
          style={{ fontWeight: 600 }}
        >
          Drench
        </button>
      </div>

      <FormSelect
        label="Equipo utilizado"
        value={formData.equipment}
        onChange={(value) => updateFormData({ equipment: value })}
        options={equipmentOptions}
      />

      <FormField
        label="Total agua utilizada (L)"
        type="number"
        value={formData.totalWater}
        onChange={(value) => updateFormData({ totalWater: value })}
        placeholder="Litros"
      />

      {/* Section Header */}
      <div className="bg-agro-success-fill -mx-4 px-4 py-2">
        <h3 className="text-[13px] text-agro-success-text" style={{ fontWeight: 600 }}>
          PREPARACIÓN DE AGUA
        </h3>
      </div>

      {/* Chlorination Toggle */}
      <div>
        <label className="text-xs text-gray-600 mb-2 block" style={{ fontWeight: 600 }}>
          Cloración
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => updateFormData({ chlorination: true })}
            className={`flex-1 h-12 rounded-full transition-all ${
              formData.chlorination
                ? "bg-[#2B7AB5] text-white"
                : "bg-white border border-gray-300 text-gray-700"
            }`}
            style={{ fontWeight: 600 }}
          >
            Sí
          </button>
          <button
            onClick={() => updateFormData({ chlorination: false })}
            className={`flex-1 h-12 rounded-full transition-all ${
              !formData.chlorination
                ? "bg-[#2B7AB5] text-white"
                : "bg-white border border-gray-300 text-gray-700"
            }`}
            style={{ fontWeight: 600 }}
          >
            No
          </button>
        </div>
      </div>

      {formData.chlorination && (
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Cloro calculado (ml)"
            value={cloroMl || (formData.totalWater ? '—' : 'Captura el agua primero')}
            onChange={() => {}}
            disabled
          />
          <FormField
            label="pH"
            type="number"
            value={formData.pH}
            onChange={(value) => updateFormData({ pH: value })}
          />
        </div>
      )}

      {/* Section Header */}
      <div className="bg-agro-success-fill -mx-4 px-4 py-2">
        <h3 className="text-[13px] text-agro-success-text" style={{ fontWeight: 600 }}>
          CONDICIONES CLIMÁTICAS
        </h3>
      </div>

      {/* Weather Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {weatherConditions.map((condition) => (
          <button
            key={condition}
            onClick={() => updateFormData({ weather: condition })}
            className={`flex-shrink-0 px-4 h-10 rounded-full transition-all whitespace-nowrap ${
              formData.weather === condition
                ? "bg-[#2B7AB5] text-white"
                : "bg-white border border-gray-300 text-gray-700"
            }`}
            style={{ fontWeight: 600 }}
          >
            {condition}
          </button>
        ))}
      </div>

      {/* Section Header */}
      <div className="bg-agro-success-fill -mx-4 px-4 py-2">
        <h3 className="text-[13px] text-agro-success-text" style={{ fontWeight: 600 }}>
          EQUIPO DE PROTECCIÓN PERSONAL (EPP)
        </h3>
      </div>

      {/* PPE Grid */}
      <div className="grid grid-cols-2 gap-3">
        {ppeItems.map((item) => (
          <button
            key={item}
            onClick={() => togglePPE(item)}
            className={`h-12 rounded-full transition-all ${
              formData.ppe[item]
                ? "bg-[#2B7AB5] text-white"
                : "bg-white border border-gray-300 text-gray-700"
            }`}
            style={{ fontWeight: 600 }}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="flex-1 h-14 border border-gray-300 text-gray-700 rounded-3xl"
          style={{ fontWeight: 600 }}
        >
          Atrás
        </button>
        <button
          onClick={onNext}
          className="flex-1 h-14 bg-primary text-white rounded-3xl hover:bg-agro-blue transition-colors"
          style={{ fontWeight: 600 }}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}