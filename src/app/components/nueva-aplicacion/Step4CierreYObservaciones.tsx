import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { CampoTexto, SeccionPaso, Fila, PiePaso } from "./controles";
import { TextareaContador } from '@/app/components/TextareaContador'
import { limiteTexto } from '@/lib/limitesTexto'
import { Boton } from '@/app/components/ui-mady/Boton'
import { SelectorSegmentado } from '@/app/components/ui-mady/SelectorSegmentado'

interface Props {
  formData: any;
  updateFormData: (data: any) => void;
  onSave: () => void;
  onBack: () => void;
  saving?: boolean;
  /** Escritorio (≥ lg): acomodo en columnas y piezas estándar. */
  esLg?: boolean;
}

const OPCIONES_SI_NO = [{ value: "si", label: "Sí" }, { value: "no", label: "No" }]

export function Step4CierreYObservaciones({ formData, updateFormData, onSave, onBack, saving = false, esLg = false }: Props) {
  const [showSummary, setShowSummary] = useState(false);

  // Check if any PPE is missing
  const missingPPE = Object.entries(formData.ppe).filter(([_, value]) => !value);
  const hasPPEWarning = missingPPE.length > 0;

  return (
    <div className={esLg ? "flex flex-col gap-5" : "flex flex-col gap-4"}>
      {/* PPE Warning */}
      {hasPPEWarning && (
        <div className="bg-agro-danger-fill border border-agro-danger-text/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-agro-danger-text flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm text-agro-danger-text mb-1 font-semibold">
              Advertencia de EPP
            </div>
            <div className="text-sm text-agro-danger-text">
              {missingPPE.length} elemento(s) de protección no seleccionado(s)
            </div>
          </div>
        </div>
      )}

      <SeccionPaso esLg={esLg} primera={!hasPPEWarning} titulo="Caldos sobrantes" movil="CALDOS SOBRANTES" />

      {/* Leftover Toggle */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block font-semibold">
          ¿Hubo caldos sobrantes?
        </label>
        {esLg ? (
          <SelectorSegmentado
            ariaLabel="¿Hubo caldos sobrantes?"
            value={formData.leftover ? "si" : "no"}
            onChange={(v) => updateFormData({ leftover: v === "si" })}
            options={OPCIONES_SI_NO}
          />
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => updateFormData({ leftover: true })}
              className={`flex-1 h-12 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] ${
                formData.leftover
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground"
              }`}
              style={{ fontWeight: 600 }}
            >
              Sí
            </button>
            <button
              onClick={() => updateFormData({ leftover: false })}
              className={`flex-1 h-12 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] ${
                !formData.leftover
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground"
              }`}
              style={{ fontWeight: 600 }}
            >
              No
            </button>
          </div>
        )}
      </div>

      {formData.leftover && (
        <>
          <Fila esLg={esLg} movil2>
            <CampoTexto esLg={esLg} label="Cantidad (L)" type="number" value={formData.leftoverQuantity} onChange={(value) => updateFormData({ leftoverQuantity: value })} />
            <CampoTexto esLg={esLg} label="Agua de lavado (L)" type="number" value={formData.washWater} onChange={(value) => updateFormData({ washWater: value })} />
          </Fila>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block font-semibold">
              ¿Se eliminó en área designada?
            </label>
            {esLg ? (
              <SelectorSegmentado
                ariaLabel="¿Se eliminó en área designada?"
                value={formData.eliminatedDesignatedArea ? "si" : "no"}
                onChange={(v) => updateFormData({ eliminatedDesignatedArea: v === "si" })}
                options={OPCIONES_SI_NO}
              />
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => updateFormData({ eliminatedDesignatedArea: true })}
                  className={`flex-1 h-12 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] ${
                    formData.eliminatedDesignatedArea
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  }`}
                  style={{ fontWeight: 600 }}
                >
                  Sí
                </button>
                <button
                  onClick={() => updateFormData({ eliminatedDesignatedArea: false })}
                  className={`flex-1 h-12 rounded-full transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] ${
                    !formData.eliminatedDesignatedArea
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  }`}
                  style={{ fontWeight: 600 }}
                >
                  No
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <SeccionPaso esLg={esLg} titulo="Personal y responsables" movil="PERSONAL Y RESPONSABLES" />

      <CampoTexto
        esLg={esLg}
        maxLength={limiteTexto('aplicaciones', 'aplicadores')}
        label="Aplicador(es)"
        value={formData.applicators}
        onChange={(value) => updateFormData({ applicators: value })}
        placeholder="Nombres separados por comas"
      />

      <Fila esLg={esLg}>
        <CampoTexto esLg={esLg} label="Asesor técnico" value={formData.technicalAdvisor} onChange={(value) => updateFormData({ technicalAdvisor: value })} disabled />
        <CampoTexto esLg={esLg} label="Responsable de inocuidad" value={formData.inocuidadResponsible} onChange={(value) => updateFormData({ inocuidadResponsible: value })} disabled />
      </Fila>

      <SeccionPaso esLg={esLg} titulo="Observaciones" movil="OBSERVACIONES" />

      <div className="relative">
        <TextareaContador limite={limiteTexto('aplicaciones', 'observaciones')}
          value={formData.observations}
          onChange={(e) => updateFormData({ observations: e.target.value })}
          placeholder="Observaciones adicionales..."
          aria-label="Observaciones"
          className="w-full min-h-[100px] px-4 py-3 rounded-lg border border-border-control bg-input-background text-foreground placeholder:text-muted-foreground
            focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
        />
      </div>

      {/* Summary Card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowSummary(!showSummary)}
          className="w-full px-4 py-3 flex items-center justify-between text-foreground"
        >
          <span className="font-semibold">Resumen de aplicación</span>
          {showSummary ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        {showSummary && (
          <div className="px-4 pb-4 space-y-3 text-sm border-t border-border pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-muted-foreground">Huerto:</div>
              <div className="font-semibold">{formData.huerto || "—"}</div>
              <div className="text-muted-foreground">Superficie:</div>
              <div className="font-semibold">{formData.surface} ha</div>
              <div className="text-muted-foreground">Productos:</div>
              <div className="font-semibold">{formData.products.length}</div>
              <div className="text-muted-foreground">Tipo:</div>
              <div className="font-semibold">{formData.applicationType}</div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      {esLg ? (
        <PiePaso onBack={onBack} onNext={onSave} deshabilitado={saving} textoNext={saving ? "Guardando..." : "Guardar y generar PDF"} />
      ) : (
        <div className="flex gap-3 pt-4">
          <button
            onClick={onBack}
            className="flex-1 h-14 border border-border text-foreground rounded-3xl font-semibold"
          >
            Atrás
          </button>
          <Boton
            onClick={onSave}
            disabled={saving}
            className="flex-1 h-14 rounded-3xl"
          >
            {saving ? "Guardando..." : "Guardar y generar PDF"}
          </Boton>
        </div>
      )}
    </div>
  );
}
