import { CampoTexto, CampoSelect, SeccionPaso, Fila, PiePaso, EtiquetaGrupo } from "./controles";
import { Boton } from '@/app/components/ui-mady/Boton'
import { SelectorSegmentado } from '@/app/components/ui-mady/SelectorSegmentado'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { cn } from '@/app/components/ui/utils'

interface Props {
  formData: any;
  updateFormData: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
  esCampo?: boolean;
  /** Escritorio (≥ lg): acomodo en columnas y piezas estándar. */
  esLg?: boolean;
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

const metodoGgItems = ["Aspersión", "Espolvoreo", "Cloro", "Riego"];

// Opción de EPP en escritorio: píldora que se enciende y apaga (selección múltiple, igual que antes).
function PildoraEpp({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={cn(
        "h-9 px-4 rounded-full whitespace-nowrap text-sm border transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        activa
          ? "border-transparent bg-accent text-accent-foreground font-semibold"
          : "border-border bg-card text-foreground hover:bg-muted",
      )}
      style={{ transitionDuration: 'var(--motion-fast)' }}
    >
      {children}
    </button>
  )
}

export function Step3AplicacionYAgua({ formData, updateFormData, onNext, onBack, esCampo, esLg = false }: Props) {
  const cloroMl = calcularCloroMl(formData.totalWater)

  const togglePPE = (item: string) => {
    updateFormData({
      ppe: {
        ...formData.ppe,
        [item]: !formData.ppe[item],
      },
    });
  };

  // Botas / Lentes — toggle ambos simultáneamente
  const toggleBotasLentes = () => {
    const nuevo = !formData.ppe["Botas"];
    updateFormData({
      ppe: {
        ...formData.ppe,
        "Botas": nuevo,
        "Googles": nuevo,
      },
    });
  };

  const elegirMetodoGg = (metodo: string) => {
    const esCloro = metodo === "Cloro";
    updateFormData({
      metodoAplicacionGg: metodo,
      chlorination: esCloro,
    });
  };

  return (
    <div className={esLg ? "flex flex-col gap-5" : "flex flex-col gap-4"}>
      <SeccionPaso
        esLg={esLg}
        primera
        titulo={esCampo ? "Método de aplicación (GlobalG.A.P.)" : "Tipo de aplicación"}
        movil={esCampo ? "MÉTODO DE APLICACIÓN (GlobalG.A.P.)" : "TIPO DE APLICACIÓN"}
      />

      {esLg ? (
        esCampo ? (
          <SelectorSegmentado
            ariaLabel="Método de aplicación"
            className="self-start"
            value={formData.metodoAplicacionGg}
            onChange={elegirMetodoGg}
            options={metodoGgItems.map((m) => ({ value: m, label: m }))}
          />
        ) : (
          <SelectorSegmentado
            ariaLabel="Tipo de aplicación"
            className="self-start"
            value={formData.applicationType}
            onChange={(v) => updateFormData({ applicationType: v })}
            options={[{ value: "Foliar", label: "Foliar" }, { value: "Drench", label: "Drench" }]}
          />
        )
      ) : esCampo ? (
        /* GlobalG.A.P.: 4 chips de método */
        <div className="flex gap-2 overflow-x-auto pb-1">
          {metodoGgItems.map((metodo) => (
            <button
              key={metodo}
              onClick={() => elegirMetodoGg(metodo)}
              className={`flex-shrink-0 px-5 h-12 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] whitespace-nowrap ${
                formData.metodoAplicacionGg === metodo
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground"
              }`}
              style={{ fontWeight: 600 }}
            >
              {metodo}
            </button>
          ))}
        </div>
      ) : (
        /* Sector no-Campo: toggle Foliar/Drench original */
        <div className="flex gap-3">
          <button
            onClick={() => updateFormData({ applicationType: "Foliar" })}
            className={`flex-1 h-12 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] ${
              formData.applicationType === "Foliar"
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-foreground"
            }`}
            style={{ fontWeight: 600 }}
          >
            Foliar
          </button>
          <button
            onClick={() => updateFormData({ applicationType: "Drench" })}
            className={`flex-1 h-12 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] ${
              formData.applicationType === "Drench"
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-foreground"
            }`}
            style={{ fontWeight: 600 }}
          >
            Drench
          </button>
        </div>
      )}

      <Fila esLg={esLg}>
        <CampoSelect esLg={esLg} label="Equipo utilizado" value={formData.equipment} onChange={(value) => updateFormData({ equipment: value })} options={equipmentOptions} />
        <CampoTexto esLg={esLg} label="Total agua utilizada (L)" type="number" value={formData.totalWater} onChange={(value) => updateFormData({ totalWater: value })} placeholder="Litros" />
      </Fila>

      <SeccionPaso esLg={esLg} titulo="Preparación de agua" movil="PREPARACIÓN DE AGUA" />

      {/* Chlorination Toggle */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block font-semibold">
          Cloración
        </label>
        {esLg ? (
          <SelectorSegmentado
            ariaLabel="Cloración"
            value={formData.chlorination ? "si" : "no"}
            onChange={(v) => updateFormData({ chlorination: v === "si" })}
            options={[{ value: "si", label: "Sí" }, { value: "no", label: "No" }]}
          />
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => updateFormData({ chlorination: true })}
              className={`flex-1 h-12 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] ${
                formData.chlorination
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border-control text-foreground"
              }`}
              style={{ fontWeight: 600 }}
            >
              Sí
            </button>
            <button
              onClick={() => updateFormData({ chlorination: false })}
              className={`flex-1 h-12 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] ${
                !formData.chlorination
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border-control text-foreground"
              }`}
              style={{ fontWeight: 600 }}
            >
              No
            </button>
          </div>
        )}
      </div>

      {formData.chlorination && (
        <Fila esLg={esLg} movil2>
          <CampoTexto
            esLg={esLg}
            label="Cloro calculado (ml)"
            value={cloroMl || (formData.totalWater ? '—' : 'Captura el agua primero')}
            onChange={() => {}}
            disabled
          />
          <CampoTexto esLg={esLg} label="pH" type="number" value={formData.pH} onChange={(value) => updateFormData({ pH: value })} />
        </Fila>
      )}

      <SeccionPaso esLg={esLg} titulo="Condiciones climáticas" movil="CONDICIONES CLIMÁTICAS" />

      {/* Weather Chips */}
      {esLg ? (
        <div className="flex flex-wrap gap-2">
          <FiltroPildoras
            options={weatherConditions}
            value={formData.weather}
            onChange={(condition) => updateFormData({ weather: condition })}
          />
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {weatherConditions.map((condition) => (
            <button
              key={condition}
              onClick={() => updateFormData({ weather: condition })}
              className={`flex-shrink-0 px-4 h-10 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] whitespace-nowrap ${
                formData.weather === condition
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border-control text-foreground"
              }`}
              style={{ fontWeight: 600 }}
            >
              {condition}
            </button>
          ))}
        </div>
      )}

      <SeccionPaso esLg={esLg} titulo="Equipo de protección personal (EPP)" movil="EQUIPO DE PROTECCIÓN PERSONAL (EPP)" />

      {esLg ? (
        <div className="flex flex-wrap gap-2">
          {esCampo ? (
            <>
              <PildoraEpp activa={!!formData.ppe["Traje protector"]} onClick={() => togglePPE("Traje protector")}>Traje</PildoraEpp>
              <PildoraEpp activa={!!formData.ppe["Mascarillas"]} onClick={() => togglePPE("Mascarillas")}>Mascarilla</PildoraEpp>
              <PildoraEpp activa={!!formData.ppe["Botas"]} onClick={toggleBotasLentes}>Botas / Lentes</PildoraEpp>
              <PildoraEpp activa={!!formData.ppe["Guantes"]} onClick={() => togglePPE("Guantes")}>Guantes de nitrilo</PildoraEpp>
            </>
          ) : (
            ppeItems.map((item) => (
              <PildoraEpp key={item} activa={!!formData.ppe[item]} onClick={() => togglePPE(item)}>{item}</PildoraEpp>
            ))
          )}
        </div>
      ) : esCampo ? (
        /* Campo: 4 items GlobalG.A.P. */
        <div className="grid grid-cols-2 gap-3">
          {/* Traje */}
          <button
            onClick={() => togglePPE("Traje protector")}
            className={`h-12 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] ${
              formData.ppe["Traje protector"]
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-foreground"
            }`}
            style={{ fontWeight: 600 }}
          >
            Traje
          </button>
          {/* Mascarilla */}
          <button
            onClick={() => togglePPE("Mascarillas")}
            className={`h-12 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] ${
              formData.ppe["Mascarillas"]
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-foreground"
            }`}
            style={{ fontWeight: 600 }}
          >
            Mascarilla
          </button>
          {/* Botas / Lentes — toggle ambos simultáneamente */}
          <button
            onClick={toggleBotasLentes}
            className={`h-12 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] ${
              formData.ppe["Botas"]
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-foreground"
            }`}
            style={{ fontWeight: 600 }}
          >
            Botas / Lentes
          </button>
          {/* Guantes de nitrilo */}
          <button
            onClick={() => togglePPE("Guantes")}
            className={`h-12 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] ${
              formData.ppe["Guantes"]
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-foreground"
            }`}
            style={{ fontWeight: 600 }}
          >
            Guantes de nitrilo
          </button>
        </div>
      ) : (
        /* No-Campo: 5 items originales */
        <div className="grid grid-cols-2 gap-3">
          {ppeItems.map((item) => (
            <button
              key={item}
              onClick={() => togglePPE(item)}
              className={`h-12 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] ${
                formData.ppe[item]
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border-control text-foreground"
              }`}
              style={{ fontWeight: 600 }}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {/* Navigation Buttons */}
      {esLg ? (
        <PiePaso onBack={onBack} onNext={onNext} />
      ) : (
        <div className="flex gap-3 pt-4">
          <button
            onClick={onBack}
            className="flex-1 h-14 border border-border-control text-foreground rounded-3xl font-semibold"
          >
            Atrás
          </button>
          <Boton
            onClick={onNext}
            className="flex-1 h-14 rounded-3xl"
          >
            Continuar
          </Boton>
        </div>
      )}
    </div>
  );
}
