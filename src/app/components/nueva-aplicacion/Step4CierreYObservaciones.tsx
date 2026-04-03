import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { FormField } from "../FormField";

interface Props {
  formData: any;
  updateFormData: (data: any) => void;
  onSave: () => void;
  onBack: () => void;
}

export function Step4CierreYObservaciones({ formData, updateFormData, onSave, onBack }: Props) {
  const [showSummary, setShowSummary] = useState(false);

  // Check if any PPE is missing
  const missingPPE = Object.entries(formData.ppe).filter(([_, value]) => !value);
  const hasPPEWarning = missingPPE.length > 0;

  return (
    <div className="space-y-6">
      {/* PPE Warning */}
      {hasPPEWarning && (
        <div className="bg-[#FAECE7] border border-[#993C1D]/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#993C1D] flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm text-[#993C1D] mb-1" style={{ fontWeight: 600 }}>
              Advertencia de EPP
            </div>
            <div className="text-sm text-[#993C1D]">
              {missingPPE.length} elemento(s) de protección no seleccionado(s)
            </div>
          </div>
        </div>
      )}

      {/* Section Header */}
      <div className="bg-[#E3F2FD] -mx-4 px-4 py-2">
        <h3 className="text-[13px] text-[#0D5A8F]" style={{ fontWeight: 600 }}>
          CALDOS SOBRANTES
        </h3>
      </div>

      {/* Leftover Toggle */}
      <div>
        <label className="text-xs text-gray-600 mb-2 block" style={{ fontWeight: 600 }}>
          ¿Hubo caldos sobrantes?
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => updateFormData({ leftover: true })}
            className={`flex-1 h-12 rounded-full transition-all ${
              formData.leftover
                ? "bg-[#2B7AB5] text-white"
                : "bg-white border border-gray-300 text-gray-700"
            }`}
            style={{ fontWeight: 600 }}
          >
            Sí
          </button>
          <button
            onClick={() => updateFormData({ leftover: false })}
            className={`flex-1 h-12 rounded-full transition-all ${
              !formData.leftover
                ? "bg-[#2B7AB5] text-white"
                : "bg-white border border-gray-300 text-gray-700"
            }`}
            style={{ fontWeight: 600 }}
          >
            No
          </button>
        </div>
      </div>

      {formData.leftover && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Cantidad (L)"
              type="number"
              value={formData.leftoverQuantity}
              onChange={(value) => updateFormData({ leftoverQuantity: value })}
            />
            <FormField
              label="Agua de lavado (L)"
              type="number"
              value={formData.washWater}
              onChange={(value) => updateFormData({ washWater: value })}
            />
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-2 block" style={{ fontWeight: 600 }}>
              ¿Se eliminó en área designada?
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => updateFormData({ eliminatedDesignatedArea: true })}
                className={`flex-1 h-12 rounded-full transition-all ${
                  formData.eliminatedDesignatedArea
                    ? "bg-[#2B7AB5] text-white"
                    : "bg-white border border-gray-300 text-gray-700"
                }`}
                style={{ fontWeight: 600 }}
              >
                Sí
              </button>
              <button
                onClick={() => updateFormData({ eliminatedDesignatedArea: false })}
                className={`flex-1 h-12 rounded-full transition-all ${
                  !formData.eliminatedDesignatedArea
                    ? "bg-[#2B7AB5] text-white"
                    : "bg-white border border-gray-300 text-gray-700"
                }`}
                style={{ fontWeight: 600 }}
              >
                No
              </button>
            </div>
          </div>
        </>
      )}

      {/* Section Header */}
      <div className="bg-[#E3F2FD] -mx-4 px-4 py-2">
        <h3 className="text-[13px] text-[#0D5A8F]" style={{ fontWeight: 600 }}>
          PERSONAL Y RESPONSABLES
        </h3>
      </div>

      <FormField
        label="Aplicador(es)"
        value={formData.applicators}
        onChange={(value) => updateFormData({ applicators: value })}
        placeholder="Nombres separados por comas"
      />

      <FormField
        label="Asesor técnico"
        value={formData.technicalAdvisor}
        onChange={(value) => updateFormData({ technicalAdvisor: value })}
        disabled
      />

      <FormField
        label="Responsable de inocuidad"
        value={formData.inocuidadResponsible}
        onChange={(value) => updateFormData({ inocuidadResponsible: value })}
        disabled
      />

      {/* Section Header */}
      <div className="bg-[#E3F2FD] -mx-4 px-4 py-2">
        <h3 className="text-[13px] text-[#0D5A8F]" style={{ fontWeight: 600 }}>
          OBSERVACIONES
        </h3>
      </div>

      <div className="relative">
        <textarea
          value={formData.observations}
          onChange={(e) => updateFormData({ observations: e.target.value })}
          placeholder="Observaciones adicionales..."
          className="w-full min-h-[100px] px-4 py-3 rounded-lg border border-black/10 bg-white
            focus:outline-none focus:border-[#2B7AB5] focus:ring-1 focus:ring-[#2B7AB5] resize-none"
        />
      </div>

      {/* Summary Card */}
      <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowSummary(!showSummary)}
          className="w-full px-4 py-3 flex items-center justify-between"
        >
          <span style={{ fontWeight: 600 }}>Resumen de aplicación</span>
          {showSummary ? (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          )}
        </button>

        {showSummary && (
          <div className="px-4 pb-4 space-y-3 text-sm border-t border-black/10 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-gray-600">Huerto:</div>
              <div style={{ fontWeight: 600 }}>{formData.huerto || "—"}</div>
              <div className="text-gray-600">Superficie:</div>
              <div style={{ fontWeight: 600 }}>{formData.surface} ha</div>
              <div className="text-gray-600">Productos:</div>
              <div style={{ fontWeight: 600 }}>{formData.products.length}</div>
              <div className="text-gray-600">Tipo:</div>
              <div style={{ fontWeight: 600 }}>{formData.applicationType}</div>
            </div>
          </div>
        )}
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
          onClick={onSave}
          className="flex-1 h-14 bg-[#2B7AB5] text-white rounded-3xl hover:bg-[#1E88C7] transition-colors"
          style={{ fontWeight: 600 }}
        >
          Guardar y generar PDF
        </button>
      </div>
    </div>
  );
}