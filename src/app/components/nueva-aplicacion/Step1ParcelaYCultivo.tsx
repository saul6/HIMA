import { CampoTexto, CampoSelect, SeccionPaso, Fila, PiePaso } from "./controles";
import { useRanchos } from "@/hooks/useRanchos";
import { useMostrarCarga } from "@/hooks/useMostrarCarga";
import { Skeleton } from "@/app/components/ui/skeleton";
import { limiteTexto } from '@/lib/limitesTexto'
import { Boton } from '@/app/components/ui-mady/Boton'

interface Props {
  formData: any;
  updateFormData: (data: any) => void;
  onNext: () => void;
  esCampo?: boolean;
  /** Escritorio (≥ lg): acomodo en columnas y piezas estándar. */
  esLg?: boolean;
}

const phenologyOptions = [
  { value: "establecimiento", label: "Establecimiento" },
  { value: "floracion", label: "Floración" },
  { value: "cuajado", label: "Cuajado de fruto" },
  { value: "engorde", label: "Engorde" },
  { value: "produccion", label: "Producción" },
  { value: "cosecha", label: "Cosecha" },
];

export function Step1ParcelaYCultivo({ formData, updateFormData, onNext, esCampo, esLg = false }: Props) {
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
    <div className={esLg ? "flex flex-col gap-5" : "flex flex-col"} style={esLg ? undefined : { gap: '16px' }}>
      <SeccionPaso esLg={esLg} primera titulo="Información de parcela y cultivo" movil="INFORMACIÓN DE PARCELA Y CULTIVO" />

      <Fila esLg={esLg}>
        <CampoTexto esLg={esLg} label="Productor" value={formData.producer} disabled onChange={() => {}} />

        {mostrarSkeletonRanchos ? (
          <Skeleton className="mt-3 h-16 w-full rounded-lg lg:mt-0 lg:h-10" aria-busy="true" aria-label="Cargando ranchos" />
        ) : (
          <CampoSelect esLg={esLg} requerido label="Huerto / Rancho" value={formData.huerto} onChange={handleHuertoChange} options={ranchoOptions} />
        )}
      </Fila>

      <Fila esLg={esLg} cols={3}>
        <CampoTexto esLg={esLg} label="Código de huerto" value={formData.huertoCode} disabled onChange={() => {}} />
        <CampoTexto esLg={esLg} label="Cultivo" value={formData.crop} disabled onChange={() => {}} />
        <CampoTexto
          esLg={esLg}
          maxLength={limiteTexto('aplicaciones', 'variedad')}
          label="Variedad"
          value={formData.variety}
          onChange={(value) => updateFormData({ variety: value })}
          placeholder="Ej: Heritage"
        />
      </Fila>

      <Fila esLg={esLg} cols={3}>
        <div className="grid grid-cols-2 gap-3 lg:contents">
          <CampoTexto esLg={esLg} label="Sector" type="number" value={formData.sector} onChange={(value) => updateFormData({ sector: value })} placeholder="Ej: 3" />
          <CampoTexto esLg={esLg} label="Superficie (ha)" type="number" value={formData.surface} onChange={(value) => updateFormData({ surface: value })} placeholder="Ej: 5.5" />
        </div>
        <CampoSelect esLg={esLg} label="Etapa fenológica" value={formData.phenology} onChange={(value) => updateFormData({ phenology: value })} options={phenologyOptions} />
      </Fila>

      <SeccionPaso esLg={esLg} titulo="Fechas y horarios" movil="FECHAS Y HORARIOS" />

      <Fila esLg={esLg}>
        <CampoTexto esLg={esLg} label="Fecha recomendada por asesor" type="date" value={formData.recommendationDate} onChange={(value) => updateFormData({ recommendationDate: value })} />
        <CampoTexto esLg={esLg} requerido label="Fecha real de aplicación" type="date" value={formData.applicationDate} onChange={(value) => updateFormData({ applicationDate: value })} />
      </Fila>

      <Fila esLg={esLg} movil2>
        <CampoTexto esLg={esLg} label="Hora inicio" type="time" value={formData.startTime} onChange={(value) => updateFormData({ startTime: value })} />
        <CampoTexto esLg={esLg} label="Hora fin" type="time" value={formData.endTime} onChange={(value) => updateFormData({ endTime: value })} />
      </Fila>

      {/* Campo GlobalG.A.P.: próxima cosecha (solo sector Campo) */}
      {esCampo && (
        <Fila esLg={esLg}>
          <CampoTexto esLg={esLg} label="Próxima cosecha" type="date" value={formData.proximaCosecha} onChange={(value) => updateFormData({ proximaCosecha: value })} />
        </Fila>
      )}

      {/* Botón Continuar */}
      {esLg ? (
        <PiePaso onNext={onNext} />
      ) : (
        <Boton onClick={onNext} className="w-full h-14 rounded-3xl">
          Continuar
        </Boton>
      )}
    </div>
  );
}
