import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { Step1ParcelaYCultivo } from "../components/nueva-aplicacion/Step1ParcelaYCultivo";
import { Step2Productos } from "../components/nueva-aplicacion/Step2Productos";
import { Step3AplicacionYAgua } from "../components/nueva-aplicacion/Step3AplicacionYAgua";
import { Step4CierreYObservaciones } from "../components/nueva-aplicacion/Step4CierreYObservaciones";

export function NuevaAplicacion() {
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    // Step 1
    producer: "Juan Pérez",
    huerto: "",
    huertoCode: "",
    crop: "Frambuesa",
    variety: "",
    sector: "",
    surface: "",
    phenology: "",
    recommendationDate: "",
    applicationDate: "",
    startTime: "",
    endTime: "",
    // Step 2
    products: [],
    // Step 3
    applicationType: "Foliar",
    equipment: "",
    totalWater: "",
    chlorination: false,
    chlorineQuantity: "",
    pH: "",
    weather: "",
    ppe: {
      "Traje protector": false,
      "Guantes": false,
      "Googles": false,
      "Botas": false,
      "Mascarillas": false,
    },
    // Step 4
    leftover: false,
    leftoverQuantity: "",
    washWater: "",
    eliminatedDesignatedArea: false,
    applicators: "",
    technicalAdvisor: "María González",
    inocuidadResponsible: "Carlos Ramírez",
    observations: "",
  });

  const updateFormData = (data: any) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = () => {
    // Mock save functionality
    console.log("Saving form data:", formData);
    navigate("/");
  };

  return (
    <div className="min-h-full pb-[calc(72px+34px)]">
      {/* Header */}
      <header className="bg-white border-b border-black/10 px-4 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-1">
            <ChevronLeft className="w-6 h-6 text-gray-900" />
          </button>
          <h1 className="text-gray-900" style={{ fontWeight: 600 }}>Nueva Aplicación</h1>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {[1, 2, 3, 4].map((step) => (
            <button
              key={step}
              onClick={() => setCurrentStep(step)}
              className={`w-3 h-3 rounded-full transition-colors ${
                step === currentStep
                  ? "bg-[#2B7AB5]"
                  : step < currentStep
                  ? "bg-[#2B7AB5]/40"
                  : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Form Steps */}
      <div className="p-4">
        {currentStep === 1 && (
          <Step1ParcelaYCultivo
            formData={formData}
            updateFormData={updateFormData}
            onNext={nextStep}
          />
        )}
        {currentStep === 2 && (
          <Step2Productos
            formData={formData}
            updateFormData={updateFormData}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}
        {currentStep === 3 && (
          <Step3AplicacionYAgua
            formData={formData}
            updateFormData={updateFormData}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}
        {currentStep === 4 && (
          <Step4CierreYObservaciones
            formData={formData}
            updateFormData={updateFormData}
            onSave={handleSave}
            onBack={prevStep}
          />
        )}
      </div>
    </div>
  );
}