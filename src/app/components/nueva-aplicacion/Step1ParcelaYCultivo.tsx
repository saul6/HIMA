import { FormField } from "../FormField";
import { FormSelect } from "../FormSelect";
import { useRanchos } from "@/hooks/useRanchos";
import { useMostrarCarga } from "@/hooks/useMostrarCarga";
import { Skeleton } from "@/app/components/ui/skeleton";

interface Props {
  formData: any;
  updateFormData: (data: any) => void;
  onNext: () => void;
  esCampo?: boolean;
}

const phenologyOptions = [
  { value: "establecimiento", label: "Establecimiento" },
  { value: "floracion", label: "Floración" },
  { value: "cuajado", label: "Cuajado de fruto" },
  { value: "engorde", label: "Engorde" },
  { value: "produccion", label: "Producción" },
  { value: "cosecha", label: "Cosecha" },
];

export function Step1ParcelaYCultivo({ formData, updateFormData, onNext, esCampo }: Props) {
  const { ranchos, loading: loadingRanchos } = useRanchos();
  const mostrarSkeletonRanchos = useMostrarCarga(loadingRanchos, ranchos.length > 0);

  const ranchoOptions = ranchos.map((r) => ({ value: r.id, label: r.nombre }));

  const handleHuertoChange = (ranchoId: string) => {
    const selected = ranchos.find((r) => r.id === ranchoId);
    updateFormData({
      huerto: ranchoId,
      huertoCode: selected?.codigo ?? "",
      crop: selected?.cultivo ?? "",
      productorId: selected?.productor_id ?? "",
    });
  };

  return (
    <div className="flex flex-col" style={{ gap: '16px' }}>
      {/* Encabezado de sección */}
      <div className="bg-agro-success-fill -mx-4 px-4 py-2">
        <h3 className="text-body text-agro-success-text font-semibold">
          INFORMACIÓN DE PARCELA Y CULTIVO
        </h3>
      </div>

      <FormField
        label="Productor"
        value={formData.producer}
        disabled
        onChange={() => {}}
      />

      {mostrarSkeletonRanchos ? (
        <Skeleton className="mt-3 h-16 w-full rounded-lg" aria-busy="true" aria-label="Cargando ranchos" />
      ) : (
        <FormSelect
          label="Huerto / Rancho"
          value={formData.huerto}
          onChange={handleHuertoChange}
          options={ranchoOptions}
        />
      )}

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
        <h3 className="text-body text-agro-success-text font-semibold">
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

      {/* Campo GlobalG.A.P.: próxima cosecha (solo sector Campo) */}
      {esCampo && (
        <FormField
          label="Próxima cosecha"
          type="date"
          value={formData.proximaCosecha}
          onChange={(value) => updateFormData({ proximaCosecha: value })}
        />
      )}

      {/* Botón Continuar */}
      <button
        onClick={onNext}
        className="w-full h-14 bg-primary text-white rounded-3xl hover:bg-agro-blue transition-colors font-semibold"
      >
        Continuar
      </button>
    </div>
  );
}
