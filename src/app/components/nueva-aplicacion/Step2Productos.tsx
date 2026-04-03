import { useState } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { FormField } from "../FormField";
import { FormSelect } from "../FormSelect";

interface Props {
  formData: any;
  updateFormData: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const productOptions = [
  { value: "mancozeb", label: "Mancozeb 80%", ingredient: "Mancozeb", rsco: "RSCO-0045-2019" },
  { value: "lambda", label: "Lambda-cyhalotrin 5%", ingredient: "Lambda-cyhalotrin", rsco: "RSCO-0123-2020" },
  { value: "azoxy", label: "Azoxystrobin 25%", ingredient: "Azoxystrobin", rsco: "RSCO-0089-2021" },
  { value: "imida", label: "Imidacloprid 35%", ingredient: "Imidacloprid", rsco: "RSCO-0156-2018" },
];

const pestOptions = [
  { value: "botrytis", label: "Botrytis cinerea" },
  { value: "oidio", label: "Oidio" },
  { value: "trips", label: "Trips" },
  { value: "pulgon", label: "Pulgón" },
  { value: "araña", label: "Araña roja" },
];

const infestationLevels = ["Bajo", "Medio", "Alto"];

export function Step2Productos({ formData, updateFormData, onNext, onBack }: Props) {
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<any>({
    commercialName: "",
    activeIngredient: "",
    rsco: "",
    pest: "",
    infestationLevel: "",
    dosePerHa: "",
    dosePer200L: "",
    totalProduct: "",
    daysToHarvest: "",
    reentryTime: "",
  });

  const handleProductSelect = (value: string) => {
    const selected = productOptions.find((p) => p.value === value);
    if (selected) {
      setCurrentProduct({
        ...currentProduct,
        commercialName: value,
        activeIngredient: selected.ingredient,
        rsco: selected.rsco,
      });
    }
  };

  const addProduct = () => {
    if (currentProduct.commercialName) {
      updateFormData({
        products: [...formData.products, currentProduct],
      });
      setCurrentProduct({
        commercialName: "",
        activeIngredient: "",
        rsco: "",
        pest: "",
        infestationLevel: "",
        dosePerHa: "",
        dosePer200L: "",
        totalProduct: "",
        daysToHarvest: "",
        reentryTime: "",
      });
      setIsAddingProduct(false);
    }
  };

  const removeProduct = (index: number) => {
    const newProducts = formData.products.filter((_: any, i: number) => i !== index);
    updateFormData({ products: newProducts });
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="bg-[#E3F2FD] -mx-4 px-4 py-2">
        <h3 className="text-[13px] text-[#0D5A8F]" style={{ fontWeight: 600 }}>
          PRODUCTOS APLICADOS
        </h3>
      </div>

      {/* Added Products List */}
      {formData.products.length > 0 && (
        <div className="space-y-3">
          {formData.products.map((product: any, index: number) => {
            const productLabel = productOptions.find((p) => p.value === product.commercialName)?.label || "";
            return (
              <div key={index} className="bg-white border border-black/10 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-sm mb-1" style={{ fontWeight: 600 }}>{productLabel}</div>
                    <div className="text-xs text-gray-600">{product.activeIngredient}</div>
                  </div>
                  <button
                    onClick={() => removeProduct(index)}
                    className="p-1 text-[#C02A2A]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>Dosis: {product.dosePerHa} kg/ha</span>
                  <span>•</span>
                  <span className="px-2 py-1 bg-gray-100 rounded">{product.infestationLevel}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Product Form */}
      {isAddingProduct ? (
        <div className="bg-white border-2 border-[#2B7AB5] rounded-xl p-4 space-y-4">
          <FormSelect
            label="Nombre comercial"
            value={currentProduct.commercialName}
            onChange={handleProductSelect}
            options={productOptions}
          />

          <FormField
            label="Ingrediente activo"
            value={currentProduct.activeIngredient}
            onChange={() => {}}
            disabled
          />

          <FormField
            label="Número RSCO/COFEPRIS"
            value={currentProduct.rsco}
            onChange={() => {}}
            disabled
          />

          <FormSelect
            label="Justificación / Plaga"
            value={currentProduct.pest}
            onChange={(value) => setCurrentProduct({ ...currentProduct, pest: value })}
            options={pestOptions}
          />

          {/* Infestation Level Pills */}
          <div>
            <label className="text-xs text-gray-600 mb-2 block" style={{ fontWeight: 600 }}>
              Nivel de infestación
            </label>
            <div className="flex gap-2">
              {infestationLevels.map((level) => (
                <button
                  key={level}
                  onClick={() =>
                    setCurrentProduct({ ...currentProduct, infestationLevel: level })
                  }
                  className={`flex-1 h-10 rounded-full transition-all ${
                    currentProduct.infestationLevel === level
                      ? "bg-[#2B7AB5] text-white"
                      : "bg-white border border-gray-300 text-gray-700"
                  }`}
                  style={{ fontWeight: 600 }}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Dosis por ha"
              type="number"
              value={currentProduct.dosePerHa}
              onChange={(value) => setCurrentProduct({ ...currentProduct, dosePerHa: value })}
              placeholder="kg/ha"
            />

            <FormField
              label="Dosis por 200L agua"
              type="number"
              value={currentProduct.dosePer200L}
              onChange={(value) => setCurrentProduct({ ...currentProduct, dosePer200L: value })}
              placeholder="g/200L"
            />
          </div>

          <FormField
            label="Total producto a usar"
            type="number"
            value={currentProduct.totalProduct}
            onChange={(value) => setCurrentProduct({ ...currentProduct, totalProduct: value })}
            placeholder="kg"
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Días a cosecha"
              type="number"
              value={currentProduct.daysToHarvest}
              onChange={(value) =>
                setCurrentProduct({ ...currentProduct, daysToHarvest: value })
              }
            />

            <FormField
              label="Tiempo reentrada (hrs)"
              type="number"
              value={currentProduct.reentryTime}
              onChange={(value) =>
                setCurrentProduct({ ...currentProduct, reentryTime: value })
              }
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsAddingProduct(false)}
              className="flex-1 h-12 border border-gray-300 text-gray-700 rounded-xl"
              style={{ fontWeight: 600 }}
            >
              Cancelar
            </button>
            <button
              onClick={addProduct}
              className="flex-1 h-12 bg-[#2B7AB5] text-white rounded-xl hover:bg-[#1E88C7] transition-colors"
              style={{ fontWeight: 600 }}
            >
              Agregar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAddingProduct(true)}
          className="w-full h-14 border-2 border-dashed border-[#2B7AB5] text-[#2B7AB5] rounded-xl flex items-center justify-center gap-2 hover:bg-[#E3F2FD] transition-colors"
          style={{ fontWeight: 600 }}
        >
          <Plus className="w-5 h-5" />
          Agregar producto
        </button>
      )}

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
          disabled={formData.products.length === 0}
          className="flex-1 h-14 bg-[#2B7AB5] text-white rounded-3xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1E88C7] transition-colors"
          style={{ fontWeight: 600 }}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}