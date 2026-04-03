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

  const selectedLabel = options.find((opt) => opt.value === value)?.label || "";

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`w-full h-14 px-4 pt-5 pb-2 rounded-lg border border-black/10 bg-white
          appearance-none focus:outline-none focus:border-[#2B7AB5] focus:ring-1 focus:ring-[#2B7AB5]
          transition-all cursor-pointer`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <label
        className={`absolute left-4 transition-all pointer-events-none text-gray-600
          ${
            isFocused || hasValue
              ? "top-2 text-[11px]"
              : "top-1/2 -translate-y-1/2 text-sm"
          }`}
        style={{ fontWeight: isFocused || hasValue ? 600 : 400 }}
      >
        {label}
      </label>
      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 pointer-events-none" />
    </div>
  );
}