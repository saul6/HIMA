import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
}

export function FormSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
}: Props) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value !== "";
  const isFloating = isFocused || hasValue;

  return (
    <div className="relative mt-3">
      <label
        className={`absolute left-4 transition-all pointer-events-none text-muted-foreground z-10
          ${isFloating ? "top-2 text-[11px]" : "top-4 text-sm"}`}
        style={{ fontWeight: isFloating ? 600 : 400 }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`w-full h-16 px-4 pt-7 pb-2 rounded-lg border border-border bg-input-background
          appearance-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary
          transition-all cursor-pointer text-sm`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
    </div>
  );
}
